from collections.abc import Callable
import logging

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.requests import ProcessingRequest
from app.schemas.responses import AIProcessingResponse
from app.services.gemini_processor import (
    AIOutputInvalidError,
    GeminiConfigurationError,
    GeminiProcessor,
    GeminiProviderError,
)


logger = logging.getLogger(__name__)
app = FastAPI(title="MediFlow AI Core")


def get_gemini_processor() -> Callable[[], GeminiProcessor]:
    return GeminiProcessor


@app.post(
    "/api/v1/ai/process",
    response_model=AIProcessingResponse,
)
def process_document(
    request: ProcessingRequest,
    processor_factory: Callable[[], GeminiProcessor] = Depends(
        get_gemini_processor
    ),
) -> AIProcessingResponse:
    return processor_factory().process(request)


@app.exception_handler(RequestValidationError)
def handle_invalid_request(
    _request: Request,
    _exception: RequestValidationError,
) -> JSONResponse:
    _ = (_request, _exception)
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "INVALID_REQUEST",
                "message": "La solicitud no cumple el contrato de procesamiento.",
            }
        },
    )


@app.exception_handler(AIOutputInvalidError)
def handle_invalid_ai_output(
    _request: Request,
    _exception: AIOutputInvalidError,
) -> JSONResponse:
    _ = (_request, _exception)
    return JSONResponse(
        status_code=502,
        content={
            "error": {
                "code": "AI_OUTPUT_INVALID",
                "message": "No se pudo producir una respuesta estructurada válida.",
            }
        },
    )


@app.exception_handler(GeminiConfigurationError)
def handle_gemini_configuration_error(
    _request: Request,
    exception: GeminiConfigurationError,
) -> JSONResponse:
    _ = _request
    logger.error("Gemini configuration error: %s", exception)
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "AI_PROVIDER_UNAVAILABLE",
                "message": "El proveedor de IA no está configurado.",
            }
        },
    )


@app.exception_handler(GeminiProviderError)
def handle_gemini_provider_error(
    _request: Request,
    exception: GeminiProviderError,
) -> JSONResponse:
    _ = _request
    logger.error("Gemini provider request failed: %s", exception)
    return JSONResponse(
        status_code=502,
        content={
            "error": {
                "code": "AI_PROVIDER_ERROR",
                "message": "No fue posible completar el procesamiento con Gemini.",
            }
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "ok"}
