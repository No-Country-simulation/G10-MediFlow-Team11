import base64
import json
from typing import Any
from google import genai
from google.genai import types
from app.config import settings

SYSTEM_INSTRUCTION = """Eres el agente clínico de triaje de MediFlow.
Analiza el documento médico adjunto (sea informe de texto, imagen o PDF) y extrae la información clínica estructurada respetando de forma estricta el siguiente esquema JSON.

Reglas Clínicas y Enums Permitidos:
1. classification:
   - document_type (OBLIGATORIO): PRESCRIPTION | IMAGING_REPORT | STUDY_REPORT | PROCEDURE_ORDER | DISCHARGE_SUMMARY | MEDICAL_CERTIFICATE
     (Nota: IMAGING_REPORT cubre radiografías, tomografías, resonancias, ecografías; STUDY_REPORT cubre análisis de laboratorio y otros diagnósticos).
   - specialty: Especialidad médica sugerida en español (string o null).
   - priority_level (OBLIGATORIO): ROUTINE | URGENT
     (Nota: Solo marcar URGENT si hay hallazgos con riesgo vital agudo o urgencia crítica no diferible; en caso contrario, ROUTINE).

2. confidence:
   - classification: Número entre 0.0 y 1.0 indicando certidumbre del tipo de documento.
   - extraction: Número entre 0.0 y 1.0 indicando certidumbre de los datos extraídos.

3. extracted_data:
   - patient: {"name": string|null, "age": int|null} (edad como entero positivo o null).
   - requesting_doctor: {"name": string|null, "license_number": string|null}.
   - primary_diagnosis: string o null.
   - suggested_icd10: Código CIE-10 estimado o null (p.ej. "I26.9").
   - medications: Lista de {"name": string|null, "dosage": string|null}. Si no hay medicamentos, devolver [].
   - requested_studies: Lista de {"name": string|null}. Solo incluir estudios explícitamente pedidos en el documento. Si no hay, devolver [].

4. validation:
   - missing_fields: Lista de nombres de campos clínicos ausentes o incompletos (o []).
   - inconsistencies: Lista de contradicciones médicas halladas en el texto (o []).
   - warnings: Lista de observaciones, alertas de legibilidad o notas ambiguas (o []).

5. routing_decision:
   - primary_destination (OBLIGATORIO): MEDICAL_EMERGENCY | PHARMACY | AUTHORIZATION_AUDIT | MEDICAL_RECORD | HUMAN_REVIEW
   - justification: Explicación concisa y clínica en español (string no vacío) de por qué se sugiere dicho destino.

Responde ÚNICAMENTE un objeto JSON válido sin bloques markdown adicionales ni texto explicativo fuera del JSON."""


class GeminiClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or settings.gemini_api_key
        self.model_name = model or settings.gemini_model or "gemini-2.5-flash"
        if not self.api_key:
            # Permitir instanciar para testing o validar en ejecución
            self.client = None
        else:
            self.client = genai.Client(api_key=self.api_key)

    async def analyze(
        self,
        input_type: str,
        mime_type: str,
        content_base64: str | None = None,
        document_text: str | None = None,
    ) -> dict[str, Any]:
        """
        Llama a la API de Gemini enviando el contenido (archivo en Base64 o texto)
        y retorna el diccionario JSON parseado.
        """
        if not self.client:
            raise RuntimeError("GEMINI_API_KEY no configurada.")

        contents: list[Any] = []

        if input_type == "FILE":
            if not content_base64:
                raise ValueError("content_base64 es requerido para input_type FILE")
            raw_bytes = base64.b64decode(content_base64)
            contents.append(
                types.Part.from_bytes(data=raw_bytes, mime_type=mime_type)
            )
            contents.append("Procesa y extrae la información clínica de este documento.")
        elif input_type == "TEXT":
            if not document_text:
                raise ValueError("document_text es requerido para input_type TEXT")
            contents.append(
                f"Documento Clínico:\n{document_text}\n\nProcesa y extrae la información clínica estructurada."
            )
        else:
            raise ValueError(f"input_type no soportado: {input_type}")

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            
            if not response.text:
                raise ValueError("Respuesta vacía recibida desde Gemini.")

            return json.loads(response.text)
        except Exception as exc:
            raise RuntimeError(f"Error procesando documento con Gemini: {str(exc)}") from exc