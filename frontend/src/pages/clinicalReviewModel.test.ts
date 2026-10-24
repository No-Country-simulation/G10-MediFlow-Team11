import { describe, expect, it } from "vitest";
import type { ProcessingResponse } from "../types/processing";
import {
  activeReviewSection, approvalBlockers, changedFields, createReviewPatch, hasSpecialtyChanged, hasUnsavedReviewChanges,
  humanizeMissingField, normalizeReviewExtraction, parseAdditionalJson,
  reviewSourceLabel, reviewWarningMessages, shouldBlockReviewNavigation, warningMissingFieldLabels,
} from "./clinicalReviewModel";

const result: ProcessingResponse = {
  document_id: "DOC-22",
  status: "NEEDS_AUDIT",
  classification: { document_type: "PRESCRIPTION", specialty: null, priority_level: "ROUTINE" },
  confidence: null,
  extracted_data: {
    patient: { name: "Ana" },
    medications: [{ name: "Original", dosage: "10 mg" }],
    requested_studies: [],
    extra: { keep: "unchanged", edit: "old" },
  },
  validation: { missing_fields: [], inconsistencies: [], warnings: [] },
  routing_decision: {
    primary_destination: "HUMAN_REVIEW", requires_human_review: true,
    audit_reasons: [], justification: "Revisar",
  },
  notification: { generated: false },
  storage: { provider: "OCI_OBJECT_STORAGE", state: "SUCCESS" },
};

