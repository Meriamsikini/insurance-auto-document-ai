"""
app/services/gemini_processor.py  — Replace existing file with this version.

Task 3 — Constat amiable : le document est déjà envoyé à Gemini Vision
(car "constat" fait partie de HANDWRITTEN_DIRECT_TYPES dans pipeline.py,
donc il passe par extract_from_image() et non par le pipeline OCR+classify).

Ce qui change ici :
  1. extract_from_image() utilise désormais DOCUMENT_HINTS (ce n'était pas
     le cas avant — le hint n'était utilisé que dans extract_structured()).
  2. Ajout de CONSTAT_FIELD_SPEC : instructions précises demandant à Gemini
     de remplir raw_fields avec des clés exactes (heure, conducteur_a,
     conducteur_b, assureur_a, assureur_b, croquis, etc.) — ce sont ces
     clés que le frontend lit ensuite via rawValue() pour auto-remplir
     les champs du formulaire "Constat amiable".

Tout le reste du fichier est identique à l'original.
"""
from __future__ import annotations

import json
import time
import logging
from typing import Any, Dict, List, Literal, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.config import settings

logger = logging.getLogger(__name__)

DOCUMENT_HINTS = {
    "vehicle_base": "Carte grise marocaine: immatriculation actuelle/ancienne, proprietaire, VIN, puissance fiscale, poids, energie, dates.",
    "cg": "Carte grise marocaine: immatriculation actuelle/ancienne, proprietaire, VIN, puissance fiscale, poids, energie, dates.",
    "carte_grise": "Carte grise marocaine: immatriculation actuelle/ancienne, proprietaire, VIN, puissance fiscale, poids, energie, dates.",
    "technical_inspection": "Controle technique: date visite, resultat, expiration, kilometrage, anomalies.",
    "ct": "Controle technique: date visite, resultat, expiration, kilometrage, anomalies.",
    "permis": "Permis de conduire: nom conducteur, numero permis, categories, autorite delivrance, dates delivrance et expiration.",
    "att": "Attestation d'assurance: assureur, numero contrat, dates couverture, bonus/malus.",
    "attestation": "Attestation d'assurance: assureur, numero contrat, dates couverture, bonus/malus.",
    "facture": "Facture d'achat vehicule: prix, date achat, vendeur, proprietaire, descriptions vehicule.",
    "constat": "Constat amiable manuscrit: parties, assureurs, lieu, date, circonstances, responsabilite probable.",
    "pv": "Rapport de police ou PV: reference, parties, responsabilite, infractions, resume.",
    "cin": "Carte d'identite nationale ou passeport: nom, prenom, date naissance, numero CIN, date expiration.",
    "domicile": "Justificatif de domicile: adresse, emetteur (EDF, MAROC TELECOM, etc.), date document.",
}

GEMINI_OUTPUT_RULES = """
IMPORTANT — JSON OUTPUT RULES:

You MUST return valid JSON.

For ALL string fields:
- NEVER return null.
- NEVER return None.
- NEVER omit the field.
- If the information is missing, unreadable, or uncertain, return "".
- The value MUST always be a string.

For ALL list fields:
- NEVER return null.
- If there is no information, return [].

For numeric fields:
- If the value is missing, return null.

Required string fields:
- document_type
- name
- cin_number
- vehicle
- accident_summary
- damage_level
- garage_name

Required list fields:
- damaged_parts
- repair_items

Required object field:
- raw_fields must always be a JSON object/dictionary.
- If there is no information, return {}.

DO NOT invent information.
When information cannot be determined from the document, use the appropriate empty value.
"""

