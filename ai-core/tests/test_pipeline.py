import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.config import Settings
from app.schemas.enums import RoutingDestination, SemanticAuditReason
from app.schemas.requests import ProcessingRequest
from app.schemas.responses import AIProcessingResponse
from app.services.pipeline import AIProcessingPipeline


def response_payload() -> dict:
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
		"extracted_data": {"requested_studies": None},
		"validation": {"missing_fields": [], "inconsistencies": [], "warnings": []},
		"routing_decision": {
			"primary_destination": "PHARMACY",
			"audit_reasons": [],
			"justification": "Receta válida para dispensación.",
		},
	}


def request() -> ProcessingRequest:
	return ProcessingRequest(
		document_id="DOC-CLIN-001",
		input_type="TEXT",
		mime_type="text/plain",
		document_text="Solicito hemograma.",
		origin_channel="Guardia",
	)


class FakeProcessor:
	def __init__(self, payload: dict) -> None:
		self.result = AIProcessingResponse.model_validate(payload)

	def process(self, _: ProcessingRequest) -> AIProcessingResponse:
		return self.result


def pipeline_for(payload: dict, threshold: float = 0.85) -> AIProcessingPipeline:
	config = Settings(_env_file=None, audit_confidence_threshold=threshold)
	return AIProcessingPipeline(FakeProcessor(payload), config)


def test_defaults_confidence_threshold_to_085() -> None:
	assert Settings(_env_file=None).audit_confidence_threshold == 0.85


def test_reads_confidence_threshold_from_environment(monkeypatch) -> None:
	monkeypatch.setenv("AUDIT_CONFIDENCE_THRESHOLD", "0.7")

	assert Settings(_env_file=None).audit_confidence_threshold == 0.7


def test_environment_threshold_controls_low_confidence_reason(monkeypatch) -> None:
	monkeypatch.setenv("AUDIT_CONFIDENCE_THRESHOLD", "0.7")
	payload = response_payload()
	payload["confidence"]["global"] = 0.75
	config = Settings(_env_file=None)

	result = AIProcessingPipeline(FakeProcessor(payload), config).process(request())

	assert result.routing_decision.audit_reasons == []
	assert result.routing_decision.primary_destination == RoutingDestination.PHARMACY

	payload["confidence"]["global"] = 0.69
	result = AIProcessingPipeline(FakeProcessor(payload), config).process(request())

	assert result.routing_decision.audit_reasons == [
		SemanticAuditReason.LOW_CONFIDENCE
	]
	assert result.routing_decision.primary_destination == RoutingDestination.PHARMACY


def test_applies_configured_low_confidence_threshold_without_changing_destination() -> None:
	payload = response_payload()
	payload["confidence"]["global"] = 0.84

	result = pipeline_for(payload, threshold=0.9).process(request())

	assert result.routing_decision.audit_reasons == [
		SemanticAuditReason.LOW_CONFIDENCE
	]
	assert result.routing_decision.primary_destination == RoutingDestination.PHARMACY


def test_does_not_flag_confidence_at_or_above_threshold() -> None:
	result = pipeline_for(response_payload()).process(request())

	assert result.routing_decision.audit_reasons == []
	assert result.routing_decision.primary_destination == RoutingDestination.PHARMACY


@pytest.mark.parametrize(
	"audit_reason",
	[
		SemanticAuditReason.LOW_CONFIDENCE,
		SemanticAuditReason.ILLEGIBLE_DOCUMENT,
		SemanticAuditReason.MISSING_CRITICAL_FIELDS,
		SemanticAuditReason.INCONSISTENT_DATA,
	],
)
def test_preserves_semantic_reasons_without_changing_destination(
	audit_reason: SemanticAuditReason,
) -> None:
	payload = response_payload()
	payload["routing_decision"]["audit_reasons"] = [audit_reason.value]

	result = pipeline_for(payload).process(request())

	assert result.routing_decision.audit_reasons == [
		audit_reason
	]
	assert result.routing_decision.primary_destination == RoutingDestination.PHARMACY


def test_normalizes_missing_requested_studies_to_empty_array() -> None:
	result = pipeline_for(response_payload()).process(request())

	assert result.extracted_data.requested_studies == []


def test_rejects_response_for_different_document() -> None:
	payload = response_payload()
	payload["document_id"] = "DOC-OTHER"

	try:
		pipeline_for(payload).process(request())
	except ValueError as error:
		assert "document_id" in str(error)
	else:
		raise AssertionError("pipeline accepted a mismatched document_id")