describe("clinical review form model", () => {
  it("keeps controlled array text raw, then normalizes edited values for PATCH only", () => {
    const draft = {
      ...result.extracted_data!,
      medications: [{ name: "Original", dosage: "10 mg" }, { name: "  Amoxi ", dosage: " 5 mg  " }],
      requested_studies: [{ name: "  Radiografía  " }],
    };
    const normalized = normalizeReviewExtraction(result.extracted_data, draft);
    expect(draft.medications[1].name).toBe("  Amoxi ");
    expect(normalized.medications?.[1]).toEqual({ name: "Amoxi", dosage: "5 mg" });
    expect(normalized.requested_studies?.[0].name).toBe("Radiografía");
    expect(normalized.medications?.[0].name).toBe("Original");
  });

  it("rejects omitted nested keys but permits an explicit null", () => {
    expect(parseAdditionalJson({ keep: "a", nested: { x: 1 } }, '{"keep":"a","nested":{}}', "extra").error)
      .toContain("extra.nested.x");
    expect(parseAdditionalJson({ keep: "a" }, '{"keep":null}', "extra").value)
      .toEqual({ keep: null });
    expect(changedFields({ extra: { keep: "a" } }, { extra: { keep: null } }))
      .toEqual({ extra: { keep: null } });
  });

  it("builds a partial APPROVE patch with normalized array replacements and validation", () => {
    const request = createReviewPatch({
      decision: "APPROVE", result, documentType: "PRESCRIPTION", priority: "URGENT",
      specialty: "", destination: "PHARMACY", confirmed: true, hasExtraError: false,
      extracted: {
        ...result.extracted_data!,
        medications: [{ name: "Original", dosage: "10 mg" }, { name: "  Amoxi ", dosage: "5 mg" }],
        extra: { keep: "unchanged", edit: "new" },
      },
      validation: { missing_fields: [], inconsistencies: [], warnings: [] },
    });
    expect(request).toEqual({
      decision: "APPROVE",
      classification: { priority_level: "URGENT" },
      extracted_data: {
        medications: [{ name: "Original", dosage: "10 mg" }, { name: "Amoxi", dosage: "5 mg" }],
        extra: { edit: "new" },
      },
      routing_decision: { primary_destination: "PHARMACY" },
      validation: { missing_fields: [], inconsistencies: [], warnings: [] },
    });
  });

  it("preserves AI-detected omissions without inventing an optional ICD-10 code", () => {
    const withOmissions: ProcessingResponse = {
      ...result,
      extracted_data: { ...result.extracted_data!, suggested_icd10: null },
      validation: { missing_fields: ["suggested_icd10"], inconsistencies: [], warnings: [] },
    };
    const request = createReviewPatch({
      decision: "APPROVE", result: withOmissions, documentType: "PRESCRIPTION", priority: "ROUTINE",
      specialty: "", destination: "PHARMACY", extracted: withOmissions.extracted_data!,
      validation: withOmissions.validation!, confirmed: true, hasExtraError: false,
    });
    expect(request.validation?.missing_fields).toEqual(["suggested_icd10"]);
    expect(request.extracted_data).toBeUndefined();
  });

  it("allows REJECT without APPROVE requirements and without unconfirmed edits", () => {
    const request = createReviewPatch({
      decision: "REJECT", result, documentType: "", priority: "", specialty: "",
      destination: "HUMAN_REVIEW", extracted: result.extracted_data!,
      validation: result.validation!, confirmed: false, hasExtraError: false,
    });
    expect(request).toEqual({ decision: "REJECT" });
  });

  it.each(["", null, "Cardiología"] as const)("leaves an untouched specialty %s out of APPROVE and confirmed REJECT", (original) => {
    const source: ProcessingResponse = {
      ...result,
      classification: { ...result.classification!, specialty: original },
      routing_decision: { ...result.routing_decision, primary_destination: "PHARMACY" },
    };
    const draft = original ?? "";
    expect(hasSpecialtyChanged(original, draft)).toBe(false);
    expect(shouldBlockReviewNavigation({
      dirty: hasSpecialtyChanged(original, draft), saving: false, success: false,
      currentPath: "/audit/DOC-22/review", nextPath: "/audit",
    })).toBe(false);
    for (const decision of ["APPROVE", "REJECT"] as const) {
      expect(createReviewPatch({
        decision, result: source, documentType: "PRESCRIPTION", priority: "ROUTINE",
        specialty: draft, destination: "PHARMACY", extracted: source.extracted_data!,
        validation: source.validation!, confirmed: true, hasExtraError: false,
      })).toEqual({ decision });
    }
  });

  it.each([
    ["", " Cardiología ", "Cardiología"],
    [null, " Cardiología ", "Cardiología"],
    ["Cardiología", "", null],
    ["Cardiología", "Neurología", "Neurología"],
  ] as const)("patches an intentional specialty change from %s to %s", (original, draft, expected) => {
    const source: ProcessingResponse = {
      ...result,
      classification: { ...result.classification!, specialty: original },
      routing_decision: { ...result.routing_decision, primary_destination: "PHARMACY" },
    };
    expect(hasSpecialtyChanged(original, draft)).toBe(true);
    expect(createReviewPatch({
      decision: "APPROVE", result: source, documentType: "PRESCRIPTION", priority: "ROUTINE",
      specialty: draft, destination: "PHARMACY", extracted: source.extracted_data!,
      validation: source.validation!, confirmed: true, hasExtraError: false,
    })).toEqual({
      decision: "APPROVE", classification: { specialty: expected }, validation: source.validation,
    });
  });

  it("does not include untouched empty specialty when another classification field changes", () => {
    const source: ProcessingResponse = {
      ...result,
      classification: { ...result.classification!, specialty: "" },
    };
    expect(createReviewPatch({
      decision: "APPROVE", result: source, documentType: "PRESCRIPTION", priority: "URGENT",
      specialty: "", destination: "HUMAN_REVIEW", extracted: source.extracted_data!,
      validation: source.validation!, confirmed: true, hasExtraError: false,
    })).toEqual({
      decision: "APPROVE", classification: { priority_level: "URGENT" }, validation: source.validation,
    });
  });

  it("tracks confirmation, unfinished observations and JSON edits as unsaved", () => {
    const base = {
      contentChanged: false, validationChanged: false, confirmed: false,
      drafts: { missing_fields: "", inconsistencies: "", warnings: "" },
      extraJson: { extra: '{"a":1}' }, initialExtraJson: { extra: '{"a":1}' },
    };
    expect(hasUnsavedReviewChanges(base)).toBe(false);
    expect(hasUnsavedReviewChanges({ ...base, confirmed: true })).toBe(true);
    expect(hasUnsavedReviewChanges({ ...base, drafts: { ...base.drafts, warnings: "pending" } })).toBe(true);
    expect(hasUnsavedReviewChanges({ ...base, extraJson: { extra: "{" } })).toBe(true);
  });

  it("blocks internal/back navigation while dirty and releases success or a conflict result link", () => {
    const base = { dirty: true, saving: false, success: false, currentPath: "/audit/DOC-22/review", nextPath: "/audit" };
    expect(shouldBlockReviewNavigation(base)).toBe(true);
    expect(shouldBlockReviewNavigation({ ...base, nextPath: "/results/DOC-22", allowResultPath: "/results/DOC-22" })).toBe(false);
    expect(shouldBlockReviewNavigation({ ...base, success: true })).toBe(false);
    expect(shouldBlockReviewNavigation({ ...base, dirty: false })).toBe(false);
  });

  it("selects the final section at the bottom and humanizes missing fields", () => {
    expect(activeReviewSection(["classification", "destination"], true, ["classification"]))
      .toBe("destination");
    expect(humanizeMissingField("patient.name")).toBe("Nombre del paciente");
    expect(humanizeMissingField("requesting_doctor.license_number")).toBe("N.º de colegiado / matrícula profesional");
    expect(humanizeMissingField("suggested_icd10")).toBe("Código CIE-10 sugerido");
  });

  it("explains every condition that disables approval and clears the help when ready", () => {
    const ready = {
      documentType: "PRESCRIPTION" as const, priority: "ROUTINE" as const,
      destination: "PHARMACY" as const, hasExtraError: false,
      needsValidation: true, confirmed: true, saving: false, success: false, conflict: false,
    };
    expect(approvalBlockers(ready)).toEqual([]);
    expect(approvalBlockers({
      ...ready, documentType: "", priority: "", destination: "HUMAN_REVIEW",
      hasExtraError: true, confirmed: false,
    })).toEqual([
      "Seleccione el tipo de documento.",
      "Seleccione la prioridad.",
      "Seleccione un destino final.",
      "Corrija los errores de formato en Otros datos.",
      "Confirme la validación revisada.",
    ]);
    expect(approvalBlockers({ ...ready, needsValidation: false, confirmed: false })).toEqual([]);
    expect(approvalBlockers({ ...ready, saving: true })).toEqual(["Se está registrando la revisión."]);
    expect(approvalBlockers({ ...ready, success: true })).toEqual(["La revisión ya fue registrada."]);
    expect(approvalBlockers({ ...ready, conflict: true })).toEqual(["El documento ya no está pendiente de revisión."]);
  });

  it("shows only identifiable AI omissions in the warning", () => {
    expect(warningMissingFieldLabels(null)).toEqual([]);
    expect(warningMissingFieldLabels(["", "unknown_field", "__proto__", "patient.age", "patient.age", "suggested_icd10"]))
      .toEqual(["Edad del paciente", "Código CIE-10 sugerido"]);
  });

  it("replaces the generic missing-fields reason with known data or an informative fallback", () => {
    expect(reviewWarningMessages(["MISSING_CRITICAL_FIELDS"], ["patient.age", "unknown_field"]))
      .toEqual(["Información crítica incompleta: Edad del paciente."]);
    expect(reviewWarningMessages(["MISSING_CRITICAL_FIELDS"], ["unknown_field"]))
      .toEqual(["Información crítica incompleta. Revise la validación y el documento original."]);
    expect(reviewWarningMessages(["INCONSISTENT_DATA"], ["patient.age"]))
      .toEqual(["Datos inconsistentes", "Datos no identificados: Edad del paciente."]);
  });

  it("explains low confidence only when that audit reason is present", () => {
    const lowConfidence = reviewWarningMessages(["LOW_CONFIDENCE", "MISSING_CRITICAL_FIELDS"], []);
    expect(lowConfidence).toEqual([
      "La IA asignó baja confianza al análisis. Verifique los datos con el documento original.",
      "Información crítica incompleta. Revise la validación y el documento original.",
    ]);
    expect(reviewWarningMessages(["INCONSISTENT_DATA"], []).join(" ")).not.toContain("confianza");
  });

  it("shows a real filename only for matching queue metadata", () => {
    expect(reviewSourceLabel("DOC-22", false, { documentId: "DOC-22", inputType: "FILE", fileName: "informe.pdf" }))
      .toBe("informe.pdf");
    expect(reviewSourceLabel("DOC-22", false, { documentId: "OTHER", inputType: "FILE", fileName: "other.pdf" }))
      .toBe("Archivo original");
    expect(reviewSourceLabel("DOC-22", false, null)).toBe("Archivo original");
    expect(reviewSourceLabel("DOC-22", true, null)).toBe("Texto ingresado");
  });
});
