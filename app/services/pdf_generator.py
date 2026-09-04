from __future__ import annotations

import io
from datetime import date, datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Document, Sinistre

# ── Palette de marque (alignee sur le design system frontend-next) ──────────
# Ces valeurs correspondent aux tokens --c-brand-* / --c-ink* utilises par
# l'application web, afin que le PDF et l'interface partagent la meme identite.
PALETTE: dict[str, str] = {
    "brand": "#4F6EF7",
    "brand_dark": "#3347C2",
    "brand_light": "#EEF1FF",
    "ink": "#111827",
    "ink_muted": "#4B5567",
    "line": "#DCE1EE",
    "surface": "#FFFFFF",
    "surface_muted": "#F4F6FB",
    "success": "#10B981",
    "warning": "#F59E0B",
    "danger": "#EF4444",
    "slate": "#64748B",
}

STATUS_LABELS: dict[str, tuple[str, str]] = {
    "DECLARED": ("Declare", PALETTE["slate"]),
    "UNDER_REVIEW": ("En cours d'examen", PALETTE["brand"]),
    "DOCUMENTS_PENDING": ("Documents en attente", PALETTE["warning"]),
    "APPROVED": ("Approuve", PALETTE["success"]),
    "REJECTED": ("Rejete", PALETTE["danger"]),
    "CLOSED": ("Cloture", PALETTE["ink_muted"]),
}

DOCUMENT_TYPE_LABELS: dict[str, str] = {
    "cin": "CIN / Passeport",
    "domicile": "Justificatif de domicile",
    "cg": "Carte grise",
    "carte_grise": "Carte grise",
    "permis": "Permis de conduire",
    "ct": "Controle technique",
    "att": "Attestation d'assurance",
    "attestation": "Attestation d'assurance",
    "facture": "Facture d'achat",
    "facture_achat": "Facture d'achat",
    "constat": "Constat amiable",
    "pv": "Rapport de police / Expertise",
    "accidents": "Photos de l'accident",
    "accident": "Photos de l'accident",
    "accident_photo": "Photos de l'accident",
    "accident_photos": "Photos de l'accident",
    "repair_invoice": "Facture de reparation",
    "facture_reparation": "Facture de reparation",
    "devis": "Devis de reparation",
    "invoice": "Facture",
}

PROCESSING_LABELS: dict[str, str] = {
    "PENDING": "En attente de traitement",
    "PROCESSING": "Traitement en cours",
    "COMPLETED": "Traite avec succes",
    "FAILED": "Echec du traitement",
}


# --- Helpers ---

def get_data(obj: Any, key: str, default: Any = "N/A") -> Any:
    """Accede de maniere securisee aux attributs ou aux cles de metadata_."""
    if hasattr(obj, key):
        value = getattr(obj, key)
        if value is not None:
            return value

    metadata = getattr(obj, "metadata_", None)

    if isinstance(metadata, dict):
        return metadata.get(key, default)

    return default


def format_date(dt: Any, default: str = "Non renseignee") -> str:
    """Formate un objet date ou datetime en chaine de caracteres lisible."""

    if dt is None:
        return default

    if isinstance(dt, str):
        text = dt.strip()
        if not text:
            return default
        # A plain "YYYY-MM-DD" string (e.g. a birth date) should stay a date,
        # not gain a spurious 00:00 time from fromisoformat().
        if len(text) == 10 and text[4:5] == "-" and text[7:8] == "-":
            try:
                return datetime.strptime(text, "%Y-%m-%d").strftime("%d/%m/%Y")
            except ValueError:
                pass
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return text or default

    if isinstance(dt, datetime):
        return dt.strftime("%d/%m/%Y a %H:%M")

    if isinstance(dt, date):
        return dt.strftime("%d/%m/%Y")

    return default


def format_currency(value: Any, default: str = "Non estime") -> str:
    """Formate un montant en MAD avec separateur de milliers de style FR."""
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return default
    formatted = f"{amount:,.2f}".replace(",", " ").replace(".", ",")
    return f"{formatted} MAD"


def humanize_label(value: str) -> str:
    return value.replace("_", " ").strip().capitalize()


def resolve_logo_path() -> Path | None:
    """Locate the AssurAuto logo, reusing the same file the web app serves.

    Checked in order: an explicit ``LOGO_PATH`` setting, then the app's own
    ``frontend-next/public/logo.jpeg`` (and a .png fallback) relative to the
    project root. Returns ``None`` if nothing is found so the report still
    renders cleanly without a logo.
    """
    candidates: list[Path] = []
    configured = getattr(settings, "logo_path", None)
    if configured:
        candidates.append(Path(configured))

    project_root = Path(__file__).resolve().parent.parent.parent
    candidates.append(project_root / "frontend-next" / "public" / "logo.jpeg")
    candidates.append(project_root / "frontend-next" / "public" / "logo.png")
    candidates.append(project_root / "frontend" / "public" / "logo.jpeg")

    for candidate in candidates:
        try:
            if candidate.is_file():
                return candidate
        except OSError:
            continue
    return None


