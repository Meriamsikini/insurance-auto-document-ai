from __future__ import annotations

import base64
from dataclasses import dataclass
import sys # Ajouté pour le débogage du chemin
import logging
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps

from app.config import settings
from io import BytesIO

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class OCRPage:
    index: int
    markdown: str


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def preprocess_image(path: Path, *, max_side: int = 2200) -> bytes:
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        image = ImageEnhance.Contrast(image).enhance(1.4)
        image = ImageEnhance.Sharpness(image).enhance(2.0)
        output = BytesIO()
        image.save(output, format="JPEG", quality=92, optimize=True)
        return output.getvalue()


class MistralOCRService:
    def __init__(self) -> None:
        if not settings.mistral_api_key:
            raise ValueError("MISTRAL_API_KEY is required for OCR processing.")
        
        # Try several import paths/names to be compatible with multiple
        # versions of the `mistralai` package. Provide clear error if none
        # are available.
        logger.debug("Attempting to initialize MistralOCRService. sys.path: %s", sys.path)
        client_cls = None
        import importlib

        try:
            # Preferred common location
            from mistralai.client import MistralClient as _MistralClient  # type: ignore
            client_cls = _MistralClient
        except Exception:
            try:
                # Some versions expose a top-level `Mistral` or similar
                from mistralai import Mistral as _Mistral  # type: ignore
                client_cls = _Mistral
            except Exception:
                try:
                    m = importlib.import_module("mistralai")
                    for name in ("MistralClient", "Mistral", "Client", "MistralAPI"):
                        if hasattr(m, name):
                            client_cls = getattr(m, name)
                            break
                except Exception:
                    pass

                if client_cls is None:
                    try:
                        sub = importlib.import_module("mistralai.client")
                        for name in ("MistralClient", "Mistral", "Client", "MistralAPI"):
                            if hasattr(sub, name):
                                client_cls = getattr(sub, name)
                                break
                    except Exception:
                        # ignore, we'll raise below with helpful message
                        pass

        if client_cls is None:
            logger.exception("ImportError lors du chargement du client Mistral: aucune classe client trouvée dans 'mistralai'.")
            raise RuntimeError(
                "Échec de l'importation du client Mistral depuis 'mistralai'. "
                "Veuillez vous assurer que 'mistralai' est correctement installé et à jour. "
                "Essayez d'exécuter : pip install --upgrade --force-reinstall mistralai"
            )

        # Instantiate the client, trying keyword then positional API key argument.
        try:
            self.client = client_cls(api_key=settings.mistral_api_key)
        except TypeError:
            try:
                self.client = client_cls(settings.mistral_api_key)
            except Exception as exc:
                logger.exception("Échec de l'instanciation du client Mistral: %s", exc)
                raise RuntimeError(
                    "Impossible d'instancier le client Mistral trouvé. Vérifiez la version de 'mistralai' "
                    "et les paramètres d'initialisation (api_key)."
                ) from exc
        logger.info("Mistral OCR Service initialisé avec succès")

    def ocr_file(self, path: Path, *, content_type: str | None = None) -> list[OCRPage]:
        suffix = path.suffix.lower()
        if suffix in IMAGE_SUFFIXES or (content_type or "").startswith("image/"):
            return self.ocr_image(path, content_type=content_type)
        return self.ocr_pdf(path)

    def ocr_image(self, path: Path, *, content_type: str | None = None) -> list[OCRPage]:
        image_bytes = preprocess_image(path)
        markdown = self._ocr_document(
            document={
                "type": "image_url",
                "image_url": f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode('ascii')}",
            }
        )
        return [OCRPage(index=0, markdown=markdown)]

    def ocr_pdf(self, path: Path) -> list[OCRPage]:
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        result = self._raw_ocr(
            document={
                "type": "document_url",
                "document_url": f"data:application/pdf;base64,{encoded}",
            }
        )
        pages = getattr(result, "pages", None) or []
        if not pages:
            return [OCRPage(index=0, markdown=self._extract_markdown(result))]
        return [OCRPage(index=index, markdown=self._extract_markdown(page)) for index, page in enumerate(pages)]

    def _ocr_document(self, *, document: dict[str, str]) -> str:
        logger.info("Envoi du document à Mistral OCR...")
        return self._extract_markdown(self._raw_ocr(document=document))

    def _raw_ocr(self, *, document: dict[str, str]) -> Any:
        # Utilisation de la méthode process (SDK moderne)
        return self.client.ocr.process(
            model=settings.mistral_ocr_model,
            document=document,
            include_image_base64=False,
        )

    @staticmethod
    def _extract_markdown(value: Any) -> str:
        if isinstance(value, dict):
            return str(value.get("markdown") or value.get("text") or "")
        return str(getattr(value, "markdown", None) or getattr(value, "text", None) or "")
