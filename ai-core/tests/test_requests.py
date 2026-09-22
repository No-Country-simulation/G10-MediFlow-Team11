import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.schemas.requests import ProcessingRequest


def test_accepts_file_request_with_base64_content() -> None:
    request = ProcessingRequest(
        documento_id="DOC-CLIN-001",
        input_type="FILE",
        mime_type="application/pdf",
        file_name="informe.pdf",
        content_base64="cGRmLWNvbnRlbnQ=",
        documento_texto=None,
        canal_origen="Guardia_Emergencias",
    )

    assert request.input_type == "FILE"


def test_accepts_text_request_with_document_text() -> None:
    request = ProcessingRequest(
        documento_id="DOC-CLIN-002",
        input_type="TEXT",
        mime_type="text/plain",
        file_name=None,
        content_base64=None,
        documento_texto="Paciente ficticio con receta médica.",
        canal_origen="Guardia_Emergencias",
    )

    assert request.documento_texto == "Paciente ficticio con receta médica."


def test_rejects_file_request_without_base64_content() -> None:
    with pytest.raises(ValidationError):
        ProcessingRequest(
            documento_id="DOC-CLIN-003",
            input_type="FILE",
            mime_type="application/pdf",
            file_name="informe.pdf",
            content_base64=None,
            documento_texto=None,
            canal_origen="Guardia_Emergencias",
        )


def test_rejects_text_request_without_document_text() -> None:
    with pytest.raises(ValidationError):
        ProcessingRequest(
            documento_id="DOC-CLIN-004",
            input_type="TEXT",
            mime_type="text/plain",
            file_name=None,
            content_base64=None,
            documento_texto=None,
            canal_origen="Guardia_Emergencias",
        )


def test_rejects_unknown_request_field() -> None:
    with pytest.raises(ValidationError):
        ProcessingRequest(
            documento_id="DOC-CLIN-005",
            input_type="TEXT",
            mime_type="text/plain",
            file_name=None,
            content_base64=None,
            documento_texto="Documento de prueba.",
            canal_origen="Guardia_Emergencias",
            unexpected_field="invalid",
        )