def create_info_table(data: list[tuple[str, Any]], col_widths: list) -> Table:
    """Cree un tableau d'informations a deux colonnes, cle en surbrillance."""
    rows = []
    for label, value in data:
        display_value = "Non renseigne" if value in (None, "", []) else str(value)
        rows.append(
            [
                Paragraph(f"<b>{label}</b>", styles["Label"]),
                Paragraph(display_value, styles["Value"]),
            ]
        )
    table = Table(rows, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(PALETTE["brand_light"])),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor(PALETTE["line"])),
                ("LEFTPADDING", (0, 0), (0, -1), 10),
                ("RIGHTPADDING", (0, 0), (0, -1), 10),
                ("LEFTPADDING", (1, 0), (1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def create_section_header(number: str, title: str, subtitle: str | None = None) -> list:
    """En-tete de section : pastille numerotee de couleur + titre + filet."""
    badge = Paragraph(number, styles["SectionBadge"])
    heading_cell: Any = Paragraph(title, styles["H1"])
    if subtitle:
        heading_cell = [Paragraph(title, styles["H1"]), Paragraph(subtitle, styles["SectionSubtitle"])]

    table = Table([[badge, heading_cell]], colWidths=[1.1 * cm, None])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor(PALETTE["brand"])),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 0),
                ("LEFTPADDING", (1, 0), (1, 0), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return [
        table,
        HRFlowable(
            width="100%",
            thickness=1,
            color=colors.HexColor(PALETTE["line"]),
            spaceBefore=4,
            spaceAfter=10,
        ),
    ]


def create_status_chip(status_value: Any) -> Table | None:
    if status_value in (None, ""):
        return None
    key = str(getattr(status_value, "value", status_value)).upper()
    label, color = STATUS_LABELS.get(key, (humanize_label(str(status_value)), PALETTE["slate"]))
    chip = Table([[Paragraph(label.upper(), styles["StatusChip"])]], colWidths=[None])
    chip.hAlign = "LEFT"
    chip.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(color)),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return chip


def build_document_card(document: Document) -> Table:
    """Construit un bloc encadre ('carte') presentant un document et son IA."""
    inner: list[Any] = [Paragraph(document.original_filename, styles["DocCardTitle"])]

    doc_type_label = DOCUMENT_TYPE_LABELS.get(
        document.document_type, humanize_label(document.document_type)
    )
    status_key = str(getattr(document, "processing_status", "") or "")
    status_label = PROCESSING_LABELS.get(status_key, humanize_label(status_key) or "Statut inconnu")

    doc_data = [
        ("Type de piece", doc_type_label),
        ("Statut du traitement IA", status_label),
        ("Date de depot", format_date(getattr(document, "created_at", None))),
    ]
    inner.append(Spacer(1, 0.15 * cm))
    inner.append(create_info_table(doc_data, col_widths=[4.5 * cm, None]))

    if document.ai_result:
        inner.append(Spacer(1, 0.25 * cm))
        inner.append(Paragraph("Donnees extraites automatiquement (intelligence artificielle)", styles["Label"]))
        inner.append(Spacer(1, 0.1 * cm))
        inner.append(Paragraph(str(document.ai_result), styles["Json"]))

    if getattr(document, "processing_error", None):
        inner.append(Spacer(1, 0.2 * cm))
        inner.append(Paragraph(f"Erreur signalee : {document.processing_error}", styles["ErrorNote"]))

    card = Table([[inner]], colWidths=[None])
    card.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor(PALETTE["line"])),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return card


# --- Styles ---


