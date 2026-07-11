from __future__ import annotations

from pathlib import Path

import fitz


def extract_pdf_text(path: Path) -> str:
    chunks: list[str] = []
    with fitz.open(path) as document:
        for page_number, page in enumerate(document, start=1):
            text = page.get_text("text").strip()
            if text:
                chunks.append(f"--- PAGE {page_number} ---\n{text}")
    return "\n\n".join(chunks)
