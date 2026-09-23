from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from app.schemas.enums import (
    DocumentType,
    Priority,
    RoutingDestination,
    SemanticAuditReason,
)


class Classification(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    document_type: DocumentType
    specialty: str | None = None
    priority_level: Priority


class Confidence(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    classification: float = Field(ge=0, le=1)
    extraction: float = Field(ge=0, le=1)
    global_: float = Field(ge=0, le=1, alias="global")

    @field_validator("classification", "extraction", "global_", mode="before")
    @classmethod
    def validate_numeric_confidence(cls, value: object) -> object:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("confidence values must be JSON numbers")

        return value


class Patient(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    name: str | None = None
    age: StrictInt | None = Field(default=None, ge=0)


class RequestingDoctor(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    name: str | None = None
    license_number: str | None = None


class Medication(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    name: str | None = None
    dosage: str | None = None


class ExtractedData(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    patient: Patient | None = None
    requesting_doctor: RequestingDoctor | None = None
    primary_diagnosis: str | None = None
    suggested_icd10: str | None = None
    medications: list[Medication] | None = None


class ValidationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    missing_fields: list[str]
    inconsistencies: list[str]
    warnings: list[str]


class RoutingDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    primary_destination: RoutingDestination
    audit_reasons: list[SemanticAuditReason]
    justification: str = Field(min_length=1)


class AIProcessingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(min_length=1)
    classification: Classification
    confidence: Confidence
    extracted_data: ExtractedData
    validation: ValidationResult
    routing_decision: RoutingDecision