import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.main import app, get_pipeline
from app.services.gemini_processor import AIOutputInvalidError


@pytest.fixture
def client():
	with TestClient(app) as test_client:
		yield test_client
	app.dependency_overrides.clear()


def valid_request() -> dict:
	return {
		"document_id": "DOC-CLIN-001",
		"input_type": "TEXT",
		"mime_type": "text/plain",
		"document_text": "Solicito hemograma.",
		"origin_channel": "Guardia",
	}


def valid_response() -> dict:
	return {
		"document_id": "DOC-CLIN-001",
		"classification": {
			"document_type": "PRESCRIPTION",
			"specialty": "Medicina general",
			"priority_level": "ROUTINE",
		},
		"confidence": {
			"classification": 0.95,
			"extraction": 0.9,
			"global": 0.92,
		},
		"extracted_data": {"requested_studies": []},
		"validation": {"missing_fields": [], "inconsistencies": [], "warnings": []},
		"routing_decision": {
			"primary_destination": "PHARMACY",
			"audit_reasons": [],
			"justification": "Receta válida para dispensación.",
		},
	}


class FakePipeline:
	def __init__(self, result: dict | Exception) -> None:
		self.result = result

	def process(self, request: object) -> dict:
		if isinstance(self.result, Exception):
			raise self.result
		return self.result


def test_process_endpoint_returns_contract_without_backend_fields(client) -> None:
	app.dependency_overrides[get_pipeline] = lambda: FakePipeline(valid_response())

	response = client.post("/api/v1/ai/process", json=valid_request())

	assert response.status_code == 200
	payload = response.json()
	assert payload["extracted_data"]["requested_studies"] == []
	assert "status" not in payload
	assert "requires_human_review" not in payload["routing_decision"]
	assert "INVALID_AI_RESPONSE" not in payload["routing_decision"]["audit_reasons"]


def test_process_endpoint_maps_structural_ai_failure_to_502(client) -> None:
	app.dependency_overrides[get_pipeline] = lambda: FakePipeline(
		AIOutputInvalidError("bad model output")
	)

	response = client.post("/api/v1/ai/process", json=valid_request())

	assert response.status_code == 502
	assert response.json() == {
		"error": {
			"code": "AI_OUTPUT_INVALID",
			"message": "No se pudo producir una respuesta estructurada válida.",
		}
	}


def test_process_endpoint_returns_400_for_invalid_request(client) -> None:
	response = client.post("/api/v1/ai/process", json={"document_id": "DOC-1"})

	assert response.status_code == 400
	assert response.json()["error"]["code"] == "INVALID_REQUEST"