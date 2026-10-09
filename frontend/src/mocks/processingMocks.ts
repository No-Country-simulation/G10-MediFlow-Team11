import type { ProcessingResponse } from "../types/processing";

export const successfulProcessingResponse = {
  document_id: "DOC-2026-0001",
  status: "PROCESSED",

  classification: {
    document_type: "IMAGING_REPORT",
    specialty: "Radiología / Neumología",
    priority_level: "URGENT",
  },

  confidence: {
    classification: 0.99,
    extraction: 0.94,
    global: 0.96,
  },

  extracted_data: {
    patient: {
      name: "María Pérez",
      age: 68,
    },
    requesting_doctor: {
      name: "Dr. Juan Gómez",
      license_number: "MP-12345",
    },
    primary_diagnosis: "Posible neumonía",
    suggested_icd10: "J18.9",
    medications: [
      {
        name: "Amoxicilina",
        dosage: "875 mg",
      },
      {
        name: "Paracetamol",
        dosage: "500 mg",
      },
      {
        name: "Azitromicina",
        dosage: "250 mg",
      },
    ],
  },

  validation: {
    missing_fields: [],
    inconsistencies: [],
    warnings: [],
  },

  routing_decision: {
    primary_destination: "MEDICAL_EMERGENCY",
    requires_human_review: false,
    audit_reasons: [],
    justification: "Se han detectado hallazgos clínicos críticos.",
  },

  notification: {
    generated: true,
    type: "MEDICAL_EMERGENCY",
    message:
      "Se ha detectado un hallazgo crítico. Se recomienda una evaluación médica inmediata.",
  },

  storage: {
    provider: "OCI_OBJECT_STORAGE",
    state: "SUCCESS",
  },
} satisfies ProcessingResponse;

export const auditRequiredProcessingResponse = {
  document_id: "DOC-2026-0002",
  status: "NEEDS_AUDIT",

  classification: {
    document_type: "PRESCRIPTION",
    specialty: "Medicina General",
    priority_level: "ROUTINE",
  },

  confidence: {
    classification: 0.82,
    extraction: 0.68,
    global: 0.71,
  },

  extracted_data: {
    patient: {
      name: "Carlos López",
      age: null,
    },
    requesting_doctor: {
      name: "Dra. Ana Martínez",
      license_number: null,
    },
    primary_diagnosis: null,
    suggested_icd10: null,
    medications: [],
  },

  validation: {
    missing_fields: [
      "patient.age",
      "requesting_doctor.license_number",
      "primary_diagnosis",
    ],
    inconsistencies: [],
    warnings: ["Baja confianza en la extracción."],
  },

  routing_decision: {
    primary_destination: "HUMAN_REVIEW",
    requires_human_review: true,
    audit_reasons: ["LOW_CONFIDENCE", "MISSING_CRITICAL_FIELDS"],
    justification:
      "Faltan campos críticos y la confianza en la extracción es baja.",
  },

  notification: {
    generated: false,
  },

  storage: {
    provider: "OCI_OBJECT_STORAGE",
    state: "SUCCESS",
  },
} satisfies ProcessingResponse;