# ── Task 3 : spécification stricte des clés attendues dans raw_fields ────────
# pour un constat amiable. Le frontend (platform-workspace.tsx → applyAi())
# lit ces clés exactes via rawValue(raw, "heure", ...) pour remplir
# automatiquement les champs constat_heure, constat_conducteur_a, etc.
CONSTAT_FIELD_SPEC = """
Ce document est un CONSTAT AMIABLE D'ACCIDENT AUTOMOBILE (formulaire manuscrit,
généralement bilingue français/arabe, avec deux véhicules A et B).

Remplis IMPÉRATIVEMENT le champ raw_fields avec exactement ces clés
(utilise une chaîne vide "" si l'information est illisible ou absente —
ne jamais inventer de valeur) :

- "date_accident": date de l'accident au format JJ/MM/AAAA
- "heure": heure de l'accident au format HH:MM
- "lieu": lieu de l'accident tel qu'écrit sur le constat
- "conducteur_a": nom complet du conducteur A + immatriculation de son véhicule
- "conducteur_b": nom complet du conducteur B + immatriculation de son véhicule
- "assureur_a": nom de la compagnie d'assurance du véhicule A
- "assureur_b": nom de la compagnie d'assurance du véhicule B
- "croquis": exactement "Oui" si un croquis/schéma de l'accident est dessiné
  sur le constat, exactement "Non" sinon
- "circonstances": résumé des cases cochées dans la section circonstances
  (points 1 à 17 du formulaire standard) pour chaque véhicule
- "responsabilite_probable": ta meilleure estimation de la partie responsable
  ("Conducteur A", "Conducteur B", "Partagée" ou "" si indéterminable)

Utilise également le champ "accident_summary" pour rédiger un résumé narratif
court (2-3 phrases) des circonstances de l'accident en français, basé sur les
circonstances cochées et les croquis/observations visibles. Le texte doit être
écrit entièrement en français, sans anglicismes ni phrases en anglais.
"""

PERMIS_FIELD_SPEC = """
Ce document est un PERMIS DE CONDUIRE (nationale marocaine ou autre).

Remplis IMPÉRATIVEMENT le champ raw_fields avec exactement ces clés
(utilise une chaîne vide "" si l'information est illisible ou absente) :

- "nom": nom complet du conducteur tel qu'écrit sur le permis
- "numero permis": numéro du permis de conduire
- "categories": categories de permis autorisées (ex: B, BE, C, etc.)
- "autorite": autorite qui a delivré le permis (prefecture, wilaya, etc.)
- "date delivrance": date de delivrance au format JJ/MM/AAAA
- "date expiration": date d'expiration au format JJ/MM/AAAA
"""

PV_FIELD_SPEC = """
Ce document est un RAPPORT DE POLICE / EXPERTISE.

Remplis IMPÉRATIVEMENT le champ raw_fields avec exactement ces clés:
- "numero pv": numéro du PV ou du rapport
- "responsabilite": responsabilité probable (ex: "Conducteur A", "Conducteur B", "Partagée")
- "parties": parties impliquées ou nom du conducteur / véhicule concernés
- "expert_nom": nom de l'expert ou du mandataire
- "date expertise": date de l'expertise au format JJ/MM/AAAA
- "cout_estime": coût estimé en MAD
- "infractions": infractions relevées ou observations
"""

GARAGE_FIELD_SPEC = """
Ce document est une FACTURE DE RÉPARATION / DEVIS GARAGE.

Remplis IMPÉRATIVEMENT le champ raw_fields avec exactement ces clés:
- "garage": nom du garage
- "nom garage": nom du garage (si différent)
- "cout_ht": coût hors taxe en MAD
- "tva": taux de TVA en %
- "cout_ttc": coût total TTC en MAD
- "pieces": pièces changées / réparations effectuées
"""

VEHICLE_DOC_FIELD_SPEC = """
Ce document est un document d'identite ou d'immatriculation vehicule.

Remplis IMPÉRATIVEMENT le champ raw_fields avec les clés pertinentes:
- Pour CG/Carte grise: "immatriculation", "marque", "modele", "vin", "proprietaire",
  "cv", "carburant", "ptac", "places", "couleur"
- Pour Attestation d'assurance: "assureur", "contrat", "date debut", "date fin"
- Pour Facture/devis: "prix", "date achat", "vendeur"
- Pour Controle technique: "date visite", "resultat", "expiration", "kilometrage"

Ne jamais inventer de valeurs — utiliser "" si manquant.
"""