def get_stylesheet() -> StyleSheet1:
    """Definit les styles de paragraphes du rapport, alignes sur la marque."""
    stylesheet = StyleSheet1()
    stylesheet.add(
        ParagraphStyle(
            name="Eyebrow",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor(PALETTE["brand"]),
            spaceAfter=4,
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="Title",
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=26,
            alignment=TA_LEFT,
            textColor=colors.HexColor(PALETTE["ink"]),
            spaceAfter=8,
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="Intro",
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            alignment=TA_JUSTIFY,
            textColor=colors.HexColor(PALETTE["ink_muted"]),
            spaceAfter=10,
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="StatusChip",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="Footer",
            fontName="Helvetica",
            fontSize=8,
            textColor=colors.HexColor(PALETTE["ink_muted"]),
            alignment=TA_CENTER,
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=17,
            textColor=colors.HexColor(PALETTE["ink"]),
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="SectionSubtitle",
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor(PALETTE["ink_muted"]),
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="SectionBadge",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=22,
            alignment=TA_CENTER,
            textColor=colors.white,
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="Label",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor(PALETTE["brand_dark"]),
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="Value",
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor(PALETTE["ink"]),
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="BodyText",
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            alignment=TA_LEFT,
            textColor=colors.HexColor(PALETTE["ink"]),
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="DocCardTitle",
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor(PALETTE["brand_dark"]),
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="ErrorNote",
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor(PALETTE["danger"]),
        )
    )
    stylesheet.add(
        ParagraphStyle(
            name="Json",
            fontName="Courier",
            fontSize=7.5,
            leading=10,
            leftIndent=2,
            wordWrap="CJK",
            backColor=colors.HexColor(PALETTE["surface_muted"]),
            borderColor=colors.HexColor(PALETTE["line"]),
            borderWidth=0.5,
            borderPadding=6,
            borderRadius=3,
            textColor=colors.HexColor(PALETTE["ink_muted"]),
        )
    )
    return stylesheet


styles = get_stylesheet()


# --- En-tete et pied de page ---


class ReportDocTemplate(BaseDocTemplate):
    """Gabarit de document avec en-tete (logo + marque) et pied de page."""

    def __init__(self, filename, **kw):
        super().__init__(filename, **kw)
        self.logo_path = resolve_logo_path()
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
        page_width, page_height = doc.pagesize
        top_y = page_height - 1.15 * cm
        text_x = doc.leftMargin

        if self.logo_path is not None:
            try:
                logo_size = 1.2 * cm
                canvas.drawImage(
                    str(self.logo_path),
                    doc.leftMargin,
                    top_y - logo_size + 0.2 * cm,
                    width=logo_size,
                    height=logo_size,
                    preserveAspectRatio=True,
                    mask="auto",
                )
                text_x = doc.leftMargin + logo_size + 0.35 * cm
            except Exception:
                text_x = doc.leftMargin

        canvas.setFillColor(colors.HexColor(PALETTE["brand_dark"]))
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(text_x, top_y - 0.35 * cm, "AssurAuto Pro")

        canvas.setFillColor(colors.HexColor(PALETTE["ink_muted"]))
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(text_x, top_y - 0.72 * cm, "Plateforme de gestion des sinistres automobile")

        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(
            page_width - doc.rightMargin,
            top_y - 0.35 * cm,
            f"Genere le {datetime.now().strftime('%d/%m/%Y a %H:%M')}",
        )

        canvas.setStrokeColor(colors.HexColor(PALETTE["brand"]))
        canvas.setLineWidth(1.5)
        rule_y = top_y - 1.35 * cm
        canvas.line(doc.leftMargin, rule_y, page_width - doc.rightMargin, rule_y)
        canvas.restoreState()

    def _footer(self, canvas, doc):
        canvas.saveState()
        page_width, _ = doc.pagesize
        canvas.setStrokeColor(colors.HexColor(PALETTE["line"]))
        canvas.setLineWidth(0.6)
        rule_y = doc.bottomMargin - 0.35 * cm
        canvas.line(doc.leftMargin, rule_y, page_width - doc.rightMargin, rule_y)

        canvas.setFillColor(colors.HexColor(PALETTE["ink_muted"]))
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(doc.leftMargin, rule_y - 0.3 * cm, "AssurAuto Pro \u2014 Document confidentiel, a usage interne")
        canvas.drawRightString(page_width - doc.rightMargin, rule_y - 0.3 * cm, f"Page {doc.page}")
        canvas.restoreState()


# --- Generation des sections ---


