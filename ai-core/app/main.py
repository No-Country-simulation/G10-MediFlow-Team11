from functools import lru_cache

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.requests import ProcessingRequest
from app.schemas.responses import AIProcessingResponse
from app.services.gemini_processor import (
	AIOutputInvalidError,
	GeminiConfigurationError,
	GeminiProviderError,
)
from app.services.pipeline import AIProcessingPipeline


app = FastAPI(title="MediFlow AI Core")


@lru_cache
def get_pipeline() -> AIProcessingPipeline:
	return AIProcessingPipeline()


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
	return JSONResponse(
		status_code=status_code,
		content={"error": {"code": code, "message": message}},
	)


@app.exception_handler(RequestValidationError)
async def invalid_request(
	request: Request,
	error: RequestValidationError,
) -> JSONResponse:
	return error_response(400, "INVALID_REQUEST", "La solicitud no es válida.")


@app.exception_handler(AIOutputInvalidError)
async def invalid_ai_output(
	request: Request,
	error: AIOutputInvalidError,
) -> JSONResponse:
	return error_response(
		502,
		"AI_OUTPUT_INVALID",
		"No se pudo producir una respuesta estructurada válida.",
	)


@app.exception_handler(GeminiProviderError)
@app.exception_handler(GeminiConfigurationError)
async def ai_unavailable(
	request: Request,
	error: GeminiProviderError | GeminiConfigurationError,
) -> JSONResponse:
	return error_response(
		503,
		"AI_UNAVAILABLE",
		"El servicio de IA no está disponible.",
	)


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "ok"}


@app.post("/api/v1/ai/process", response_model=AIProcessingResponse)
def process_document(
	request: ProcessingRequest,
	pipeline: AIProcessingPipeline = Depends(get_pipeline),
) -> AIProcessingResponse:
	try:
		return pipeline.process(request)
	except ValueError as error:
		raise AIOutputInvalidError(
			"The AI response does not satisfy the requested document contract."
		) from error
