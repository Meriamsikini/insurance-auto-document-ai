from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session


from app.models import Sinistre, Document

# --- Helpers ---

def get_data(obj, key, default="N/A"):
    """Accède de manière sécurisée aux attributs ou aux clés de metadata_."""
    if hasattr(obj, key):
        value = getattr(obj, key)
        if value is not None:
            return value

    metadata = getattr(obj, "metadata_", None)

    if isinstance(metadata, dict):
        return metadata.get(key, default)

    return default


from datetime import date, datetime


def format_date(dt, default="N/A"):
    """Formate un objet date ou datetime en chaîne de caractères."""

    if dt is None:
        return default

    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return dt

    if isinstance(dt, datetime):
        return dt.strftime("%d/%m/%Y à %H:%M")

    if isinstance(dt, date):
        return dt.strftime("%d/%m/%Y")

    return default


def create_info_table(data: list[tuple[str, str]], col_widths: list) -> Table:
    """Crée un tableau d'informations à deux colonnes."""
    styled_data = [
        (Paragraph(f"<b>{k}</b>", styles["BodyText"]), Paragraph(str(v), styles["BodyText"]))
        for k, v in data
    ]
    table = Table(styled_data, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


# --- Styles ---


def get_stylesheet() -> StyleSheet1:
    """Définit les styles de paragraphes pour le document."""
    styles = StyleSheet1()
    styles.add(
        ParagraphStyle(
            name="Title",
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            spaceAfter=1 * cm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Header",
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.grey,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Footer",
            fontName="Helvetica",
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            spaceBefore=10,
            spaceAfter=6,
            textColor=colors.HexColor("#1E3A8A"), # blue-800
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyText",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Json",
            fontName="Courier",
            fontSize=8,
            leading=10,
            leftIndent=10,
            wordWrap="CJK",
            backColor=colors.whitesmoke,
            borderPadding=5,
            borderRadius=2,
            paddingLeft=5,
            paddingRight=5,
        )
    )
    return styles


styles = get_stylesheet()


# --- En-tête et Pied de page ---


class ReportDocTemplate(BaseDocTemplate):
    """Template de document avec en-tête et pied de page personnalisés."""

    def __init__(self, filename, **kw):
        super().__init__(filename, **kw)
        self.addPageTemplates(
            [
                PageTemplate(
                    id="Main",
                    frames=[
                        Frame(
                            self.leftMargin,
                            self.bottomMargin,
                            self.width,
                            self.height,
                            id="normal",
                        )
                    ],
                    onPage=self._header,
                    onPageEnd=self._footer,
                )
            ]
        )

    def _header(self, canvas, doc):
        canvas.saveState()
        p = Paragraph("Rapport de Sinistre - AssurAuto", styles["Header"])
        w, h = p.wrap(doc.width, doc.topMargin)
        p.drawOn(canvas, doc.leftMargin, doc.height + doc.topMargin - h)

        p_date = Paragraph(
            f"Généré le : {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Header"]
        )
        w_date, h_date = p_date.wrap(doc.width, doc.topMargin)
        p_date.drawOn(
            canvas, doc.leftMargin + doc.width - w_date, doc.height + doc.topMargin - h_date
        )
        canvas.setStrokeColorRGB(0.8, 0.8, 0.8)
        canvas.line(doc.leftMargin, doc.height + doc.topMargin - h - 5, doc.leftMargin + doc.width, doc.height + doc.topMargin - h - 5)
        canvas.restoreState()

    def _footer(self, canvas, doc):
        canvas.saveState()
        p = Paragraph(f"Page {doc.page}", styles["Footer"])
        w, h = p.wrap(doc.width, doc.bottomMargin)
        p.drawOn(canvas, doc.leftMargin, h)
        canvas.restoreState()


# --- Génération des sections ---


