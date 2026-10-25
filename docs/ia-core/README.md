# IA Core

Documentación del motor de IA, procesamiento, modelos, prompts, validación y lógica asociada.

La integración con Gemini vive en `ai-core/app/services/gemini_processor.py` y
puede probarse directamente sin HTTP. Usa `GEMINI_API_KEY` y `GEMINI_MODEL`
desde el entorno; el servicio valida cada salida contra `AIProcessingResponse`
antes de devolverla. La guía de configuración y el contrato de
`requested_studies` están en [ai-core/README.md](../../ai-core/README.md).
