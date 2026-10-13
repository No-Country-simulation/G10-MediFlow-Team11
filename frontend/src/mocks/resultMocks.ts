import type { ProcessingResponse } from "../types/processing";

export const processedResultMock = {
  document_id: "DOC-2026-0001",
  status: "PROCESSED",

  classification: {
    document_type: "IMAGING_REPORT",
    specialty: "Radiología / Neumología",
    priority_level: "URGENT",
  },

  confidence: {
    classification: 0.99,
    extraction: 0.96,
    global: 0.97,
  },

  extracted_data: {
    patient: {
      name: "Marco Silva Paredes",
      age: 58,
    },
    requesting_doctor: {
      name: "Dra. Laura Mendoza",
      license_number: "MP-45821",
    },
    primary_diagnosis: "Neumonía adquirida en la comunidad",
    suggested_icd10: "J18.9",
    medications: [
      {
        name: "Amoxicilina",
        dosage: "875 mg",
      },
      {
        name: "Azitromicina",
        dosage: "250 mg",
      },
      {
        name: "Paracetamol",
        dosage: "500 mg",
      },
    ],
    measurements: {
      systolic: 128,
      diastolic: 82,
      unit: "mmHg",
    },
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
    justification:
      "Se identificaron hallazgos respiratorios que requieren atención médica prioritaria.",
  },

  notification: {
    generated: true,
    type: "MEDICAL_EMERGENCY",
    message:
      "Se recomienda valoración médica prioritaria por los hallazgos respiratorios identificados.",
  },

  storage: {
    provider: "OCI_OBJECT_STORAGE",
    state: "SUCCESS",
  },
} satisfies ProcessingResponse;

export const needsAuditResultMock = {
  document_id: "DOC-2026-0002",
  status: "NEEDS_AUDIT",

  classification: {
    document_type: "PRESCRIPTION",
    specialty: "Medicina General",
    priority_level: "ROUTINE",
  },

  confidence: {
    classification: 0.82,
    extraction: 0.65,
    global: 0.71,
  },

  extracted_data: {
    patient: {
      name: "Elena Rodríguez Torres",
      age: null,
    },
    requesting_doctor: {
      name: "Dr. Andrés Herrera",
      license_number: null,
    },
    primary_diagnosis: null,
    suggested_icd10: null,
    medications: [
      {
        name: "Losartán",
        dosage: "50 mg",
      },
    ],
  },

  validation: {
    missing_fields: [
      "patient.age",
      "requesting_doctor.license_number",
      "primary_diagnosis",
    ],
    inconsistencies: [],
    warnings: ["La receta presenta campos incompletos que requieren revisión."],
  },

  routing_decision: {
    primary_destination: "HUMAN_REVIEW",
    requires_human_review: true,
    audit_reasons: ["LOW_CONFIDENCE", "MISSING_CRITICAL_FIELDS"],
    justification:
      "La extracción presenta baja confianza y faltan campos clínicos importantes.",
  },

  notification: {
    generated: false,
  },

  storage: {
    provider: "OCI_OBJECT_STORAGE",
    state: "SUCCESS",
  },
} satisfies ProcessingResponse;

export const approvedResultMock = {
  document_id: "DOC-2026-0003",
  status: "APPROVED",

  classification: {
    document_type: "STUDY_REPORT",
    specialty: "Cardiología",
    priority_level: "ROUTINE",
  },

  confidence: {
    classification: 0.94,
    extraction: 0.78,
    global: 0.84,
  },

  extracted_data: {
    patient: {
      name: "Tomás Alfaro Díaz",
      age: 62,
    },
    requesting_doctor: {
      name: "Dra. Patricia Morales",
      license_number: "MP-67324",
    },
    primary_diagnosis: "Hipertensión arterial esencial",
    suggested_icd10: "I10",
    medications: [],
  },

  validation: {
    missing_fields: [],
    inconsistencies: [],
    warnings: [
      "El documento fue derivado inicialmente a revisión por baja confianza.",
    ],
  },

  routing_decision: {
    primary_destination: "MEDICAL_RECORD",
    requires_human_review: false,
    audit_reasons: ["LOW_CONFIDENCE"],
    justification:
      "Documento aprobado tras revisión humana y destinado a la historia clínica.",
  },

  notification: {
    generated: false,
  },

  storage: {
    provider: "OCI_OBJECT_STORAGE",
    state: "SUCCESS",
  },
} satisfies ProcessingResponse;

export const rejectedResultMock = {
  document_id: "DOC-2026-0004",
  status: "REJECTED",

  classification: {
    document_type: "MEDICAL_CERTIFICATE",
    specialty: "Medicina General",
    priority_level: "ROUTINE",
  },

  confidence: {
    classification: 0.76,
    extraction: 0.42,
    global: 0.55,
  },

  extracted_data: {
    patient: {
      name: "Lucía Fernández Castro",
      age: null,
    },
    requesting_doctor: {
      name: null,
      license_number: null,
    },
    primary_diagnosis: null,
    suggested_icd10: null,
    medications: [],
  },

  validation: {
    missing_fields: [
      "patient.age",
      "requesting_doctor.name",
      "requesting_doctor.license_number",
    ],
    inconsistencies: [],
    warnings: [
      "El documento presenta información insuficiente para su validación.",
    ],
  },

  routing_decision: {
    primary_destination: "HUMAN_REVIEW",
    requires_human_review: false,
    audit_reasons: [
      "LOW_CONFIDENCE",
      "MISSING_CRITICAL_FIELDS",
      "ILLEGIBLE_DOCUMENT",
    ],
    justification:
      "Documento rechazado tras revisión humana por información incompleta e ilegible.",
  },

  notification: {
    generated: false,
  },

  storage: {
    provider: "OCI_OBJECT_STORAGE",
    state: "SUCCESS",
  },
} satisfies ProcessingResponse;
