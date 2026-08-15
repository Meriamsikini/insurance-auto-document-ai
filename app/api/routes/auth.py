from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.config import settings
from app.db.session import get_db
from app.models import Employee

# --- Schemas ---
# NOTE: Si EmployeeRead existe déjà dans app/schemas.py, supprimez cette
# définition et importez-le depuis app.schemas
class EmployeeRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    department: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    theme: str | None = "dark"
    is_active: bool
    is_admin: bool

    class Config:
        from_attributes = True

class EmployeeUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    department: str | None = None
    theme: str | None = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    employee: EmployeeRead

class TokenData(BaseModel):
    email: str | None = None


# --- Security & Auth Helpers ---

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")
ALGORITHM = "HS256"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe en clair contre un mot de passe haché."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        # Cette erreur peut se produire si le mot de passe est > 72 octets, ce que bcrypt ne supporte pas.
        # Dans ce cas, le mot de passe ne peut pas être valide, donc la vérification échoue.
        return False


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Crée un token d'accès JWT."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_employee(db: Session, *, email: str, password: str) -> Employee | None:
    """Authentifie un employé par email et mot de passe."""
    employee = db.query(Employee).filter(Employee.email == email).first()
    if not employee or not employee.is_active:
        return None
    # Vérifie si un mot de passe haché existe pour l'employé
    if not employee.hashed_password:
        return None
    if not verify_password(password, employee.hashed_password):
        return None
    return employee

def get_current_employee(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> Employee:
    """Récupère l'employé actuel à partir du token JWT."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = db.query(Employee).filter(Employee.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    
    return user

def get_current_active_employee(current_user: Employee = Depends(get_current_employee)) -> Employee:
    """Vérifie si l'employé actuel est actif."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# --- Router ---

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
def login_for_access_token(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """
    Login pour obtenir un token d'accès.
    Le `username` est l'email de l'employé.
    """
    employee = authenticate_employee(db, email=form_data.username, password=form_data.password)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(subject=employee.email, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer", "employee": employee}


@router.get("/me", response_model=EmployeeRead)
def read_users_me(current_user: Employee = Depends(get_current_active_employee)):
    """
    Get current logged in user.
    """
    return current_user


@router.patch("/me", response_model=EmployeeRead)
def update_me(
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_employee),
) -> Employee:
    """
    Update current user's profile information.
    """
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_employee),
) -> None:
    """
    Change current user's password.
    """
    if not current_user.hashed_password or not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    current_user.hashed_password = pwd_context.hash(payload.new_password)
    db.add(current_user)
    db.commit()