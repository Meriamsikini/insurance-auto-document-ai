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
    "technical_inspection": "Controle technique: date visite, resultat, expiration, kilometrage, anomalies.",
    "ct": "Controle technique: date visite, resultat, expiration, kilometrage, anomalies.",
    "constat": "Constat amiable manuscrit: parties, assureurs, lieu, date, circonstances, responsabilite probable.",
    "pv": "Rapport de police ou PV: reference, parties, responsabilite, infractions, resume.",
}

class ClassificationResult(BaseModel):
    document_type: str = "unknown"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason: str = ""

class ExtractedDocument(BaseModel):
    document_type: str = "unknown"
    confidence: float = 0.0
    name: str | None = None
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
        
        prompt = f"""
Extract structured data for AssurAuto Pro. Return strict JSON matching these keys:
document_type, confidence, name, cin_number, vehicle, accident_summary, damage_level,
damaged_parts, garage_name, total_cost, repair_items, raw_fields.

Use null for missing numeric values (total_cost) and empty strings/lists for others. Preserve useful OCR table labels inside raw_fields.

Document type: {document_type}
Hint: {hint}
Classifier: {classification.model_dump() if classification else {}}

Markdown/OCR text:
{text[:50000]}
"""
        return ExtractedDocument.model_validate(self._generate_json(prompt)).model_dump()

    def extract_from_image(self, *, image_bytes: bytes, mime_type: str, document_type: str) -> dict[str, Any]:
        prompt = f"""
Analyze this visual insurance document without OCR. Return strict JSON with:
document_type, confidence, name, cin_number, vehicle, accident_summary, damage_level,
damaged_parts, garage_name, total_cost, repair_items, raw_fields.
Use null for missing numeric values and empty strings/lists for others.
Document type: {document_type}
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
