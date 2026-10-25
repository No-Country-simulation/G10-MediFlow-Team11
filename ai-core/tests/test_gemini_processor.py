import json
import sys
from pathlib import Path

import pytest
from google.genai.errors import APIError
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.config import Settings
from app.schemas.enums import SemanticAuditReason
from app.schemas.requests import ProcessingRequest
from app.schemas.responses import AIProcessingResponse
from app.services.gemini_processor import (
    AIOutputInvalidError,
    GeminiConfigurationError,
    GeminiProcessor,
    GeminiProviderError,
)


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
            "patient": {"name": "Ana Torres", "age": 42},
            "requested_studies": [{"name": "Hemograma"}],
            "study_result": "Sin hallazgos críticos.",
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


def text_request() -> ProcessingRequest:
    return ProcessingRequest(
        document_id="DOC-CLIN-001",
        input_type="TEXT",
        mime_type="text/plain",
        document_text="Solicito hemograma.",
        origin_channel="Guardia",
    )


def case_fixture(case_id: str, file_name: str) -> Path:
    return Path(__file__).parents[2] / "test-data" / "cases" / case_id / file_name


class FakeResponse:
    def __init__(self, parsed: object | None, text: str | None = None) -> None:
        self.parsed = parsed
        self.text = text


class FakeModels:
    def __init__(self, response: FakeResponse | Exception) -> None:
        self.response = response
        self.arguments: dict[str, object] | None = None

    def generate_content(self, **arguments: object) -> FakeResponse:
        self.arguments = arguments
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


class FakeClient:
    def __init__(self, response: FakeResponse | Exception) -> None:
        self.models = FakeModels(response)


def processor_for(
    response: FakeResponse | Exception,
) -> tuple[GeminiProcessor, FakeClient]:
    client = FakeClient(response)
    config = Settings(
        _env_file=None,
        gemini_api_key="test-key",
        gemini_model="test-model",
    )
    return GeminiProcessor(config=config, client=client), client


def test_processes_text_and_requests_contract_schema() -> None:
    payload = valid_response_payload()
    processor, client = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert isinstance(result, AIProcessingResponse)
    assert result.extracted_data.requested_studies[0].name == "Hemograma"
    assert result.extracted_data.model_dump()["study_result"] == (
        "Sin hallazgos críticos."
    )
    assert client.models.arguments is not None
    assert client.models.arguments["model"] == "test-model"
    response_schema = client.models.arguments["config"].response_schema
    assert isinstance(response_schema, dict)
    assert "requested_studies" in (
        response_schema["$defs"]["ExtractedData"]["properties"]
    )
    assert "lab_results" in response_schema["$defs"]["ExtractedData"]["properties"]
    assert "additionalProperties" not in json.dumps(response_schema)
    assert client.models.arguments["config"].response_mime_type == "application/json"
    assert "no infieras ni sugieras estudios" in (
        client.models.arguments["config"].system_instruction
    )
    instruction = client.models.arguments["config"].system_instruction
    assert "ILLEGIBLE_DOCUMENT" in instruction
    assert "MISSING_CRITICAL_FIELDS" in instruction
    assert "INCONSISTENT_DATA" in instruction
    assert "no puede leerse" in instruction
    assert "dato clínico esencial" in instruction
    assert "datos explícitos del documento se contradicen" in instruction
    assert "La ambigüedad documental" in instruction
    assert "dos valores explícitos incompatibles" in instruction
    assert "AUDIT_CONFIDENCE_THRESHOLD" in instruction
    assert "Conserva primary_destination" in instruction
    assert "No conviertas síntomas" in instruction
    assert (
        "suggested_icd10 solo puede basarse en un diagnóstico primario explícito"
        in instruction
    )
    assert "síntomas, signos, antecedentes, resultados de laboratorio" in instruction
    assert "No omitas la duración" in instruction
    assert "agregues a dosage datos consignados por separado" in instruction
    assert "no copies esa frase como dato clínico" in instruction
    assert client.models.arguments["contents"][1] == "Solicito hemograma."


