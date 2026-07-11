from __future__ import annotations

import sys
import io
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.api.routes import claims, clients, contracts, documents, notifications, search, vehicles, websockets
from app.config import settings
from app.db.session import get_db


app = FastAPI(title=settings.app_name, debug=settings.debug_enabled)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router, prefix=settings.api_prefix)
app.include_router(vehicles.router, prefix=settings.api_prefix)
app.include_router(contracts.router, prefix=settings.api_prefix)
app.include_router(claims.router, prefix=settings.api_prefix)
app.include_router(documents.router, prefix=settings.api_prefix)
app.include_router(notifications.router, prefix=settings.api_prefix)
app.include_router(search.router, prefix=settings.api_prefix)
app.include_router(websockets.router)

FRONTEND_PATH = Path(__file__).resolve().parent.parent / "frontend" / "assurauto-platform.html"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}


@app.get("/", response_class=HTMLResponse)
def home():
    if FRONTEND_PATH.exists():
        return FileResponse(FRONTEND_PATH)
    return HTMLResponse("<h1>Frontend not found</h1>", status_code=404)

@app.get("/api/v1/claims/{claim_id}/report")
async def get_claim_report_endpoint(claim_id: int, db: Session = Depends(get_db)):
    """
    Génère et renvoie un rapport PDF pour un sinistre donné.
    """
    # NOTE: La fonction `generate_claim_report` doit être implémentée dans `app/services/pdf_generator.py`
    from app.services.pdf_generator import generate_claim_report
    from app.models import Sinistre

    claim = db.query(Sinistre).filter(Sinistre.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    pdf_buffer = await generate_claim_report(claim, db)

    return StreamingResponse(
        io.BytesIO(pdf_buffer),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Rapport-Sinistre-{claim.claim_number}.pdf"}
    )

@app.post("/upload-document")
async def legacy_upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form("anonymous"),
    doc_type: str | None = Form(None),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return await documents.legacy_upload_document(
        background_tasks=background_tasks,
        file=file,
        user_id=user_id,
        doc_type=doc_type,
        db=db,
    )