async def generate_claim_report(claim: Sinistre, db: Session) -> bytes:
    """Génère le rapport PDF complet pour un sinistre."""
    buffer = io.BytesIO()
    pdf_doc = ReportDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
    )

    story = []

    # --- Titre ---
    story.append(Paragraph(f"Rapport de Sinistre : {claim.claim_number}", styles["Title"]))

    # --- Section Client ---
    story.append(Paragraph("1. Informations sur le Client", styles["H1"]))
    client = claim.client
    client_data = [
        ("Nom complet", client.full_name),
        ("N° CIN", client.cin_number),
        ("Téléphone", client.phone),
        ("Email", client.email),
        ("Adresse", client.address),
        ("Date de naissance", format_date(get_data(client, "birth_date"))),
    ]
    story.append(create_info_table(client_data, col_widths=[4 * cm, None]))

    # --- Section Véhicule ---
    story.append(Paragraph("2. Informations sur le Véhicule", styles["H1"]))
    vehicle = claim.vehicle
    vehicle_data = [
        ("Immatriculation", vehicle.registration_number),
        ("Marque & Modèle", f"{vehicle.make} {vehicle.model}"),
        ("N° de châssis (VIN)", vehicle.vin),
        ("Année", vehicle.year),
        ("Usage", vehicle.usage),
        ("Énergie", get_data(vehicle, "fuel_type")),
    ]
    story.append(create_info_table(vehicle_data, col_widths=[4 * cm, None]))

    # --- Section Sinistre ---
    story.append(Paragraph("3. Détails du Sinistre", styles["H1"]))
    claim_data = [
        ("N° de dossier", claim.claim_number),
        ("Date de l'accident", format_date(claim.accident_date)),
        ("Lieu de l'accident", claim.location),
    ]
    story.append(create_info_table(claim_data, col_widths=[4 * cm, None]))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("<b>Description :</b>", styles["BodyText"]))
    story.append(Paragraph(claim.description or "Non fournie", styles["BodyText"]))

    # --- Section Expertise (depuis metadata) ---
    story.append(Paragraph("4. Données d'Expertise (extraites par IA)", styles["H1"]))
    expertise_data = [
        ("Niveau de dégâts", get_data(claim, "damage_level")),
        ("Pièces endommagées", ", ".join(get_data(claim, "damaged_parts", []))),
        ("Garage recommandé", get_data(claim, "garage_name")),
        ("Coût total estimé", f"{get_data(claim, 'total_cost', 0):.2f} MAD"),
    ]
    story.append(create_info_table(expertise_data, col_widths=[4 * cm, None]))

    story.append(NextPageTemplate("Main"))
    story.append(PageBreak())

    # --- Section Documents et OCR ---
    story.append(Paragraph("5. Documents et Données Extraites", styles["H1"]))
    documents = db.query(Document).filter(Document.sinistre_id == claim.id).all()
    if not documents:
        story.append(Paragraph("Aucun document associé à ce sinistre.", styles["BodyText"]))
    else:
        for doc in documents:
            story.append(Paragraph(f"Document : {doc.original_filename}", styles["H2"]))
            doc_data = [
                ("Type de document", doc.document_type),
                ("Statut du traitement", doc.processing_status),
                ("Date d'upload", format_date(doc.created_at)),
            ]
            story.append(create_info_table(doc_data, col_widths=[4 * cm, None]))
            if doc.ai_result:
                story.append(Paragraph("<b>Données brutes extraites (IA) :</b>", styles["BodyText"]))
                story.append(Paragraph(str(doc.ai_result), styles["Json"]))
            story.append(Spacer(1, 0.5 * cm))


    # --- Conclusion ---
    story.append(Paragraph("6. Conclusion", styles["H1"]))
    story.append(Paragraph(f"Ce rapport a été généré automatiquement par la plateforme AssurAuto le {format_date(datetime.now())}. Toutes les informations présentées sont basées sur les données saisies par l'utilisateur et extraites des documents fournis.", styles["BodyText"]))

    # --- Build PDF ---
    pdf_doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes