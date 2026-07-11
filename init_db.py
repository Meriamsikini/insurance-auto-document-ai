from app.db.base import Base
from app.db.session import get_engine

from app.models import (
    Client,
    Vehicle,
    InsuranceContract,
    Sinistre,
    Document,
    Notification,
    AuditLog,
)

def init():
    print("Initialisation de la base de données...")
    try:
        Base.metadata.create_all(bind=get_engine())
        print("Succès : Les tables ont été créées correctement.")
    except Exception as e:
        print(f"Erreur lors de la création des tables : {e}")

if __name__ == "__main__":
    init()