async def generate_claim_report(claim: Sinistre, db: Session) -> bytes:
    """Genere le rapport PDF complet, mis en forme, pour un sinistre."""
    buffer = io.BytesIO()
    pdf_doc = ReportDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=3 * cm,
        bottomMargin=2.2 * cm,
    )

    story: list[Any] = []

    # --- Bandeau de titre ---
    story.append(Paragraph(f"DOSSIER N&deg; {claim.claim_number}", styles["Eyebrow"]))
    story.append(Paragraph("Rapport de Sinistre Automobile", styles["Title"]))
    status_chip = create_status_chip(getattr(claim, "status", None))
    if status_chip is not None:
        story.append(status_chip)
        story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "Cette synthese reunit les informations du client et du vehicule assure, les "
            "circonstances declarees de l'accident, ainsi que les donnees extraites "
            "automatiquement par intelligence artificielle a partir des pieces transmises. "
            "Elle est destinee a faciliter l'instruction et le suivi du dossier.",
            styles["Intro"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    # --- Section 1 : Client ---
    story.extend(create_section_header("01", "Informations Client"))
    client = claim.client
    client_data = [
        ("Nom complet", client.full_name),
        ("N\u00b0 CIN / Passeport", client.cin_number),
        ("Telephone", client.phone),
        ("Adresse e-mail", client.email),
        ("Adresse postale", client.address),
        ("Date de naissance", format_date(get_data(client, "birth_date", None))),
    ]
    story.append(create_info_table(client_data, col_widths=[4.5 * cm, None]))
    story.append(Spacer(1, 0.5 * cm))

    # --- Section 2 : Vehicule ---
    story.extend(create_section_header("02", "Vehicule Assure"))
    vehicle = claim.vehicle
    vehicle_data = [
        ("Immatriculation", vehicle.registration_number),
        ("Marque & modele", f"{vehicle.make or ''} {vehicle.model or ''}".strip() or None),
        ("N\u00b0 de chassis (VIN)", vehicle.vin),
        ("Annee de mise en circulation", vehicle.year),
        ("Usage declare", vehicle.usage),
        ("Type d'energie", get_data(vehicle, "fuel_type", None)),
    ]
    story.append(create_info_table(vehicle_data, col_widths=[4.5 * cm, None]))
    story.append(Spacer(1, 0.5 * cm))

    # --- Section 3 : Circonstances ---
    story.extend(create_section_header("03", "Circonstances du Sinistre"))
    claim_data = [
        ("Reference du dossier", claim.claim_number),
        ("Date de l'accident", format_date(claim.accident_date)),
        ("Lieu de l'accident", claim.location),
    ]
    story.append(create_info_table(claim_data, col_widths=[4.5 * cm, None]))
    story.append(Spacer(1, 0.25 * cm))
    story.append(Paragraph("Description des faits", styles["Label"]))
    story.append(Spacer(1, 0.1 * cm))
    story.append(Paragraph(claim.description or "Aucune description fournie a ce jour.", styles["BodyText"]))
    story.append(Spacer(1, 0.5 * cm))

    # --- Section 4 : Analyse IA ---
    story.extend(
        create_section_header(
            "04",
            "Analyse Automatisee par Intelligence Artificielle",
            subtitle="Donnees extraites des pieces jointes \u2014 a verifier par un gestionnaire avant validation.",
        )
    )
    damaged_parts = get_data(claim, "damaged_parts", []) or []
    expertise_data = [
        ("Niveau de dommages estime", get_data(claim, "damage_level", None)),
        ("Pieces endommagees identifiees", ", ".join(damaged_parts) if damaged_parts else None),
        ("Garage recommande", get_data(claim, "garage_name", None)),
        ("Cout total estime", format_currency(get_data(claim, "total_cost", None))),
    ]
    story.append(create_info_table(expertise_data, col_widths=[4.5 * cm, None]))

    story.append(NextPageTemplate("Main"))
    story.append(PageBreak())

    # --- Section 5 : Documents ---
    story.extend(create_section_header("05", "Pieces Justificatives du Dossier"))
    documents = db.query(Document).filter(Document.sinistre_id == claim.id).all()
    if not documents:
        story.append(Paragraph("Aucune piece justificative n'a ete deposee pour ce dossier a ce jour.", styles["BodyText"]))
    else:
        for index, document in enumerate(documents):
            story.append(build_document_card(document))
            if index < len(documents) - 1:
                story.append(Spacer(1, 0.35 * cm))

    story.append(Spacer(1, 0.6 * cm))

    # --- Section 6 : Synthese ---
    story.extend(create_section_header("06", "Synthese & Validation"))
    story.append(
        Paragraph(
            f"Ce rapport a ete genere automatiquement par la plateforme AssurAuto Pro le "
            f"{format_date(datetime.now())}. Il compile les informations saisies par les "
            f"equipes ainsi que les donnees extraites par le moteur d'intelligence "
            f"artificielle a partir des documents transmis. Une verification manuelle des "
            f"elements extraits automatiquement est recommandee avant toute decision "
            f"d'indemnisation.",
            styles["BodyText"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "Document genere electroniquement \u2014 ne necessite pas de signature manuscrite.",
            styles["SectionSubtitle"],
        )
    )

    # --- Construction du PDF ---
    pdf_doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