def test_study_report_preserves_three_explicit_lab_results() -> None:
    payload = valid_response_payload()
    payload["classification"]["document_type"] = "STUDY_REPORT"
    payload["extracted_data"] = {
        "patient": {"name": None, "age": None},
        "primary_diagnosis": None,
        "suggested_icd10": None,
        "requested_studies": [],
        "lab_results": [
            {
                "name": "Glucosa en sangre",
                "value": "174",
                "unit": "mg/dL",
                "reference_range": "70–99 mg/dL",
            },
            {
                "name": "HbA1c",
                "value": "8.2",
                "unit": "%",
                "reference_range": "Inferior a 5.7 %",
            },
            {
                "name": "Creatinina sérica",
                "value": "0.86",
                "unit": "mg/dL",
                "reference_range": "0.6–1.1 mg/dL",
            },
        ],
    }
    payload["routing_decision"]["audit_reasons"] = ["MISSING_CRITICAL_FIELDS"]
    payload["routing_decision"]["primary_destination"] = "MEDICAL_RECORD"
    processor, client = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert result.extracted_data.model_dump(mode="json")["lab_results"] == (
        payload["extracted_data"]["lab_results"]
    )
    assert result.extracted_data.patient.name is None
    assert result.extracted_data.primary_diagnosis is None
    assert result.extracted_data.suggested_icd10 is None
    assert result.extracted_data.requested_studies == []
    assert [reason.value for reason in result.routing_decision.audit_reasons] == [
        "MISSING_CRITICAL_FIELDS"
    ]
    assert "No incluyas resultados obtenidos en requested_studies" in (
        client.models.arguments["config"].system_instruction
    )


def test_case_002_keeps_urgent_routing_without_diagnosis_or_icd10() -> None:
    fixture = json.loads(
        case_fixture("CASE-002", "request.json").read_text(encoding="utf-8")
    )
    expected = json.loads(
        case_fixture("CASE-002", "expected.json").read_text(encoding="utf-8")
    )
    request = ProcessingRequest(
        document_id=fixture["document_id"],
        input_type="TEXT",
        mime_type="text/plain",
        document_text=fixture["document_text"],
        origin_channel=fixture["origin_channel"],
    )
    payload = valid_response_payload()
    payload["document_id"] = fixture["document_id"]
    payload["classification"].update(
        document_type=expected["classification"]["document_type"],
        priority_level=expected["classification"]["priority_level"],
    )
    payload["extracted_data"].update(
        primary_diagnosis=None,
        suggested_icd10=None,
        medications=[],
        requested_studies=[{"name": "Troponina I ultrasensible"}],
    )
    payload["routing_decision"].update(
        primary_destination=expected["routing_decision"]["primary_destination"],
        justification="Resultado elevado y evaluación urgente indicada.",
    )
    processor, client = processor_for(FakeResponse(parsed=payload))

    result = processor.process(request)

    assert result.extracted_data.primary_diagnosis is None
    assert result.extracted_data.suggested_icd10 is None
    assert result.classification.priority_level.value == (
        expected["classification"]["priority_level"]
    )
    assert result.routing_decision.primary_destination.value == (
        expected["routing_decision"]["primary_destination"]
    )
    assert result.extracted_data.medications == []
    assert "primary_diagnosis no expresado" in expected["must_not_invent"]
    assert "suggested_icd10" in expected["must_not_invent"]
    assert "medications" in expected["must_not_invent"]
    instruction = client.models.arguments["config"].system_instruction
    assert client.models.arguments["contents"][1] == fixture["document_text"]
    assert "No conviertas síntomas" in instruction
    assert (
        "suggested_icd10 solo puede basarse en un diagnóstico primario explícito"
        in instruction
    )
    assert "síntomas, signos, antecedentes, resultados de laboratorio" in instruction