DOMICILE_FIELD_SPEC = """
Ce document est un JUSTIFICATIF DE DOMICILE.

Remplis IMPÉRATIVEMENT le champ raw_fields avec exactement ces clés:
- "adresse": adresse du domicile
- "emetteur": nom de l'émetteur (EDF, Orange, Maroc Telecom, bailleur, etc.)
- "date": date du document au format JJ/MM/AAAA
- "type_document": type du document (facture, quittance, attestation, etc.)
"""


class ClassificationResult(BaseModel):
    document_type: str = "unknown"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason: str = ""

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, v: Any) -> float:
        return _coerce_confidence(v)

def _flatten_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, dict):
        flattened: list[str] = []
        for nested_value in value.values():
            flattened.extend(_flatten_string_list(nested_value))
        return flattened
    if isinstance(value, (list, tuple, set)):
        flattened = []
        for item in value:
            flattened.extend(_flatten_string_list(item))
        return flattened
    if isinstance(value, str):
        return [value] if value.strip() else []
    return [str(value)] if value != "" else []


def _coerce_confidence(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return max(0.0, min(1.0, float(value)))
    if isinstance(value, str):
        cleaned = value.strip().lower()
        if not cleaned:
            return 0.0
        try:
            numeric = float(cleaned.rstrip("%")) / 100.0 if cleaned.endswith("%") else float(cleaned)
            return max(0.0, min(1.0, numeric))
        except ValueError:
            labels = {
                "high": 0.9,
                "very_high": 0.95,
                "medium": 0.6,
                "moderate": 0.6,
                "low": 0.4,
                "very_low": 0.25,
                "unknown": 0.0,
            }
            return labels.get(cleaned, 0.0)
    return 0.0


class ExtractedDocument(BaseModel):
    document_type: str = "unknown"
    confidence: float = 0.0
    name: str | None = None

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, v: Any) -> float:
        return _coerce_confidence(v)

    @classmethod
    def normalize_text_fields(cls, v: Any) -> str:
        if v is None:
          return ""
        return str(v)
    cin_number: str | None = None
    vehicle: str = ""
    accident_summary: str = ""
    damage_level: str = ""
    damaged_parts: list[str] = Field(default_factory=list)
    garage_name: str | None = None
    total_cost: float | None = None
    repair_items: list[str] = Field(default_factory=list)
    raw_fields: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra='allow')

    @field_validator("vehicle", mode="before")
    @classmethod
    def transform_vehicle(cls, v: Any) -> str:
        if isinstance(v, dict):
            # Récupère la valeur si le modèle a niché l'info, sinon convertit en texte
            return str(v.get("registration_number") or v.get("plate") or str(v))
        return str(v or "")

    @field_validator("damaged_parts", "repair_items", mode="before")
    @classmethod
    def normalize_string_lists(cls, v: Any) -> list[str]:
        if v is None:
            return []
        return _flatten_string_list(v)

    @field_validator("raw_fields", mode="before")
    @classmethod
    def normalize_raw_fields(cls, v: Any) -> dict[str, Any]:
        # Gemeni may sometimes return a string or list for raw_fields; normalize to a dict
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            return {"text": v}
        if isinstance(v, list):
            # join simple lists into text when possible
            try:
                text = "\n".join(str(x) for x in v)
                return {"text": text}
            except Exception:
                return {"items": v}
        # fallback: wrap unknown types
        return {"value": v}

