import json
import sys
from pathlib import Path

import pytest
from google.genai.errors import APIError
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.config import Settings
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
    assert "AUDIT_CONFIDENCE_THRESHOLD" in instruction
    assert "Conserva primary_destination" in instruction
    assert client.models.arguments["contents"][1] == "Solicito hemograma."


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
