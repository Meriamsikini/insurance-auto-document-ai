from __future__ import annotations

import json
from typing import Any

from google import genai
from google.genai import types

from app.config import settings


GENERIC_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "cin_number": {"type": "string"},
        "vehicle": {"type": "string"},
        "accident_summary": {"type": "string"},
        "damage_level": {"type": "string"},
        "damaged_parts": {"type": "array", "items": {"type": "string"}},
        "garage_name": {"type": "string"},
        "total_cost": {"type": "number"},
        "repair_items": {"type": "array", "items": {"type": "string"}},
        "raw_fields": {"type": "object"},
    },
    "required": ["name", "cin_number", "vehicle", "accident_summary", "damage_level", "damaged_parts"],
}


def normalize_ai_output(data: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "name": data.get("name") or data.get("full_name") or "",
        "cin_number": data.get("cin_number") or data.get("id_number") or "",
        "vehicle": data.get("vehicle") or data.get("registration_number") or "",
        "accident_summary": data.get("accident_summary") or data.get("description") or "",
        "damage_level": data.get("damage_level") or data.get("severity") or "",
        "damaged_parts": data.get("damaged_parts") or data.get("damage_parts") or [],
    }
    for optional_key in ("garage_name", "total_cost", "repair_items", "raw_fields"):
        if optional_key in data:
            normalized[optional_key] = data[optional_key]
    if not isinstance(normalized["damaged_parts"], list):
        normalized["damaged_parts"] = [str(normalized["damaged_parts"])]
    if "repair_items" in normalized and not isinstance(normalized["repair_items"], list):
        normalized["repair_items"] = [str(normalized["repair_items"])]
    return normalized


class GeminiService:
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is required for AI processing.")
        self.client = genai.Client(api_key=settings.gemini_api_key)

    def _generate_json(self, *, model: str, contents: list[Any]) -> dict[str, Any]:
        response = self.client.models.generate_content(
            model=model,
            contents=contents,
            config={
                "response_mime_type": "application/json",
                "response_json_schema": GENERIC_SCHEMA,
            },
        )
        text = response.text or "{}"
        return json.loads(text)

    def extract_standard_document(self, *, text: str, document_type: str) -> dict[str, Any]:
        prompt = f"""
You extract structured data for a car insurance management system.
Return strict JSON only. Normalize missing scalar fields to empty strings and missing lists to [].

Document type: {document_type}
Target JSON keys:
name, cin_number, vehicle, accident_summary, damage_level, damaged_parts, raw_fields.

OCR/document text:
{text[:50000]}
"""
        return normalize_ai_output(self._generate_json(model=settings.gemini_model, contents=[prompt]))

    def extract_accident_photo(self, *, image_bytes: bytes, mime_type: str) -> dict[str, Any]:
        prompt = """
Analyze this accident photo for an auto insurance claim.
Return strict JSON only with damaged_parts, damage_level, accident_summary, vehicle, name, cin_number, raw_fields.
Use damage_level as one of: minor, moderate, severe, unknown.
"""
        part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        return normalize_ai_output(self._generate_json(model=settings.gemini_vision_model, contents=[prompt, part]))

    def extract_repair_invoice(self, *, text: str) -> dict[str, Any]:
        prompt = f"""
Extract repair invoice information for an auto insurance claim.
Return strict JSON only with:
garage_name, total_cost, repair_items, name, cin_number, vehicle, accident_summary, damage_level, damaged_parts, raw_fields.
Use numeric total_cost when possible.

Invoice text:
{text[:50000]}
"""
        return normalize_ai_output(self._generate_json(model=settings.gemini_model, contents=[prompt]))
