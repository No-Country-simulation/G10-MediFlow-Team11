from typing import Protocol

from app.config import Settings, settings
from app.schemas.enums import SemanticAuditReason
from app.schemas.requests import ProcessingRequest
from app.schemas.responses import AIProcessingResponse
from app.services.gemini_processor import GeminiProcessor


class StructuredProcessor(Protocol):
    def process(self, request: ProcessingRequest) -> AIProcessingResponse: ...


class AIProcessingPipeline:
    def __init__(
        self,
        processor: StructuredProcessor | None = None,
        config: Settings = settings,
    ) -> None:
        self._processor = processor
        self._config = config
        self._confidence_threshold = config.audit_confidence_threshold

    def process(self, request: ProcessingRequest) -> AIProcessingResponse:
        document = self._ingest(request)
        analysis = self._classify(document)
        extracted = self._extract(analysis)
        validated = self._validate(extracted, document)
        scored = self._score(validated)
        return self._route(scored)

    @staticmethod
    def _ingest(request: ProcessingRequest) -> ProcessingRequest:
        return request

    def _classify(self, request: ProcessingRequest) -> AIProcessingResponse:
        processor = self._processor or GeminiProcessor(config=self._config)
        return processor.process(request)

    @staticmethod
    def _extract(result: AIProcessingResponse) -> AIProcessingResponse:
        if result.extracted_data.requested_studies is not None:
            return result

        return result.model_copy(
            update={
                "extracted_data": result.extracted_data.model_copy(
                    update={"requested_studies": []}
                )
            }
        )

    @staticmethod
    def _validate(
        result: AIProcessingResponse,
        request: ProcessingRequest,
    ) -> AIProcessingResponse:
        validated = AIProcessingResponse.model_validate(
            result.model_dump(mode="python", by_alias=True)
        )
        if validated.document_id != request.document_id:
            raise ValueError("AI response document_id does not match request.")
        return validated

    def _score(self, result: AIProcessingResponse) -> AIProcessingResponse:
        decision = result.routing_decision
        reasons = list(decision.audit_reasons)
        if (
            result.confidence.global_ < self._confidence_threshold
            and SemanticAuditReason.LOW_CONFIDENCE not in reasons
        ):
            reasons.append(SemanticAuditReason.LOW_CONFIDENCE)

        if reasons == decision.audit_reasons:
            return result

        return result.model_copy(
            update={
                "routing_decision": decision.model_copy(
                    update={"audit_reasons": reasons}
                )
            }
        )

    @staticmethod
    def _route(result: AIProcessingResponse) -> AIProcessingResponse:
        return result