class GeminiProcessor:
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is required for Gemini processing.")
        self.client = genai.Client(api_key=settings.gemini_api_key)
        logger.info(f"Gemini Processor initialisé (Modèle: {settings.gemini_model})")

    def classify(self, text: str, *, frontend_type: str | None = None) -> ClassificationResult:
        logger.info(f"Classification du document (Type annoncé: {frontend_type})...")
        prompt = f"""
Classify this insurance document. Return strict JSON:
{{"document_type":"", "confidence":0.0, "reason":""}}
Frontend announced type: {frontend_type or "unknown"}

Document text:
{text[:30000]}
"""
        return ClassificationResult.model_validate(self._generate_json(prompt))

    def extract_structured(self, text: str, *, document_type: str, classification: ClassificationResult | None = None) -> dict[str, Any]:
        hint = DOCUMENT_HINTS.get(document_type, "")
        logger.info(f"Extraction structurée pour le type: {document_type}...")
        
        # Sélectionner la spécification appropriée selon le type de document
        if document_type == "constat":
            extra_spec = CONSTAT_FIELD_SPEC
        elif document_type == "permis":
            extra_spec = PERMIS_FIELD_SPEC
        elif document_type in {"cg", "carte_grise", "ct", "att", "attestation", "facture", "facture_achat"}:
            extra_spec = VEHICLE_DOC_FIELD_SPEC
        else:
            extra_spec = ""

        prompt = f"""
Extract structured data for AssurAuto Pro.

Return ONLY valid JSON matching these keys:
document_type, confidence, name, cin_number, vehicle, accident_summary, damage_level,
damaged_parts, garage_name, total_cost, repair_items, raw_fields.

{GEMINI_OUTPUT_RULES}

Important:
- "accident_summary" must be written in French, concise and factual.
- Do not invent information.
- Extract information only from the provided document.
- If the document does not contain enough information to determine a field,
  use the required empty value defined above.

Document type: {document_type}
Hint: {hint}

{extra_spec}

Classifier:
{classification.model_dump() if classification else {}}

Markdown/OCR text:
{text[:50000]}
"""
        return ExtractedDocument.model_validate(self._generate_json(prompt)).model_dump()

    def extract_from_image(self, *, image_bytes: bytes, mime_type: str, document_type: str) -> dict[str, Any]:
        """
        Analyse directe d'une image/PDF sans passage OCR préalable.
        Utilisée pour les documents manuscrits : constat, pv, rapport_police, police_report
        et documents d'identité : permis, CG, CT, attestation, facture, etc.

        Task 3 : le hint spécifique au document_type est désormais injecté
        dans le prompt (ce qui n'était pas le cas auparavant), et pour les
        documents clés (constat, permis, etc.) un cahier des charges détaillé
        est ajouté afin que raw_fields contienne des clés exploitables
        directement par le frontend pour l'auto-remplissage du formulaire.
        """
        hint = DOCUMENT_HINTS.get(document_type, "")
        
        # Sélectionner la spécification appropriée selon le type de document
        if document_type == "constat":
            extra_spec = CONSTAT_FIELD_SPEC
        elif document_type == "permis":
            extra_spec = PERMIS_FIELD_SPEC
        elif document_type in {"cg", "carte_grise", "ct", "att", "attestation", "facture", "facture_achat"}:
            extra_spec = VEHICLE_DOC_FIELD_SPEC
        else:
            extra_spec = ""

        prompt = f"""
Analyze this visual insurance document directly from the image.

Return ONLY valid JSON matching these keys:
document_type, confidence, name, cin_number, vehicle, accident_summary, damage_level,
damaged_parts, garage_name, total_cost, repair_items, raw_fields.

{GEMINI_OUTPUT_RULES}

Important:
- Read the document carefully before extracting information.
- Do not invent information.
- If a value is missing, unreadable, or cannot be determined, use the required empty value.
- If the document describes an accident, "accident_summary" MUST be written in French.
- "damage_level" MUST always be a string. If the damage level cannot be determined, return "".
- "damaged_parts" MUST always be a JSON array. If no damaged parts are identifiable, return [].
- "raw_fields" MUST always be a JSON object.

Document type: {document_type}

Document-specific instructions:
{hint}

{extra_spec}
"""
        part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        return ExtractedDocument.model_validate(self._generate_json(prompt, contents=[prompt, part])).model_dump()

    def _generate_json(self, prompt: str, *, contents: list[Any] | None = None) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = self.client.models.generate_content(
                    model=settings.gemini_vision_model if contents else settings.gemini_model,
                    contents=contents or [prompt],
                    config={"response_mime_type": "application/json"},
                )

                result = json.loads(response.text or "{}")
                logger.debug(f"Réponse IA reçue (tentative {attempt+1}): {result}")
                return result
            except Exception as exc:
                logger.warning(f"Tentative Gemini {attempt+1} échouée: {exc}")
                last_error = exc
                time.sleep(0.4 * (attempt + 1))
        raise RuntimeError(f"Gemini processing failed after retries: {last_error}")
