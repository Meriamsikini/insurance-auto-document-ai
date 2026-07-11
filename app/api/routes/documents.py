from __future__ import annotations

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Client, Document, InsuranceContract, Sinistre, Vehicle
from app.schemas import DocumentAssignRefs, DocumentRead
from app.services.audit import write_audit_log
from app.services.document_processor import process_document_async
from app.services.notifications import create_notification, push_event
from app.services.storage import assert_file_exists, normalize_document_type, save_upload

router = APIRouter(prefix="/documents", tags=["documents"])

logger = logging.getLogger(__name__)


def _assert_upload_refs(
    db: Session,
    *,
    client_id: int,
    vehicle_id: int | None = None,
    contract_id: int | None = None,
    sinistre_id: int | None = None,
) -> None:
    if db.get(Client, client_id) is None:
        raise HTTPException(status_code=404, detail="Client not found.")
    if vehicle_id is not None and db.get(Vehicle, vehicle_id) is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    if contract_id is not None and db.get(InsuranceContract, contract_id) is None:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if sinistre_id is not None and db.get(Sinistre, sinistre_id) is None:
        raise HTTPException(status_code=404, detail="Claim not found.")


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    client_id: int | None = Form(None),
    document_type: str = Form(...),
    vehicle_id: int | None = Form(None),
    contract_id: int | None = Form(None),
    sinistre_id: int | None = Form(None),
    db: Session = Depends(get_db),
) -> Document:
    logger.info("--- Début de l'Upload de Document ---")
    logger.info(f"Client: {client_id}, Type: {document_type}, Fichier: {file.filename}, MIME: {file.content_type}")
    # If no client_id provided, create a temporary client record so documents can be uploaded
    if client_id is None:
        temp_name = f"temporary-upload-{file.filename or 'doc'}"
        temp_client = Client(full_name=temp_name, metadata_={"temporary": True, "created_from_upload": True})
        db.add(temp_client)
        db.flush()
        client_id = temp_client.id

    _assert_upload_refs(
        db,
        client_id=client_id,
        vehicle_id=vehicle_id,
        contract_id=contract_id,
        sinistre_id=sinistre_id,
    )
    try:
        normalized_type = normalize_document_type(document_type)
        stored_filename, file_path, file_size = await save_upload(
            file,
            client_id=client_id,
            document_type=normalized_type,
        )
        logger.info(f"Fichier sauvegardé physiquement : {file_path}")
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde du fichier : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur stockage : {str(e)}")
    
    document = Document(
        client_id=client_id,
        vehicle_id=vehicle_id,
        contract_id=contract_id,
        sinistre_id=sinistre_id,
        document_type=normalized_type,
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        file_path=file_path,
        content_type=file.content_type,
        file_size=file_size,
    )
    db.add(document)
    db.flush()
    create_notification(
        db,
        event_type="document_uploaded",
        title="Document uploaded",
        client_id=client_id,
        payload={"document_id": document.id, "document_type": document.document_type},
    )
    write_audit_log(db, action="document.uploaded", entity_type="document", entity_id=document.id)
    db.commit()
    db.refresh(document)

    logger.info(f"Document {document.id} enregistré. Lancement de process_document_async sur : {document.file_path}")
    background_tasks.add_task(process_document_async, document.id)
    await push_event(
        "document_uploaded",
        client_id=client_id,
        title="Document uploaded",
        payload={"document_id": document.id, "document_type": document.document_type},
    )
    return document


@router.get("", response_model=list[DocumentRead])
def list_documents(client_id: int | None = None, db: Session = Depends(get_db)) -> list[Document]:
    stmt = select(Document)
    if client_id is not None:
        stmt = stmt.where(Document.client_id == client_id)
    return list(db.scalars(stmt))


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: int, db: Session = Depends(get_db)) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


@router.post("/{document_id}/assign-refs", response_model=DocumentRead)
def assign_refs_to_document(document_id: int, payload: DocumentAssignRefs, db: Session = Depends(get_db)) -> Document:
    """Attach an uploaded document to saved business records."""
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    previous_client_id = document.client_id

    updates = payload.model_dump(exclude_unset=True)
    refs = {key: value for key, value in updates.items() if key != "validated_data"}
    if "client_id" in refs and refs["client_id"] is not None and db.get(Client, refs["client_id"]) is None:
        raise HTTPException(status_code=404, detail="Client not found.")
    if "vehicle_id" in refs and refs["vehicle_id"] is not None and db.get(Vehicle, refs["vehicle_id"]) is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    if "contract_id" in refs and refs["contract_id"] is not None and db.get(InsuranceContract, refs["contract_id"]) is None:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if "sinistre_id" in refs and refs["sinistre_id"] is not None and db.get(Sinistre, refs["sinistre_id"]) is None:
        raise HTTPException(status_code=404, detail="Claim not found.")

    for key, value in refs.items():
        setattr(document, key, value)
    if updates.get("validated_data") is not None:
        document.validated_data = updates["validated_data"]
    db.add(document)
    db.flush()
    if "client_id" in refs and refs["client_id"] != previous_client_id:
        previous_client = db.get(Client, previous_client_id)
        remaining_docs = db.scalar(select(func.count(Document.id)).where(Document.client_id == previous_client_id))
        if previous_client is not None and previous_client.metadata_.get("temporary") and not remaining_docs:
            db.delete(previous_client)
    write_audit_log(db, action="document.refs_assigned", entity_type="document", entity_id=document.id, payload=updates)
    db.commit()
    db.refresh(document)
    return document


@router.post("/{document_id}/assign-client", response_model=DocumentRead)
def assign_client_to_document(document_id: int, payload: dict, db: Session = Depends(get_db)) -> Document:
    """Backward compatible endpoint for older frontend code."""
    client_id = payload.get("client_id")
    if client_id is None:
        raise HTTPException(status_code=400, detail="client_id is required")
    return assign_refs_to_document(document_id, DocumentAssignRefs(client_id=client_id), db)


@router.get("/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(get_db)) -> FileResponse:
    document = get_document(document_id, db)
    path = assert_file_exists(document.file_path)
    return FileResponse(path, media_type=document.content_type, filename=document.original_filename)


@router.post("/legacy-upload")
async def legacy_upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form("anonymous"),
    doc_type: str | None = Form(None),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    logger.info(f"Upload Legacy initié par user_id: {user_id}")
    client_name = user_id.strip() or "anonymous"
    client = db.scalar(select(Client).where(Client.full_name == client_name))
    if client is None:
        logger.info(f"Création d'un nouveau client legacy: {client_name}")
        client = Client(full_name=client_name)
        db.add(client)
        db.flush()
    
    document = await upload_document(
        background_tasks=background_tasks,
        file=file,
        client_id=client.id,
        document_type=doc_type or "unknown",
        db=db,
    )
    return {"success": True, "result": {"document_id": document.id, "client_id": client.id, "status": document.processing_status}}
