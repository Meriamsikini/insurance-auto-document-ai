import unittest
from unittest.mock import MagicMock, patch, call
from app.services.document_processor import _apply_ai_result_to_vehicle, _apply_ai_result_to_client
from app.services.pipeline import process_uploaded_document
from app.models import Document, Vehicle, Client


class VehicleMetadataPersistenceTest(unittest.TestCase):
    def test_permis_metadata_extraction_and_persistence(self):
        """Test that permis AI results are extracted and persisted to vehicle.metadata_."""
        # Mock database session
        mock_db = MagicMock()

        # Create mock vehicle
        mock_vehicle = MagicMock(spec=Vehicle)
        mock_vehicle.id = 1
        mock_vehicle.metadata_ = {}
        mock_db.get.return_value = mock_vehicle

        # Create mock document
        mock_document = MagicMock(spec=Document)
        mock_document.id = 123
        mock_document.vehicle_id = 1
        mock_document.document_type = "permis"

        # AI result from Gemini
        ai_result = {
            "document_type": "permis",
            "name": "JEAN PAUL DUPONT",
            "confidence": 0.95,
            "raw_fields": {
                "nom": "JEAN PAUL DUPONT",
                "numero permis": "1234567890",
                "categories": "B, BE, E",
                "autorite": "Prefecture de Paris",
                "date delivrance": "2015-03-15",
                "date expiration": "2025-03-15",
            },
        }

        # Call the persistence function
        _apply_ai_result_to_vehicle(mock_db, mock_document, ai_result)

        # Verify vehicle.metadata_ was updated with permis data
        self.assertIn("permis", mock_vehicle.metadata_)
        permis_meta = mock_vehicle.metadata_["permis"]
        self.assertEqual(permis_meta["conducteur"], "JEAN PAUL DUPONT")
        self.assertEqual(permis_meta["numero"], "1234567890")
        self.assertEqual(permis_meta["categories"], "B, BE, E")
        self.assertEqual(permis_meta["autorite"], "Prefecture de Paris")
        self.assertEqual(permis_meta["delivrance"], "2015-03-15")
        self.assertEqual(permis_meta["expiration"], "2025-03-15")

    def test_ct_metadata_extraction_and_persistence(self):
        """Test that CT (controle technique) AI results are persisted."""
        mock_db = MagicMock()
        mock_vehicle = MagicMock(spec=Vehicle)
        mock_vehicle.id = 2
        mock_vehicle.metadata_ = {}
        mock_db.get.return_value = mock_vehicle

        mock_document = MagicMock(spec=Document)
        mock_document.id = 456
        mock_document.vehicle_id = 2
        mock_document.document_type = "ct"

        ai_result = {
            "document_type": "ct",
            "confidence": 0.92,
            "raw_fields": {
                "date visite": "2024-06-15",
                "resultat": "Favorable",
                "date expiration": "2026-06-15",
                "kilometrage": "45000",
            },
        }

        _apply_ai_result_to_vehicle(mock_db, mock_document, ai_result)

        self.assertIn("ct", mock_vehicle.metadata_)
        ct_meta = mock_vehicle.metadata_["ct"]
        self.assertEqual(ct_meta["date_visite"], "2024-06-15")
        self.assertEqual(ct_meta["resultat"], "Favorable")
        self.assertEqual(ct_meta["expiration"], "2026-06-15")
        self.assertEqual(ct_meta["kilometrage"], "45000")

    def test_client_domicile_metadata_extraction_and_persistence(self):
        """Test that domicile AI results are persisted to client.metadata_."""
        mock_db = MagicMock()
        mock_client = MagicMock(spec=Client)
        mock_client.id = 5
        mock_client.metadata_ = {}
        mock_db.get.return_value = mock_client

        mock_document = MagicMock(spec=Document)
        mock_document.id = 789
        mock_document.client_id = 5
        mock_document.vehicle_id = None
        mock_document.sinistre_id = None
        mock_document.document_type = "domicile"

        ai_result = {
            "document_type": "domicile",
            "confidence": 0.88,
            "raw_fields": {
                "adresse": "123 Rue de la Paix, 75000 Paris",
                "emetteur": "EDF",
                "date": "2024-08-01",
            },
        }

        _apply_ai_result_to_client(mock_db, mock_document, ai_result)

        self.assertIn("domicile", mock_client.metadata_)
        domicile_meta = mock_client.metadata_["domicile"]
        self.assertEqual(domicile_meta["address"], "123 Rue de la Paix, 75000 Paris")
        self.assertEqual(domicile_meta["issuer"], "EDF")
        self.assertEqual(domicile_meta["date"], "2024-08-01")

    def test_constat_summary_sets_claim_description_but_accident_photo_stays_in_photo_comment(self):
        """Constat summaries should populate the declaration description; accident-photo summaries should only populate the photo comment."""
        mock_db = MagicMock()
        mock_claim = MagicMock()
        mock_claim.id = 99
        mock_claim.metadata_ = {}
        mock_claim.description = ""
        mock_db.get.return_value = mock_claim

        constat_document = MagicMock(spec=Document)
        constat_document.id = 321
        constat_document.sinistre_id = 99
        constat_document.document_type = "constat"

        constat_result = {
            "document_type": "constat",
            "accident_summary": "Le conducteur du véhicule A, PIERROT JOSIANE, n'a pas respecté un signal de priorité.",
            "raw_fields": {
                "lieu": "65600 GERAC",
                "date_accident": "2025-09-14",
                "heure": "17:30",
            },
        }

        photo_document = MagicMock(spec=Document)
        photo_document.id = 322
        photo_document.sinistre_id = 99
        photo_document.document_type = "accidents"

        photo_result = {
            "document_type": "accidents",
            "accident_summary": "La voiture a subi un impact latéral important sur le côté gauche.",
            "raw_fields": {
                "commentaire": "La voiture a subi un impact latéral important sur le côté gauche.",
            },
        }

        from app.services.document_processor import _apply_ai_result_to_claim
        _apply_ai_result_to_claim(mock_db, constat_document, constat_result)
        self.assertEqual(mock_claim.description, "Le conducteur du véhicule A, PIERROT JOSIANE, n'a pas respecté un signal de priorité.")

        _apply_ai_result_to_claim(mock_db, photo_document, photo_result)
        self.assertEqual(mock_claim.description, "Le conducteur du véhicule A, PIERROT JOSIANE, n'a pas respecté un signal de priorité.")
        self.assertIn("photos", mock_claim.metadata_)
        self.assertEqual(mock_claim.metadata_["photos"]["commentaire"], "La voiture a subi un impact latéral important sur le côté gauche.")

    def test_vehicle_metadata_not_updated_if_no_vehicle_id(self):
        """Test that vehicle metadata is not updated if document has no vehicle_id."""
        mock_db = MagicMock()
        mock_document = MagicMock(spec=Document)
        mock_document.vehicle_id = None

        result = _apply_ai_result_to_vehicle(mock_db, mock_document, {"raw_fields": {}})

        # Should return early without calling db.get
        mock_db.get.assert_not_called()

    def test_client_metadata_skipped_if_has_vehicle_id(self):
        """Test that client metadata is not persisted if document is linked to vehicle."""
        mock_db = MagicMock()
        mock_document = MagicMock(spec=Document)
        mock_document.client_id = 1
        mock_document.vehicle_id = 10
        mock_document.sinistre_id = None

        result = _apply_ai_result_to_client(mock_db, mock_document, {"raw_fields": {}})

        # Should return early without persisting
        mock_db.get.assert_not_called()

    @patch("app.services.pipeline.GeminiProcessor")
    def test_permis_document_uses_direct_image_extraction(self, mock_gemini_cls):
        """Permis images must be processed directly and never fall through OCR/classification to empty raw_fields."""
        mock_gemini = mock_gemini_cls.return_value
        mock_gemini.extract_from_image.return_value = {
            "document_type": "permis",
            "confidence": 0.96,
            "raw_fields": {
                "nom": "JEAN PAUL DUPONT",
                "numero permis": "1234567890",
                "categories": "B, BE",
                "autorite": "Prefecture de Paris",
                "date delivrance": "15/03/2021",
                "date expiration": "15/03/2031",
            },
        }

        mock_document = MagicMock(spec=Document)
        mock_document.file_path = "uploads/6/permis/OIP.jpg"
        mock_document.content_type = "image/jpeg"
        mock_document.document_type = "permis"

        with patch("pathlib.Path.read_bytes", return_value=b"image-bytes"):
            _, result = process_uploaded_document(mock_document)

        mock_gemini.extract_from_image.assert_called_once()
        self.assertEqual(result["document_type"], "permis")
        self.assertEqual(result["raw_fields"]["numero permis"], "1234567890")
        self.assertEqual(result["raw_fields"]["date expiration"], "2031-03-15")


if __name__ == "__main__":
    unittest.main()
