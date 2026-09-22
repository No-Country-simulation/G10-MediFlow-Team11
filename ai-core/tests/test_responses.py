import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.schemas.responses import AIProcessingResponse


def valid_response_payload() -> dict:
    return {
        "document_id": "DOC-CLIN-001",
        "classification": {
            "document_type": "PRESCRIPTION",
            "specialty": "Medicina general",
            "priority_level": "ROUTINE",
        },
        "confidence": {
            "classification": 0.95,
            "extraction": 0.90,
            "global": 0.92,
        },
        "extracted_data": {
            "patient": {
                "name": "Ana Torres",
                "age": 42,
            },
            "requesting_doctor": {
                "name": "Dra. Laura Gómez",
                "license_number": "MP-12345",
            },
            "primary_diagnosis": "Infección respiratoria",
            "suggested_icd10": "J06.9",
            "medications": [
                {
                    "name": "Amoxicilina",
                    "dosage": "500 mg cada 8 horas",
                }
            ],
        },
        "validation": {
            "missing_fields": [],
            "inconsistencies": [],
            "warnings": [],
        },
        "routing_decision": {
            "primary_destination": "PHARMACY",
            "audit_reasons": [],
            "justification": "Receta válida para dispensación.",
        },
    }


def test_accepts_and_serializes_complete_response() -> None:
    response = AIProcessingResponse.model_validate(valid_response_payload())

    serialized = response.model_dump(mode="json", by_alias=True)

    assert serialized["confidence"]["global"] == 0.92
    assert serialized["routing_decision"]["primary_destination"] == "PHARMACY"


def test_rejects_confidence_above_one() -> None:
    payload = valid_response_payload()
    payload["confidence"]["global"] = 1.1

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


@pytest.mark.parametrize("invalid_confidence", [True, "0.92"])
def test_rejects_non_numeric_confidence(
    invalid_confidence: object,
) -> None:
    payload = valid_response_payload()
    payload["confidence"]["global"] = invalid_confidence

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_negative_patient_age() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["patient"]["age"] = -1

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_unknown_document_type() -> None:
    payload = valid_response_payload()
    payload["classification"]["document_type"] = "HISTORIA_MEDICA"

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_technical_audit_reason() -> None:
    payload = valid_response_payload()
    payload["routing_decision"]["audit_reasons"] = ["AI_TIMEOUT"]

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_response_without_required_block() -> None:
    payload = valid_response_payload()
    del payload["validation"]

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_unknown_top_level_response_field() -> None:
    payload = valid_response_payload()
    payload["status"] = "PROCESSED"

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_allows_additional_extracted_data_by_document_type() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["resultado_estudio"] = "Sin hallazgos críticos."

    response = AIProcessingResponse.model_validate(payload)

    assert response.extracted_data.model_dump()["resultado_estudio"] == (
        "Sin hallazgos críticos."
    )