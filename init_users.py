"""
init_users.py — Create the employees table and seed an initial admin account.

Run once after init_db.py:
    python init_users.py
    python init_users.py --email admin@slouiglobal.com --name "Admin AssurAuto" --password "Admin@2024!"

Environment variables (alternative to CLI args):
    ADMIN_EMAIL      default: admin@slouiglobal.com
    ADMIN_NAME       default: Administrateur
    ADMIN_PASSWORD   default: Admin@Assurauto2024!
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

# ── Bootstrap ──────────────────────────────────────────────────────────────────

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    text,
)
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import get_engine, SessionLocal


# ── Inline model definition (no import cycle risk) ────────────────────────────

class Employee(Base):
    """Internal employee / user account.  No self-registration – admin only."""

    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    department = Column(String(120), nullable=True)
    phone = Column(String(80), nullable=True)
    avatar_url = Column(String(600), nullable=True)
    theme = Column(String(20), nullable=False, default="dark")
    is_active = Column(Boolean, nullable=False, default=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    """bcrypt hash – requires passlib[bcrypt]."""
    try:
        from passlib.context import CryptContext  # type: ignore

        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return ctx.hash(plain)
    except ImportError:
        # Fallback: sha256 (NOT for production – install passlib[bcrypt])
        import hashlib

        print(
            "⚠  passlib not installed. Using sha256 fallback (NOT production-safe).\n"
            "   Run: pip install passlib[bcrypt]"
        )
        return hashlib.sha256(plain.encode()).hexdigest()


# ── Main ───────────────────────────────────────────────────────────────────────

def create_table() -> None:
    engine = get_engine()
    print("Creating 'employees' table if it does not exist…")
    Base.metadata.create_all(bind=engine, tables=[Employee.__table__])
    print("✓ Table ready.")


def seed_admin(email: str, full_name: str, password: str) -> None:
    db: Session = SessionLocal()
    try:
        existing = db.query(Employee).filter(Employee.email == email).first()
        if existing:
            print(f"✓ Admin '{email}' already exists (id={existing.id}). Skipping creation.")
            return

        admin = Employee(
            email=email,
            full_name=full_name,
            hashed_password=_hash_password(password),
            department="Administration",
            is_admin=True,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"✓ Admin employee created: {email}  (id={admin.id})")
    finally:
        db.close()


def list_employees() -> None:
    db: Session = SessionLocal()
    try:
        rows = db.query(Employee).all()
        if not rows:
            print("No employees in database yet.")
            return
        print(f"\n{'ID':<5} {'EMAIL':<40} {'NAME':<30} {'ADMIN':<7} {'ACTIVE':<7}")
        print("-" * 95)
        for emp in rows:
            print(
                f"{emp.id:<5} {emp.email:<40} {emp.full_name:<30} "
                f"{'yes' if emp.is_admin else 'no':<7} {'yes' if emp.is_active else 'no':<7}"
            )
    finally:
        db.close()


# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create the employees table and seed the first admin account."
    )
    parser.add_argument(
        "--email",
        default=os.getenv("ADMIN_EMAIL", "admin@slouiglobal.com"),
        help="Admin email (default: admin@slouiglobal.com)",
    )
    parser.add_argument(
        "--name",
        default=os.getenv("ADMIN_NAME", "Administrateur"),
        help="Admin full name",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("ADMIN_PASSWORD", "Admin@Assurauto2024!"),
        help="Admin password (min 8 chars)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List existing employees after seeding",
    )
    parser.add_argument(
        "--table-only",
        action="store_true",
        help="Only create the table, skip seeding",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("  AssurAuto — Users / Employees initialisation")
    print("=" * 60)

    create_table()

    if not args.table_only:
        print(f"\nSeeding admin account: {args.email}")
        seed_admin(args.email, args.name, args.password)

    if args.list:
        print("\nCurrent employees:")
        list_employees()

    print("\nDone. You can now log in at /login with the admin credentials.")
