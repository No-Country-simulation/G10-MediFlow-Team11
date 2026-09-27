from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

from app.schemas.requests import ProcessingRequest
from app.schemas.responses import AIProcessingResponse
from app.services.gemini_client import GeminiClient
from app.services.pipeline import ProcessingPipeline

app = FastAPI(title="MediFlow AI Core")

gemini_client = GeminiClient()
pipeline = ProcessingPipeline()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/v1/ai/process",
    response_model=AIProcessingResponse,
    status_code=status.HTTP_200_OK,
)
async def process_document(request: ProcessingRequest):
    try:
        raw_output = await gemini_client.analyze(
            input_type=request.input_type.value,
            mime_type=request.mime_type,
            content_base64=request.content_base64,
            document_text=request.document_text,
        )
        response = pipeline.build_response(request, raw_output)
        return response
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "error": {
                    "code": "AI_OUTPUT_INVALID",
                    "message": f"No se pudo producir una respuesta estructurada válida: {str(exc)}",
                }
            },
        )