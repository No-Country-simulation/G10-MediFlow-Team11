import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.schemas.responses import AIProcessingResponse


def valid_response_payload() -> dict:
    return {
        "documento_id": "DOC-CLIN-001",
        "clasificacion": {
            "tipo_documento": "RECETA",
            "especialidad": "Medicina general",
            "nivel_prioridad": "RUTINA",
        },
        "confianza": {
            "clasificacion": 0.95,
            "extraccion": 0.90,
            "global": 0.92,
        },
        "datos_extraidos": {
            "paciente": {
                "nombre": "Ana Torres",
                "edad": 42,
            },
            "medico_solicitante": {
                "nombre": "Dra. Laura Gómez",
                "matricula": "MP-12345",
            },
            "diagnostico_principal": "Infección respiratoria",
            "cie10_sugerido": "J06.9",
            "medicamentos": [
                {
                    "nombre": "Amoxicilina",
                    "dosis": "500 mg cada 8 horas",
                }
            ],
        },
        "validacion": {
            "campos_faltantes": [],
            "inconsistencias": [],
            "advertencias": [],
        },
        "decision_enrutamiento": {
            "destino_principal": "FARMACIA",
            "audit_reasons": [],
            "justificacion": "Receta válida para dispensación.",
        },
    }


def test_accepts_and_serializes_complete_response() -> None:
    response = AIProcessingResponse.model_validate(valid_response_payload())

    serialized = response.model_dump(mode="json", by_alias=True)

    assert serialized["confianza"]["global"] == 0.92
    assert serialized["decision_enrutamiento"]["destino_principal"] == "FARMACIA"


def test_rejects_confidence_above_one() -> None:
    payload = valid_response_payload()
    payload["confianza"]["global"] = 1.1

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


@pytest.mark.parametrize("invalid_confidence", [True, "0.92"])
def test_rejects_non_numeric_confidence(
    invalid_confidence: object,
) -> None:
    payload = valid_response_payload()
    payload["confianza"]["global"] = invalid_confidence

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_negative_patient_age() -> None:
    payload = valid_response_payload()
    payload["datos_extraidos"]["paciente"]["edad"] = -1

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_unknown_document_type() -> None:
    payload = valid_response_payload()
    payload["clasificacion"]["tipo_documento"] = "HISTORIA_MEDICA"

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_technical_audit_reason() -> None:
    payload = valid_response_payload()
    payload["decision_enrutamiento"]["audit_reasons"] = ["AI_TIMEOUT"]

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_response_without_required_block() -> None:
    payload = valid_response_payload()
    del payload["validacion"]

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_rejects_unknown_top_level_response_field() -> None:
    payload = valid_response_payload()
    payload["status"] = "PROCESSED"

    with pytest.raises(ValidationError):
        AIProcessingResponse.model_validate(payload)


def test_allows_additional_extracted_data_by_document_type() -> None:
    payload = valid_response_payload()
    payload["datos_extraidos"]["resultado_estudio"] = "Sin hallazgos críticos."

    response = AIProcessingResponse.model_validate(payload)

    assert response.datos_extraidos.model_dump()["resultado_estudio"] == (
        "Sin hallazgos críticos."
    )