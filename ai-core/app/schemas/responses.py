from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.enums import (
    DocumentType,
    PriorityLevel,
    RoutingDestination,
    SemanticAuditReason,
)


class Classification(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    tipo_documento: DocumentType
    especialidad: str | None = None
    nivel_prioridad: PriorityLevel


class Confidence(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
    )

    clasificacion: float = Field(ge=0, le=1)
    extraccion: float = Field(ge=0, le=1)
    global_: float = Field(ge=0, le=1, alias="global")

    @field_validator("clasificacion", "extraccion", "global_", mode="before")
    @classmethod
    def validate_numeric_confidence(cls, value: object) -> object:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("confidence values must be JSON numbers")

        return value


class Patient(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    nombre: str | None = None
    edad: int | None = Field(default=None, ge=0)


class RequestingDoctor(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    nombre: str | None = None
    matricula: str | None = None


class Medication(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    nombre: str | None = None
    dosis: str | None = None


class ExtractedData(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    paciente: Patient | None = None
    medico_solicitante: RequestingDoctor | None = None
    diagnostico_principal: str | None = None
    cie10_sugerido: str | None = None
    medicamentos: list[Medication] | None = None


class ValidationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    campos_faltantes: list[str] = Field(default_factory=list)
    inconsistencias: list[str] = Field(default_factory=list)
    advertencias: list[str] = Field(default_factory=list)


class RoutingDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    destino_principal: RoutingDestination
    audit_reasons: list[SemanticAuditReason] = Field(default_factory=list)
    justificacion: str = Field(min_length=1)


class AIProcessingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    documento_id: str = Field(min_length=1)
    clasificacion: Classification
    confianza: Confidence
    datos_extraidos: ExtractedData
    validacion: ValidationResult
    decision_enrutamiento: RoutingDecision