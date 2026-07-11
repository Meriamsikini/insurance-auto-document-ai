from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any

from app.models import Document
from app.services.gemini_processor import GeminiProcessor
from app.services.ocr_mistral import MistralOCRService, OCRPage
from app.services.opencv_preprocessing import preprocess_accident_image


HANDWRITTEN_DIRECT_TYPES = {"constat", "pv", "rapport_police", "police_report"}
ACCIDENT_PHOTO_TYPES = {"accident", "accidents", "accident_photo", "accident_photos", "photos", "sinistre_photo"}

def clean_text(value: str) -> str:
    value = re.sub(r"[ \t]*\|[ \t]*", " | ", value)
    value = re.sub(r"[ \t]+", " ", value)
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def normalize_date(value: Any) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return text


def parse_address(value: str | None) -> dict[str, str]:
    text = clean_text(value or "")
    postal_code = re.search(r"\b(\d{5})\b", text)
    parts = [part.strip(" ,") for part in re.split(r",|\n", text) if part.strip()]
    return {
        "street": parts[0] if parts else "",
        "district": parts[1] if len(parts) > 2 else "",
        "city": parts[-1] if len(parts) > 1 else "",
        "postal_code": postal_code.group(1) if postal_code else "",
    }


def merge_pages(pages: list[OCRPage]) -> str:
    return "\n\n--- PAGE BREAK ---\n\n".join(page.markdown for page in sorted(pages, key=lambda page: page.index))


def normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalise le payload pour faciliter l'auto-remplissage UI."""
    raw_fields = payload.setdefault("raw_fields", {})
    for key, value in list(raw_fields.items()):
        if "date" in key.lower():
            raw_fields[key] = normalize_date(value)
        elif isinstance(value, str):
            raw_fields[key] = clean_text(value)
            
    address = raw_fields.get("address") or raw_fields.get("adresse") or payload.get("address")
    if address:
        if isinstance(address, dict):
            address = f"{address.get('rue', '')} {address.get('ville', '')}"
        raw_fields["parsed_address"] = parse_address(str(address))
    return payload


def process_uploaded_document(document: Document) -> tuple[str | None, dict[str, Any]]:
    path = Path(document.file_path)
    frontend_type = document.document_type.lower()
    gemini = GeminiProcessor()

    if frontend_type in ACCIDENT_PHOTO_TYPES:
        processed = preprocess_accident_image(path)
        return None, normalize_payload(
            gemini.extract_from_image(image_bytes=processed, mime_type="image/jpeg", document_type=frontend_type)
        )

    if frontend_type in HANDWRITTEN_DIRECT_TYPES:
        return None, normalize_payload(
            gemini.extract_from_image(
                image_bytes=path.read_bytes(),
                mime_type=document.content_type or "application/pdf",
                document_type=frontend_type,
            )
        )

    ocr = MistralOCRService()
    pages = ocr.ocr_file(path, content_type=document.content_type)
    full_text = clean_text(merge_pages(pages))
    classification = gemini.classify(full_text, frontend_type=frontend_type)
    
    result = gemini.extract_structured(
        full_text,
        document_type=classification.document_type or frontend_type,
        classification=classification,
    )
    if classification.document_type != frontend_type and classification.confidence >= 0.8:
        result.setdefault("raw_fields", {})["classification_alert"] = {
            "frontend_type": frontend_type,
            "detected_type": classification.document_type,
            "confidence": classification.confidence,
            "reason": classification.reason,
        }
    return full_text, normalize_payload(result)
