from typing import Any
from app.config import settings
from app.schemas.enums import RoutingDestination, SemanticAuditReason
from app.schemas.requests import ProcessingRequest
from app.schemas.responses import (
    AIProcessingResponse,
    Classification,
    Confidence,
    ExtractedData,
    Medication,
    Patient,
    RequestedStudy,
    RequestingDoctor,
    RoutingDecision,
    ValidationResult,
)


class ProcessingPipeline:
    def __init__(self, threshold: float | None = None) -> None:
        self.threshold = threshold or settings.audit_confidence_threshold

    def build_response(
        self, request: ProcessingRequest, raw_ai_output: dict[str, Any]
    ) -> AIProcessingResponse:
        # 1. Classification
        raw_class = raw_ai_output.get("classification") or {}
        classification = Classification(
            document_type=raw_class.get("document_type"),
            specialty=raw_class.get("specialty"),
            priority_level=raw_class.get("priority_level"),
        )

        # 2. Confidence
        raw_conf = raw_ai_output.get("confidence") or {}
        conf_class = float(raw_conf.get("classification", 0.0))
        conf_ext = float(raw_conf.get("extraction", 0.0))
        global_conf = round((conf_class * 0.4) + (conf_ext * 0.6), 2)

        confidence = Confidence(
            classification=conf_class,
            extraction=conf_ext,
            **{"global": global_conf},
        )

        # 3. Extracted Data
        raw_data = raw_ai_output.get("extracted_data") or {}

        patient_obj = None
        raw_patient = raw_data.get("patient")
        if isinstance(raw_patient, dict):
            name = raw_patient.get("name")
            age = raw_patient.get("age")
            if name is not None or age is not None:
                patient_obj = Patient(name=name, age=int(age) if age is not None else None)

        doctor_obj = None
        raw_doctor = raw_data.get("requesting_doctor")
        if isinstance(raw_doctor, dict):
            doc_name = raw_doctor.get("name")
            license_num = raw_doctor.get("license_number")
            if doc_name is not None or license_num is not None:
                doctor_obj = RequestingDoctor(name=doc_name, license_number=license_num)

        raw_meds = raw_data.get("medications")
        meds: list[Medication] | None = None
        if raw_meds is not None:
            meds = [
                Medication(name=m.get("name"), dosage=m.get("dosage"))
                for m in raw_meds
                if isinstance(m, dict)
            ]

        raw_studies = raw_data.get("requested_studies")
        studies: list[RequestedStudy] | None = None
        if raw_studies is not None:
            studies = [
                RequestedStudy(name=s.get("name"))
                for s in raw_studies
                if isinstance(s, dict)
            ]

        extracted_data = ExtractedData(
            patient=patient_obj,
            requesting_doctor=doctor_obj,
            primary_diagnosis=raw_data.get("primary_diagnosis"),
            suggested_icd10=raw_data.get("suggested_icd10"),
            medications=meds,
            requested_studies=studies,
        )

        # 4. Validation
        raw_val = raw_ai_output.get("validation") or {}
        validation = ValidationResult(
            missing_fields=raw_val.get("missing_fields") or [],
            inconsistencies=raw_val.get("inconsistencies") or [],
            warnings=raw_val.get("warnings") or [],
        )

        # 5. Routing Decision & Semantic Audit Reasons
        raw_routing = raw_ai_output.get("routing_decision") or {}
        raw_dest = raw_routing.get("primary_destination", "HUMAN_REVIEW")
        if isinstance(raw_dest, RoutingDestination):
            suggested_dest = raw_dest
        else:
            suggested_dest = RoutingDestination(str(raw_dest))

        justification = raw_routing.get("justification") or "Procesamiento completado por IA Core."

        audit_reasons: list[SemanticAuditReason] = []

        if global_conf < self.threshold:
            audit_reasons.append(SemanticAuditReason.LOW_CONFIDENCE)

        if validation.missing_fields:
            audit_reasons.append(SemanticAuditReason.MISSING_CRITICAL_FIELDS)

        if validation.inconsistencies:
            audit_reasons.append(SemanticAuditReason.INCONSISTENT_DATA)

        for w in validation.warnings:
            if "ilegible" in w.lower() or "borroso" in w.lower():
                audit_reasons.append(SemanticAuditReason.ILLEGIBLE_DOCUMENT)
                break

        if audit_reasons and suggested_dest != RoutingDestination.MEDICAL_EMERGENCY:
            suggested_dest = RoutingDestination.HUMAN_REVIEW

        routing_decision = RoutingDecision(
            primary_destination=suggested_dest,
            audit_reasons=list(set(audit_reasons)),
            justification=justification,
        )

        return AIProcessingResponse(
            document_id=request.document_id,
            classification=classification,
            confidence=confidence,
            extracted_data=extracted_data,
            validation=validation,
            routing_decision=routing_decision,
        )