import unittest

from app.services.gemini_processor import ExtractedDocument


class ExtractedDocumentNormalizationTest(unittest.TestCase):
    def test_damaged_parts_accepts_dict_mapping_from_gemini(self):
        payload = {
            "document_type": "constat",
            "confidence": 0.91,
            "name": "Test User",
            "cin_number": "AB123456",
            "vehicle": "AB-123-CD",
            "accident_summary": "Accident avec impacts frontaux et latéraux.",
            "damage_level": "moderate",
            "damaged_parts": {
                "vehicle_A": ["Choc avant", "Pare-brise", "Phare avant gauche"],
                "vehicle_B": ["Portière arrière droite"],
            },
            "repair_items": ["Remplacement pare-brise"],
            "raw_fields": {},
        }

        document = ExtractedDocument.model_validate(payload)

        self.assertEqual(
            document.damaged_parts,
            ["Choc avant", "Pare-brise", "Phare avant gauche", "Portière arrière droite"],
        )
        self.assertEqual(document.repair_items, ["Remplacement pare-brise"])

    def test_confidence_accepts_text_labels_from_gemini(self):
        payload = {
            "document_type": "constat",
            "confidence": "high",
            "raw_fields": {
                "heure": "17:30",
                "conducteur_a": "PIERROT JOSIANE, FE 565 YQ",
                "conducteur_b": "GARCIA FERNANDEZ DEBORAH, G.0.73.0.2G",
                "assureur_a": "MACIF",
                "assureur_b": "AIG Europe SA",
                "croquis": "Oui",
            },
        }

        document = ExtractedDocument.model_validate(payload)

        self.assertEqual(document.confidence, 0.9)
        self.assertEqual(document.raw_fields["heure"], "17:30")


if __name__ == "__main__":
    unittest.main()
