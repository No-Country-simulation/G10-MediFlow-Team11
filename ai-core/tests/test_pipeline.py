from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_process_text_success_pipeline():
    mock_ai_output = {
        "classification": {
            "document_type": "PRESCRIPTION",
            "specialty": "Cardiología",
            "priority_level": "ROUTINE",
        },
        "confidence": {
            "classification": 0.95,
            "extraction": 0.90,
        },
        "extracted_data": {
            "patient": {"name": "Juan Perez", "age": 45},
            "requesting_doctor": {"name": "Dr. House", "license_number": "MED123"},
            "primary_diagnosis": "Hipertensión",
            "suggested_icd10": "I10",
            "medications": [{"name": "Losartan", "dosage": "50mg"}],
            "requested_studies": [],
        },
        "validation": {
            "missing_fields": [],
            "inconsistencies": [],
            "warnings": [],
        },
        "routing_decision": {
            "primary_destination": "PHARMACY",
            "justification": "Receta de rutina completa emitida por especialista.",
        },
    }

    with patch("app.main.gemini_client.analyze", new_callable=AsyncMock) as mock_gemini:
        mock_gemini.return_value = mock_ai_output

        payload = {
            "document_id": "DOC-TEST-001",
            "input_type": "TEXT",
            "mime_type": "text/plain",
            "document_text": "Receta médica para Juan Perez...",
            "origin_channel": "Web_Portal",
        }

        response = client.post("/api/v1/ai/process", json=payload)
        assert response.status_code == 200, f"Error: {response.text}"
        data = response.json()
        assert data["document_id"] == "DOC-TEST-001"
        assert data["classification"]["document_type"] == "PRESCRIPTION"
        assert data["routing_decision"]["primary_destination"] == "PHARMACY"
        assert data["confidence"]["global"] >= 0.85


def test_process_failure_returns_502():
    with patch("app.main.gemini_client.analyze", new_callable=AsyncMock) as mock_gemini:
        mock_gemini.side_effect = RuntimeError("Gemini unreachable")

        payload = {
            "document_id": "DOC-TEST-002",
            "input_type": "TEXT",
            "mime_type": "text/plain",
            "document_text": "Prueba de error",
            "origin_channel": "Web_Portal",
        }

        response = client.post("/api/v1/ai/process", json=payload)
        assert response.status_code == 502
        data = response.json()
        assert data["error"]["code"] == "AI_OUTPUT_INVALID"