@pytest.mark.parametrize(
    "dosage",
    [
        " NO CONSIGNADA ",
        "NO CONSIGNADA.",
        "Dosis: NO CONSIGNADA.",
        "Dosis no indicada",
        "No se especifica",
        "Sin dosis",
        "",
    ],
)
def test_normalizes_absence_text_as_missing_medication_dosage(dosage: str) -> None:
    expected = json.loads(
        case_fixture("CASE-005", "expected.json").read_text(encoding="utf-8")
    )
    payload = valid_response_payload()
    payload["extracted_data"]["medications"] = [
        {"name": "Amoxicilina", "dosage": dosage}
    ]
    processor, _ = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    medication = result.extracted_data.medications[0]
    assert medication.model_dump() == (
        expected["datos_clave_esperados"]["medications"][0]
    )
    assert set(expected["validation"]["missing_fields_required"]) <= set(
        result.validation.missing_fields
    )
    assert set(expected["routing_decision"]["audit_reasons_required"]) <= {
        reason.value for reason in result.routing_decision.audit_reasons
    }


def test_missing_medication_dosage_is_recorded_as_critical() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["medications"] = [
        {"name": "Amoxicilina", "dosage": None}
    ]
    processor, _ = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert result.extracted_data.medications[0].dosage is None
    assert "medications[0].dosage" in result.validation.missing_fields
    assert SemanticAuditReason.MISSING_CRITICAL_FIELDS in (
        result.routing_decision.audit_reasons
    )


@pytest.mark.parametrize(
    "model_dosage",
    [
        "1 comprimido cada 8 horas durante 3 dias",
        "1 comprimido cada 8 horas, duracion: 3 dias",
    ],
)
def test_case_007_preserves_medication_duration_in_dosage(
    model_dosage: str,
) -> None:
    expected = json.loads(
        case_fixture("CASE-007", "expected.json").read_text(encoding="utf-8")
    )
    payload = valid_response_payload()
    payload["extracted_data"]["medications"] = [
        {
            "name": "Paracetamol 500 mg",
            "dosage": model_dosage,
        }
    ]
    processor, client = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert result.extracted_data.medications[0].model_dump() == (
        expected["datos_clave_esperados"]["medications"][0]
    )
    assert "No omitas la duración" in (
        client.models.arguments["config"].system_instruction
    )


def test_case_007_does_not_duplicate_strength_already_in_dosage() -> None:
    expected = json.loads(
        case_fixture("CASE-007", "expected.json").read_text(encoding="utf-8")
    )
    payload = valid_response_payload()
    payload["extracted_data"]["medications"] = [
        {
            "name": "Paracetamol 500 mg",
            "dosage": "500 mg / 1 comprimido cada 8 horas por 3 dias",
        }
    ]
    processor, _ = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert result.extracted_data.medications[0].model_dump() == (
        expected["datos_clave_esperados"]["medications"][0]
    )


def test_preserves_medication_name_when_dosage_reports_another_strength() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["medications"] = [
        {
            "name": "Paracetamol 500 mg",
            "dosage": "250 mg / 1 comprimido cada 8 horas por 3 dias",
        }
    ]
    processor, _ = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    medication = result.extracted_data.medications[0]
    assert medication.name == "Paracetamol 500 mg"
    assert medication.dosage == "250 mg / 1 comprimido cada 8 horas por 3 dias"


def test_missing_dosage_does_not_promote_strength_from_medication_name() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["medications"] = [
        {"name": "Amoxicilina 500 mg", "dosage": None}
    ]
    processor, _ = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert result.extracted_data.medications[0].name == "Amoxicilina 500 mg"
    assert result.extracted_data.medications[0].dosage is None


def test_absence_text_does_not_promote_strength_from_medication_name() -> None:
    payload = valid_response_payload()
    payload["extracted_data"]["medications"] = [
        {"name": "Amoxicilina 500 mg", "dosage": "Dosis: no consignada"}
    ]
    processor, _ = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert result.extracted_data.medications[0].name == "Amoxicilina 500 mg"
    assert result.extracted_data.medications[0].dosage is None
    assert "medications[0].dosage" in result.validation.missing_fields


@pytest.mark.parametrize(
    "audit_reason",
    [
        "LOW_CONFIDENCE",
        "ILLEGIBLE_DOCUMENT",
        "MISSING_CRITICAL_FIELDS",
        "INCONSISTENT_DATA",
    ],
)
def test_accepts_each_semantic_audit_reason(audit_reason: str) -> None:
    payload = valid_response_payload()
    payload["routing_decision"]["audit_reasons"] = [audit_reason]
    processor, _ = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert [reason.value for reason in result.routing_decision.audit_reasons] == [
        audit_reason
    ]
    assert result.routing_decision.primary_destination.value == "PHARMACY"


