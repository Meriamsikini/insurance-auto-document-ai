from __future__ import annotations

import re
import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import settings

ALLOWED_UPLOAD_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


def normalize_document_type(document_type: str | None) -> str:
    raw = (document_type or "unknown").strip().lower()
    raw = re.sub(r"[^a-z0-9_-]+", "_", raw)
    return raw.strip("_") or "unknown"


def safe_filename(filename: str | None) -> str:
    stem = Path(filename or "document").stem
    suffix = Path(filename or "").suffix.lower()
    clean_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._-") or "document"
    clean_suffix = re.sub(r"[^A-Za-z0-9.]+", "", suffix)[:20]
    return f"{clean_stem[:80]}_{secrets.token_hex(8)}{clean_suffix}"


async def save_upload(file: UploadFile, *, client_id: int, document_type: str) -> tuple[str, str, int]:
    if (file.content_type or "").lower() not in ALLOWED_UPLOAD_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload PDF, JPEG, PNG, or WebP only.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=413, detail="Uploaded file exceeds configured size limit.")

    normalized_type = normalize_document_type(document_type)
    stored_filename = safe_filename(file.filename)
    folder = settings.uploads_dir / str(client_id) / normalized_type
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / stored_filename
    destination.write_bytes(content)
    return stored_filename, str(destination), len(content)


def assert_file_exists(file_path: str) -> Path:
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Stored file not found.")
    return path
