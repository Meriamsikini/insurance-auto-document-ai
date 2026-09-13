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
from app import models_claims_agent  # noqa: F401 — enregistre ClaimAnalysisReport (AI Claims Agent)

def init():
    print("Initialisation de la base de données...")
    try:
        Base.metadata.create_all(bind=get_engine())
        print("Succès : Les tables ont été créées correctement.")
        print("Tables enregistrées :", ", ".join(sorted(Base.metadata.tables.keys())))
    except Exception as e:
        print(f"Erreur lors de la création des tables : {e}")

if __name__ == "__main__":
    init()