def test_sdk_can_convert_gemini_response_schema() -> None:
    from google import genai
    from google.genai import _transformers

    processor, client = processor_for(FakeResponse(parsed=valid_response_payload()))
    assert client is not None
    processor.process(text_request())
    response_schema = client.models.arguments["config"].response_schema

    sdk_client = genai.Client(api_key="test-key")
    try:
        converted_schema = _transformers.t_schema(
            sdk_client._api_client,
            response_schema,
        )
    finally:
        sdk_client.close()

    assert converted_schema.type == "OBJECT"


@pytest.mark.parametrize("include_null", [True, False])
def test_uses_empty_requested_studies_when_model_returns_none(
    include_null: bool,
) -> None:
    payload = valid_response_payload()
    if include_null:
        payload["extracted_data"]["requested_studies"] = None
    else:
        del payload["extracted_data"]["requested_studies"]
    processor, _ = processor_for(
        FakeResponse(parsed=None, text=json.dumps(payload))
    )

    result = processor.process(text_request())

    assert result.extracted_data.requested_studies == []


def test_accepts_sdk_parsed_pydantic_response() -> None:
    payload = AIProcessingResponse.model_validate(valid_response_payload())
    processor, _ = processor_for(FakeResponse(parsed=payload))

    result = processor.process(text_request())

    assert result.document_id == "DOC-CLIN-001"
    assert result.extracted_data.requested_studies[0].name == "Hemograma"


def test_sends_file_bytes_with_declared_mime_type() -> None:
    processor, client = processor_for(
        FakeResponse(parsed=valid_response_payload())
    )
    request = ProcessingRequest(
        document_id="DOC-CLIN-001",
        input_type="FILE",
        mime_type="application/pdf",
        file_name="orden.pdf",
        content_base64="cGRmLWNvbnRlbnQ=",
        origin_channel="Guardia",
    )

    processor.process(request)

    content = client.models.arguments["contents"][1]
    assert content.inline_data.data == b"pdf-content"
    assert content.inline_data.mime_type == "application/pdf"


@pytest.mark.parametrize(
    "mutate_payload",
    [
        lambda payload: payload["classification"].update(
            {"document_type": "UNKNOWN"}
        ),
        lambda payload: payload.update({"document_id": "DOC-CLIN-OTHER"}),
    ],
)
def test_rejects_invalid_model_outputs(mutate_payload) -> None:
    payload = valid_response_payload()
    mutate_payload(payload)
    processor, _ = processor_for(FakeResponse(parsed=payload))

    with pytest.raises(AIOutputInvalidError):
        processor.process(text_request())


def test_rejects_malformed_json_output() -> None:
    processor, _ = processor_for(FakeResponse(parsed=None, text="not-json"))

    with pytest.raises(AIOutputInvalidError):
        processor.process(text_request())


def test_provider_errors_retain_safe_diagnostic_details() -> None:
    processor, _ = processor_for(
        APIError(
            429,
            {
                "status": "RESOURCE_EXHAUSTED",
                "message": "Quota exceeded.",
            },
        )
    )

    with pytest.raises(
        GeminiProviderError,
        match="HTTP 429, status=RESOURCE_EXHAUSTED.*Quota exceeded",
    ):
        processor.process(text_request())


def test_requires_model_configuration() -> None:
    config = Settings(_env_file=None, gemini_api_key="test-key")

    with pytest.raises(GeminiConfigurationError, match="GEMINI_MODEL"):
        GeminiProcessor(config=config, client=FakeClient(FakeResponse(None)))


def test_requires_api_key_when_creating_gemini_client() -> None:
    config = Settings(_env_file=None, gemini_model="test-model")

    with pytest.raises(GeminiConfigurationError, match="GEMINI_API_KEY"):
        GeminiProcessor(config=config)


def test_rejects_malformed_file_base64() -> None:
    with pytest.raises(ValidationError):
        ProcessingRequest(
            document_id="DOC-CLIN-001",
            input_type="FILE",
            mime_type="application/pdf",
            content_base64="not-base64",
            origin_channel="Guardia",
        )
