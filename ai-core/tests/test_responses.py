import json
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

    serialized = json.loads(response.model_dump_json(by_alias=True))

    assert serialized["confidence"]["global"] == 0.92
    assert "global_" not in serialized["confidence"]
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


def test_accepts_non_negative_patient_age() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["patient"]["age"] = 0

    response = AIProcessingResponse.model_validate(payload)

    assert response.extracted_data.patient.age == 0


@pytest.mark.parametrize("invalid_age", [True, "42", -1])
def test_rejects_invalid_patient_age(invalid_age: object) -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["patient"]["age"] = invalid_age

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_accepts_null_patient_age() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["patient"]["age"] = None

    response = AIProcessingResponse.model_validate(payload)

    assert response.extracted_data.patient.age is None


def test_rejects_global_field_name_as_input_key() -> None:
    payload = valid_response_payload()
    payload["confidence"]["global_"] = payload["confidence"].pop("global")

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


@pytest.mark.parametrize(
    "block, field",
    [
        ("validation", "missing_fields"),
        ("validation", "inconsistencies"),
        ("validation", "warnings"),
        ("routing_decision", "audit_reasons"),
    ],
)
def test_rejects_missing_required_arrays(block: str, field: str) -> None:
    payload = valid_response_payload()
    del payload[block][field]

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_unknown_document_type() -> None:
    payload = valid_response_payload()
    payload["classification"]["document_type"] = "HISTORIA_MEDICA"

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


@pytest.mark.parametrize(
    "field, obsolete_value",
    [
        ("document_type", "RECETA"),
        ("document_type", "INFORME_IMAGENES"),
        ("primary_destination", "EMERGENCIA_MEDICA"),
        ("primary_destination", "HISTORIA_CLINICA"),
    ],
)
def test_rejects_obsolete_spanish_contract_values(
    field: str,
    obsolete_value: str,
) -> None:
    payload = valid_response_payload()
    if field == "document_type":
        payload["classification"][field] = obsolete_value
    else:
        payload["routing_decision"][field] = obsolete_value

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


@pytest.mark.parametrize(
    "document_type, destination",
    [
        ("PRESCRIPTION", "PHARMACY"),
        ("IMAGING_REPORT", "MEDICAL_EMERGENCY"),
        ("STUDY_REPORT", "MEDICAL_RECORD"),
        ("PROCEDURE_ORDER", "AUTHORIZATION_AUDIT"),
        ("DISCHARGE_SUMMARY", "HUMAN_REVIEW"),
        ("MEDICAL_CERTIFICATE", "PHARMACY"),
    ],
)
def test_accepts_current_contract_enum_values(
    document_type: str,
    destination: str,
) -> None:
    payload = valid_response_payload()
    payload["classification"]["document_type"] = document_type
    payload["routing_decision"]["primary_destination"] = destination

    response = AIProcessingResponse.model_validate(payload)

    assert response.classification.document_type.value == document_type
    assert response.routing_decision.primary_destination.value == destination


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
    payload["extracted_data"]["study_result"] = "Sin hallazgos críticos."

    response = AIProcessingResponse.model_validate(payload)

    assert response.extracted_data.model_dump()["study_result"] == (
        "Sin hallazgos críticos."
    )


def test_accepts_omitted_requested_studies() -> None:
    response = AIProcessingResponse.model_validate(valid_response_payload())

    assert response.extracted_data.requested_studies is None


def test_accepts_null_requested_studies() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["requested_studies"] = None

    response = AIProcessingResponse.model_validate(payload)

    assert response.extracted_data.requested_studies is None


def test_accepts_empty_requested_studies() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["requested_studies"] = []

    response = AIProcessingResponse.model_validate(payload)

    assert response.extracted_data.requested_studies == []


@pytest.mark.parametrize(
    "study, expected_name",
    [
        ({"name": "Radiografía de tórax"}, "Radiografía de tórax"),
        ({"name": None}, None),
        ({}, None),
    ],
)
def test_accepts_requested_study_with_optional_name(
    study: dict[str, str | None],
    expected_name: str | None,
) -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["requested_studies"] = [study]

    response = AIProcessingResponse.model_validate(payload)

    assert response.extracted_data.requested_studies is not None
    assert response.extracted_data.requested_studies[0].name == expected_name


def test_rejects_requested_studies_as_list_of_strings() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["requested_studies"] = [
        "Radiografía de tórax",
        "Hemograma completo",
    ]

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_round_trips_requested_studies_as_json() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["requested_studies"] = [
        {"name": "Radiografía de tórax"},
        {"name": "Hemograma completo"},
    ]

    response = AIProcessingResponse.model_validate(payload)
    serialized = response.model_dump_json(by_alias=True)
    restored = AIProcessingResponse.model_validate_json(serialized)

    assert [
        study.name for study in restored.extracted_data.requested_studies or []
    ] == ["Radiografía de tórax", "Hemograma completo"]
