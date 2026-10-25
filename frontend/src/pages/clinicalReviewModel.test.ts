import { describe, expect, it } from "vitest";
import type { ProcessingResponse, Validation } from "../types/processing";
import {
  activeReviewSection, approvalBlockers, changedFields, createReviewPatch, hasSpecialtyChanged, hasUnsavedReviewChanges,
  addLabResultRow, coerceFieldInput, coerceLabCellInput, dropIncompleteNewLabRows, rejectionCopy, findLabResultsKey, hasValidationChanged,
  incompleteNewLabRows, isIncompleteLabRow, labResultPath, newLabResultRow, valueAtPath,
  pendingReviewCopy, pendingReviewState, removeLabResultRow,
  humanizeMissingField, normalizeReviewExtraction, restoredTextValue, writeReviewField,
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
  const textPaths = [
    ["patient", "name"], ["requesting_doctor", "name"], ["requesting_doctor", "license_number"],
    ["primary_diagnosis"], ["suggested_icd10"],
  ];

  it.each(textPaths)("restores the API representation of %s without a clinical PATCH", (...path) => {
    for (const original of [null, "", "Original", undefined]) {
      const sourceData = writeReviewField(null, {}, path, original);
      const source = { ...result, extracted_data: sourceData,
        routing_decision: { ...result.routing_decision, primary_destination: "PHARMACY" as const } };
      const edited = writeReviewField(sourceData, sourceData, path, restoredTextValue("Temporal", original));
      expect(edited).not.toEqual(sourceData);
      expect(createReviewPatch({ decision: "APPROVE", result: source, documentType: "PRESCRIPTION",
        priority: "ROUTINE", specialty: "", destination: "PHARMACY", extracted: edited,
        validation: result.validation!, confirmed: true }).extracted_data)
        .toEqual(writeReviewField(null, {}, path, "Temporal"));
      const restored = writeReviewField(sourceData, edited, path, restoredTextValue(original ?? "", original));
      expect(restored).toEqual(sourceData);
      expect(shouldBlockReviewNavigation({ dirty: JSON.stringify(restored) !== JSON.stringify(sourceData),
        saving: false, success: false, currentPath: "/audit/DOC-22/review", nextPath: "/audit" })).toBe(false);
      for (const decision of ["APPROVE", "REJECT"] as const) {
        expect(createReviewPatch({ decision, result: source, documentType: "PRESCRIPTION", priority: "ROUTINE",
          specialty: "", destination: "PHARMACY", extracted: restored, validation: result.validation!,
          confirmed: true })).toEqual({ decision });
      }
      if (original === "Original") {
        const cleared = writeReviewField(sourceData, sourceData, path, restoredTextValue("", original));
        expect(cleared).not.toEqual(sourceData);
        expect(createReviewPatch({ decision: "APPROVE", result: source, documentType: "PRESCRIPTION",
          priority: "ROUTINE", specialty: "", destination: "PHARMACY", extracted: cleared,
          validation: result.validation!, confirmed: true }).extracted_data)
          .toEqual(writeReviewField(null, {}, path, null));
      }
    }
  });

  it.each(["patient", "requesting_doctor"])("restores a null %s parent after editing its name", (key) => {
    const sourceData = { [key]: null };
    const path = [key, "name"];
    const edited = writeReviewField(sourceData, sourceData, path, restoredTextValue("Temporal", null));
    const restored = writeReviewField(sourceData, edited, path, restoredTextValue("", null));
    expect(restored).toEqual(sourceData);
    const source = { ...result, extracted_data: sourceData };
    expect(createReviewPatch({ decision: "REJECT", result: source, documentType: "PRESCRIPTION",
      priority: "ROUTINE", specialty: "", destination: "HUMAN_REVIEW", extracted: restored,
      validation: result.validation!, confirmed: true })).toEqual({ decision: "REJECT" });
  });

  it("keeps mixed medication fields tied to their own entries and preserves order", () => {
    const originals = [{ name: null, dosage: "" }, { name: "", dosage: null }, { name: "Texto", dosage: "10 mg" }];
    const source = { ...result, extracted_data: { ...result.extracted_data!, medications: originals },
      routing_decision: { ...result.routing_decision, primary_destination: "PHARMACY" as const } };
    for (const key of ["name", "dosage"] as const) {
      for (const index of [0, 1, 2]) {
        const draft = structuredClone(originals);
        draft[index][key] = restoredTextValue("Temporal", originals[index][key]);
        expect(draft).not.toEqual(originals);
        draft[index][key] = restoredTextValue(originals[index][key] ?? "", originals[index][key]);
        expect(draft).toEqual(originals);
        expect(normalizeReviewExtraction(source.extracted_data, { ...source.extracted_data, medications: draft }, originals))
          .toEqual(source.extracted_data);
        expect(createReviewPatch({ decision: "APPROVE", result: source, documentType: "PRESCRIPTION",
          priority: "ROUTINE", specialty: "", destination: "PHARMACY", extracted: { ...source.extracted_data, medications: draft },
          medicationOriginals: originals, validation: result.validation!, confirmed: true }))
          .toEqual({ decision: "APPROVE" });
      }
    }
    const remaining = [originals[1], originals[2]];
    expect(normalizeReviewExtraction(source.extracted_data, { ...source.extracted_data, medications: remaining }, remaining).medications)
      .toEqual(remaining);
  });

  it("patches only an intentional medication edit or clear, while unconfirmed REJECT sends no edits", () => {
    const originals = [{ name: null, dosage: "" }, { name: "Texto", dosage: "10 mg" }];
    const source = { ...result, extracted_data: { ...result.extracted_data!, medications: originals } };
    const draft = structuredClone(originals);
    draft[1].name = restoredTextValue("", originals[1].name);
    expect(draft[1].name).toBeNull();
    expect(createReviewPatch({ decision: "APPROVE", result: source, documentType: "PRESCRIPTION",
      priority: "ROUTINE", specialty: "", destination: "HUMAN_REVIEW", extracted: { ...source.extracted_data, medications: draft },
      medicationOriginals: originals, validation: result.validation!, confirmed: true }).extracted_data)
      .toEqual({ medications: [{ name: null, dosage: "" }, { name: null, dosage: "10 mg" }] });
    expect(createReviewPatch({ decision: "REJECT", result: source, documentType: "PRESCRIPTION",
      priority: "ROUTINE", specialty: "", destination: "HUMAN_REVIEW", extracted: { ...source.extracted_data, medications: draft },
      medicationOriginals: originals, validation: result.validation!, confirmed: false }))
      .toEqual({ decision: "REJECT" });
  });

  it("restores a null study without changing mixed or duplicate studies", () => {
    const studies = [{ name: null }, { name: "" }, { name: "Eco" }, { name: "Eco" }];
    const source = { ...result, extracted_data: { ...result.extracted_data!, requested_studies: studies } };
    expect(normalizeReviewExtraction(source.extracted_data, source.extracted_data)).toEqual(source.extracted_data);
    expect(createReviewPatch({ decision: "REJECT", result: source, documentType: "PRESCRIPTION",
      priority: "ROUTINE", specialty: "", destination: "HUMAN_REVIEW", extracted: source.extracted_data,
      validation: result.validation!, confirmed: true })).toEqual({ decision: "REJECT" });
    const draft = structuredClone(source.extracted_data);
    for (const index of [0, 1, 2, 3]) {
      draft.requested_studies![index].name = restoredTextValue("Temporal", studies[index].name);
      draft.requested_studies![index].name = restoredTextValue(studies[index].name ?? "", studies[index].name);
    }
    expect(draft).toEqual(source.extracted_data);
    expect(normalizeReviewExtraction(source.extracted_data, draft)).toEqual(source.extracted_data);
    expect(createReviewPatch({ decision: "REJECT", result: source, documentType: "PRESCRIPTION",
      priority: "ROUTINE", specialty: "", destination: "HUMAN_REVIEW", extracted: draft,
      validation: result.validation!, confirmed: true })).toEqual({ decision: "REJECT" });
  });

  it("keeps study origins aligned after deleting an intermediate entry", () => {
    const studies = [{ name: null }, { name: "Eco" }, { name: "" }, { name: "Eco" }];
    const source = { ...result, extracted_data: { ...result.extracted_data!, requested_studies: studies } };
    const remaining = [studies[0], studies[2], studies[3]];
    const draft = structuredClone(source.extracted_data);
    draft.requested_studies!.splice(1, 1);
    draft.requested_studies![1].name = restoredTextValue("Temporal", remaining[1].name);
    draft.requested_studies![1].name = restoredTextValue("", remaining[1].name);
    expect(normalizeReviewExtraction(source.extracted_data, draft, source.extracted_data.medications, remaining).requested_studies)
      .toEqual(remaining);
    expect(createReviewPatch({ decision: "REJECT", result: source, documentType: "PRESCRIPTION",
      priority: "ROUTINE", specialty: "", destination: "HUMAN_REVIEW", extracted: draft,
      studyOriginals: remaining, validation: result.validation!, confirmed: true }).extracted_data)
      .toEqual({ requested_studies: remaining });
  });

  it("sends intentional study edits and clears without changing neighbors", () => {
    const studies = [{ name: null }, { name: "" }, { name: "Eco" }];
    const source = { ...result, extracted_data: { ...result.extracted_data!, requested_studies: studies } };
    const draft = structuredClone(source.extracted_data);
    draft.requested_studies![2].name = restoredTextValue("", studies[2].name);
    expect(createReviewPatch({ decision: "REJECT", result: source, documentType: "PRESCRIPTION",
      priority: "ROUTINE", specialty: "", destination: "HUMAN_REVIEW", extracted: draft,
      validation: result.validation!, confirmed: true }).extracted_data)
      .toEqual({ requested_studies: [{ name: null }, { name: "" }, { name: null }] });
  });

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

  it("builds a partial APPROVE patch with normalized array replacements and validation", () => {
    const request = createReviewPatch({
      decision: "APPROVE", result, documentType: "PRESCRIPTION", priority: "URGENT",
      specialty: "", destination: "PHARMACY", confirmed: true,
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
      validation: withOmissions.validation!, confirmed: true,
    });
    expect(request.validation?.missing_fields).toEqual(["suggested_icd10"]);
    expect(request.extracted_data).toBeUndefined();
  });

  it("allows REJECT without APPROVE requirements and without unconfirmed edits", () => {
    const request = createReviewPatch({
      decision: "REJECT", result, documentType: "", priority: "", specialty: "",
      destination: "HUMAN_REVIEW", extracted: result.extracted_data!,
      validation: result.validation!, confirmed: false,
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
        validation: source.validation!, confirmed: true,
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
      validation: source.validation!, confirmed: true,
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
      validation: source.validation!, confirmed: true,
    })).toEqual({
      decision: "APPROVE", classification: { priority_level: "URGENT" }, validation: source.validation,
    });
  });

  it("tracks confirmation and unfinished observations as unsaved", () => {
    const base = {
      contentChanged: false, validationChanged: false, confirmed: false,
      drafts: { missing_fields: "", inconsistencies: "", warnings: "" },
    };
    expect(hasUnsavedReviewChanges(base)).toBe(false);
    expect(hasUnsavedReviewChanges({ ...base, confirmed: true })).toBe(true);
    expect(hasUnsavedReviewChanges({ ...base, drafts: { ...base.drafts, warnings: "pending" } })).toBe(true);
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
      destination: "PHARMACY" as const,
      confirmed: true, saving: false, success: false, conflict: false,
    };
    expect(approvalBlockers(ready)).toEqual([]);
    expect(approvalBlockers({
      ...ready, documentType: "", priority: "", destination: "HUMAN_REVIEW",
      confirmed: false,
    })).toEqual([
      "Seleccione el tipo de documento.",
      "Seleccione la prioridad.",
      "Seleccione un destino final.",
      "Confirme la validación revisada.",
    ]);
    expect(approvalBlockers({ ...ready, confirmed: false })).toEqual(["Confirme la validación revisada."]);
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

describe("validation comparison by content", () => {
  const keys = ["missing_fields", "inconsistencies", "warnings"] as const;
  const original: Validation = {
    missing_fields: ["patient.name", "patient.age"],
    inconsistencies: ["Edad no coincide", "Fecha ilegible"],
    warnings: ["Sin firma", "Sello borroso"],
  };
  const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(
    (order) => Object.fromEntries(order.map((index) => [keys[index], [...original[keys[index]]]])) as unknown as Validation,
  );
  const base: ProcessingResponse = {
    document_id: "DOC-31",
    status: "NEEDS_AUDIT",
    classification: { document_type: "STUDY_REPORT", specialty: "Laboratorio Clínico", priority_level: "ROUTINE" },
    confidence: null,
    extracted_data: {
      patient: { name: null, age: 46 },
      lab_results: [
        { name: "Glucosa en sangre", unit: "mg/dL", value: "174", reference_range: "70–99 mg/dL" },
        { name: "Creatinina sérica", unit: "mg/dL", value: "0.86", reference_range: "0.6–1.1 mg/dL" },
      ],
    },
    validation: { inconsistencies: [...original.inconsistencies], missing_fields: [...original.missing_fields], warnings: [...original.warnings] },
    routing_decision: { primary_destination: "MEDICAL_RECORD", requires_human_review: true, audit_reasons: [], justification: "Revisar" },
    notification: { generated: false },
    storage: { provider: "OCI_OBJECT_STORAGE", state: "SUCCESS" },
  };
  const patchFor = (decision: "APPROVE" | "REJECT", validation: Validation, result = base, extracted = structuredClone(result.extracted_data!)) =>
    createReviewPatch({
      decision, result, documentType: "STUDY_REPORT", priority: "ROUTINE", specialty: "Laboratorio Clínico",
      destination: "MEDICAL_RECORD", extracted, validation, confirmed: true,
    });

  it("treats validation objects with the same content and a different key order as equivalent", () => {
    expect(permutations.some((candidate) => JSON.stringify(candidate) !== JSON.stringify(original))).toBe(true);
    for (const candidate of permutations) {
      expect(hasValidationChanged(candidate, original)).toBe(false);
      expect(hasValidationChanged(original, candidate)).toBe(false);
    }
  });

  it.each(keys)("detects a real change in %s: edit, addition, removal, clearing and reordering", (key) => {
    const items = original[key];
    const variants: string[][] = [
      [...items, "Nuevo"],
      items.slice(1),
      items.map((item, index) => (index === 0 ? `${item}.` : item)),
      [...items].reverse(),
      [],
    ];
    for (const variant of variants) {
      expect(hasValidationChanged({ ...original, [key]: variant }, original)).toBe(true);
    }
  });

  it("keeps the order of the items significant and compares each array independently", () => {
    expect(hasValidationChanged({ ...original, warnings: [...original.warnings].reverse() }, original)).toBe(true);
    expect(hasValidationChanged({ ...original, missing_fields: original.warnings, warnings: original.missing_fields }, original)).toBe(true);
  });

  it("compares an absent original validation as an empty one, as before", () => {
    const empty: Validation = { missing_fields: [], inconsistencies: [], warnings: [] };
    expect(hasValidationChanged(empty, null)).toBe(false);
    expect(hasValidationChanged(empty, undefined)).toBe(false);
    expect(hasValidationChanged({ ...empty, warnings: ["Sin firma"] }, null)).toBe(true);
  });

  it("treats a missing array of the original as empty and does not mutate or sort its inputs", () => {
    const partial = { missing_fields: ["patient.name"] } as Validation;
    expect(hasValidationChanged({ missing_fields: ["patient.name"], inconsistencies: [], warnings: [] }, partial)).toBe(false);
    expect(hasValidationChanged({ missing_fields: ["patient.name"], inconsistencies: [], warnings: ["x"] }, partial)).toBe(true);

    const current = structuredClone(original);
    const snapshot = structuredClone(original);
    Object.freeze(current.missing_fields);
    Object.freeze(current.warnings);
    expect(() => hasValidationChanged(Object.freeze(current), Object.freeze(original))).not.toThrow();
    expect(current).toEqual(snapshot);
    expect(original).toEqual(snapshot);
  });

  it("does not include validation in the PATCH for a key-order-only difference", () => {
    for (const candidate of permutations) {
      for (const decision of ["APPROVE", "REJECT"] as const) {
        const request = patchFor(decision, candidate);
        expect(request).toEqual({ decision });
        expect(request.validation).toBeUndefined();
        expect(request.extracted_data).toBeUndefined();
      }
    }
  });

  it("keeps extracted_data and lab_results untouched when only the key order differs", () => {
    const extracted = structuredClone(base.extracted_data!);
    const snapshot = structuredClone(extracted);
    const request = patchFor("APPROVE", permutations[0], base, extracted);

    expect(request).toEqual({ decision: "APPROVE" });
    expect(extracted).toEqual(snapshot);
    expect(extracted.lab_results).toEqual(base.extracted_data!.lab_results);
  });

  it("includes the full validation, in order, when a real change exists", () => {
    const changed: Validation = { ...original, warnings: [...original.warnings, "Nueva advertencia"] };
    expect(patchFor("APPROVE", changed)).toEqual({ decision: "APPROVE", validation: changed });
    const reordered: Validation = { ...original, inconsistencies: [...original.inconsistencies].reverse() };
    expect(patchFor("APPROVE", reordered).validation).toEqual(reordered);
    expect(patchFor("APPROVE", reordered).validation?.inconsistencies).toEqual(["Fecha ilegible", "Edad no coincide"]);
  });

  it("still sends validation when the original validation was null", () => {
    const empty: Validation = { missing_fields: [], inconsistencies: [], warnings: [] };
    const request = patchFor("APPROVE", empty, { ...base, validation: null });
    expect(request).toEqual({ decision: "APPROVE", validation: empty });
  });

  it("marks unsaved changes and blocks navigation only for real validation changes", () => {
    const state = (validationChanged: boolean) => ({
      contentChanged: false, validationChanged, confirmed: false,
      drafts: { missing_fields: "", inconsistencies: "", warnings: "" },
      });
    const navigation = (dirty: boolean) => shouldBlockReviewNavigation({
      dirty, saving: false, success: false, currentPath: "/audit/DOC-31/review", nextPath: "/audit",
    });

    const orderOnly = hasUnsavedReviewChanges(state(hasValidationChanged(permutations[3], base.validation)));
    const real = hasUnsavedReviewChanges(state(hasValidationChanged({ ...original, warnings: [] }, base.validation)));

    expect([orderOnly, real]).toEqual([false, true]);
    expect([navigation(orderOnly), navigation(real)]).toEqual([false, true]);
  });
});

describe("mandatory validation confirmation", () => {
  const backendValidation: Validation = { inconsistencies: [], missing_fields: ["patient.name"], warnings: [] };
  const screenValidation: Validation = { missing_fields: ["patient.name"], inconsistencies: [], warnings: [] };
  const labResults = [
    { name: "Glucosa en sangre", unit: "mg/dL", value: "174", reference_range: "70–99 mg/dL" },
    { name: "Hemoglobina glucosilada (HbA1c)", unit: "%", value: "8.2", reference_range: "inferior a 5.7 %" },
    { name: "Creatinina sérica", unit: "mg/dL", value: "0.86", reference_range: "0.6–1.1 mg/dL" },
  ];
  const source: ProcessingResponse = {
    document_id: "DOC-781aa513-1e1c-41fc-a29c-95f17af0f067",
    status: "NEEDS_AUDIT",
    classification: { document_type: "STUDY_REPORT", specialty: "Laboratorio Clínico", priority_level: "ROUTINE" },
    confidence: null,
    extracted_data: { patient: { name: null, age: 46 }, lab_results: labResults },
    validation: backendValidation,
    routing_decision: { primary_destination: "MEDICAL_RECORD", requires_human_review: true, audit_reasons: [], justification: "Revisar" },
    notification: { generated: false },
    storage: { provider: "OCI_OBJECT_STORAGE", state: "SUCCESS" },
  };
  const ready = {
    documentType: "STUDY_REPORT" as const, priority: "ROUTINE" as const, destination: "MEDICAL_RECORD" as const,
    saving: false, success: false, conflict: false,
  };
  const idle = {
    contentChanged: false, validationChanged: false, confirmed: false,
    drafts: { missing_fields: "", inconsistencies: "", warnings: "" },
  };
  const patch = (decision: "APPROVE" | "REJECT", overrides: Partial<Parameters<typeof createReviewPatch>[0]> = {}) =>
    createReviewPatch({
      decision, result: source, documentType: "STUDY_REPORT", priority: "ROUTINE", specialty: "Laboratorio Clínico",
      destination: "MEDICAL_RECORD", extracted: structuredClone(source.extracted_data!), validation: screenValidation,
      confirmed: true, ...overrides,
    });

  it("blocks approving an untouched document until the validation is confirmed", () => {
    expect(approvalBlockers({ ...ready, confirmed: false })).toEqual(["Confirme la validación revisada."]);
    expect(approvalBlockers({ ...ready, confirmed: true })).toEqual([]);
  });

  it("requires the confirmation again once it has been cleared, and keeps it as the last reason", () => {
    expect(approvalBlockers({ ...ready, confirmed: true })).toEqual([]);
    expect(approvalBlockers({ ...ready, confirmed: false, hasIncompleteLabRows: true })).toEqual([
      "Complete Prueba y Resultado, o elimine las filas nuevas incompletas de resultados de laboratorio.",
      "Confirme la validación revisada.",
    ]);
    expect(approvalBlockers({ ...ready, confirmed: false, priority: "" })).toEqual([
      "Seleccione la prioridad.",
      "Confirme la validación revisada.",
    ]);
  });

  it("does not make the confirmation a condition for rejecting", () => {
    expect(patch("REJECT", { confirmed: false })).toEqual({ decision: "REJECT" });
    expect(patch("REJECT", { confirmed: false, priority: "URGENT" })).toEqual({ decision: "REJECT" });
  });

  it("distinguishes a pending confirmation from pending data changes", () => {
    expect(pendingReviewState(idle)).toBeNull();
    expect(pendingReviewState({ ...idle, confirmed: true })).toBe("confirmation");
    expect(pendingReviewState({ ...idle, contentChanged: true })).toBe("data");
    expect(pendingReviewState({ ...idle, validationChanged: true })).toBe("data");
    expect(pendingReviewState({ ...idle, drafts: { ...idle.drafts, warnings: "pendiente" } })).toBe("data");
    expect(pendingReviewState({ ...idle, confirmed: true, contentChanged: true })).toBe("data");
  });

  it("treats an invalid lab draft as pending data even when nothing else changed", () => {
    const invalid = { ...idle, hasInvalidLabDrafts: true };

    expect(hasUnsavedReviewChanges(invalid)).toBe(true);
    expect(pendingReviewState(invalid)).toBe("data");
    expect(pendingReviewState({ ...invalid, confirmed: true })).toBe("data");
    expect(pendingReviewState({ ...idle, hasInvalidLabDrafts: false })).toBeNull();
    expect(pendingReviewState(idle)).toBeNull();
  });

  it("blocks navigation while an invalid lab draft is visible and releases it once none remains", () => {
    const blocks = (hasInvalidLabDrafts: boolean, extra: { saving?: boolean; success?: boolean } = {}) => shouldBlockReviewNavigation({
      dirty: pendingReviewState({ ...idle, hasInvalidLabDrafts }) !== null,
      saving: false, success: false, ...extra,
      currentPath: "/audit/DOC-781/review", nextPath: "/audit",
    });

    expect(blocks(true)).toBe(true);
    expect(blocks(false)).toBe(false);
    expect(blocks(true, { success: true })).toBe(false);
  });

  it("reports a pending state exactly when the previous unsaved-changes rule did", () => {
    for (let mask = 0; mask < 16; mask++) {
      const input = {
        contentChanged: !!(mask & 1), validationChanged: !!(mask & 2), confirmed: !!(mask & 4),
        drafts: { ...idle.drafts, warnings: mask & 8 ? "x" : "" },
      };
      expect(pendingReviewState(input) !== null).toBe(hasUnsavedReviewChanges(input));
    }
  });

  it("uses distinct, non-misleading copy when only the confirmation is pending", () => {
    const data = pendingReviewCopy("data");
    const confirmation = pendingReviewCopy("confirmation");

    expect(data).toEqual({
      indicator: "● Cambios sin registrar",
      dialogTitle: "Cambios sin guardar",
      dialogMessage: "Se realizaron modificaciones que no han sido registradas. ¿Desea salir de todas formas?",
    });
    expect(confirmation.indicator).toContain("Validación confirmada");
    expect(confirmation.indicator).not.toContain("Cambios sin registrar");
    expect(confirmation.dialogTitle).not.toBe(data.dialogTitle);
    expect(confirmation.dialogMessage).toContain("No se modificaron datos");
    expect(confirmation.dialogMessage).not.toContain("modificaciones que no han sido registradas");
  });

  it("keeps the navigation protection for pending data and a pending confirmation only", () => {
    const blocks = (state: ReturnType<typeof pendingReviewState>, success = false) => shouldBlockReviewNavigation({
      dirty: state !== null, saving: false, success, currentPath: "/audit/DOC-781/review", nextPath: "/audit",
    });

    expect(blocks(pendingReviewState(idle))).toBe(false);
    expect(blocks(pendingReviewState({ ...idle, confirmed: true }))).toBe(true);
    expect(blocks(pendingReviewState({ ...idle, contentChanged: true }))).toBe(true);
    expect(blocks(pendingReviewState({ ...idle, confirmed: true }), true)).toBe(false);
  });

  it("approves an untouched document without sending validation or extracted data", () => {
    for (const validation of [backendValidation, screenValidation]) {
      const request = patch("APPROVE", { validation });
      expect(request).toEqual({ decision: "APPROVE" });
      expect(request.validation).toBeUndefined();
      expect(request.extracted_data).toBeUndefined();
    }
  });

  it("does not alter the inputs when the confirmation is set", () => {
    const extracted = structuredClone(source.extracted_data!);
    const validation = structuredClone(screenValidation);
    const snapshot = { extracted: structuredClone(extracted), validation: structuredClone(validation) };

    patch("APPROVE", { extracted, validation });

    expect(extracted).toEqual(snapshot.extracted);
    expect(extracted.lab_results).toEqual(labResults);
    expect(validation).toEqual(snapshot.validation);
  });

  it("approves with modifications by sending only the changed contents and the validation", () => {
    const extracted = { ...structuredClone(source.extracted_data!), patient: { name: "Ana López", age: 46 } };
    const validation: Validation = { ...screenValidation, missing_fields: [], warnings: ["Nombre completado manualmente"] };
    const request = patch("APPROVE", { extracted, validation, priority: "URGENT" });

    expect(request).toEqual({
      decision: "APPROVE",
      classification: { priority_level: "URGENT" },
      extracted_data: { patient: { name: "Ana López" } },
      validation,
    });
    expect(request.extracted_data).not.toHaveProperty("lab_results");
  });
});

describe("structured lab_results editing", () => {
  const rows = () => [
    { name: "Glucosa en sangre", unit: "mg/dL", value: "174", reference_range: "70–99 mg/dL" },
    { name: "Hemoglobina glucosilada (HbA1c)", unit: "%", value: "8.2", reference_range: "inferior a 5.7 %" },
    { name: "Creatinina sérica", unit: "mg/dL", value: "0.86", reference_range: "0.6–1.1 mg/dL" },
  ];
  const validation: Validation = { inconsistencies: [], missing_fields: ["patient.name"], warnings: [] };
  const sourceFor = (labResults: unknown): ProcessingResponse => ({
    document_id: "DOC-LAB",
    status: "NEEDS_AUDIT",
    classification: { document_type: "STUDY_REPORT", specialty: "Laboratorio Clínico", priority_level: "ROUTINE" },
    confidence: null,
    extracted_data: { patient: { name: null, age: 46 }, lab_results: labResults },
    validation,
    routing_decision: { primary_destination: "MEDICAL_RECORD", requires_human_review: true, audit_reasons: [], justification: "Revisar" },
    notification: { generated: false },
    storage: { provider: "OCI_OBJECT_STORAGE", state: "SUCCESS" },
  });
  const patchFor = (source: ProcessingResponse, extracted: ProcessingResponse["extracted_data"]) =>
    createReviewPatch({
      decision: "APPROVE", result: source, documentType: "STUDY_REPORT", priority: "ROUTINE", specialty: "Laboratorio Clínico",
      destination: "MEDICAL_RECORD", extracted: extracted!, validation: structuredClone(validation), confirmed: true,
    });

  it("edits only the glucose value and sends the complete updated array", () => {
    const source = sourceFor(rows());
    const edited = writeReviewField(source.extracted_data, source.extracted_data!, labResultPath(0, "value"), "180");
    const expected = rows();
    expected[0].value = "180";

    expect(edited.lab_results).toEqual(expected);
    expect((edited.lab_results as unknown[])[1]).toEqual(rows()[1]);
    expect((edited.lab_results as unknown[])[2]).toEqual(rows()[2]);
    const request = patchFor(source, edited);
    expect(request.extracted_data).toEqual({ lab_results: expected });
    expect(request.validation).toEqual(validation);
    expect(request.extracted_data).not.toHaveProperty("patient");
  });

  it("does not create changes when an original value is restored", () => {
    const source = sourceFor(rows());
    const edited = writeReviewField(source.extracted_data, source.extracted_data!, labResultPath(0, "value"), "180");
    const restored = writeReviewField(source.extracted_data, edited, labResultPath(0, "value"), restoredTextValue("174", "174"));

    expect(restored).toEqual(source.extracted_data);
    expect(changedFields(source.extracted_data!, restored)).toEqual({});
    expect(patchFor(source, restored)).toEqual({ decision: "APPROVE" });
  });

  it("restores a null original after clearing the field", () => {
    const source = sourceFor([{ name: "TSH", value: "2.4", unit: null, reference_range: null }]);
    const edited = writeReviewField(source.extracted_data, source.extracted_data!, labResultPath(0, "unit"), restoredTextValue("mUI/L", null));
    const restored = writeReviewField(source.extracted_data, edited, labResultPath(0, "unit"), restoredTextValue("", null));

    expect(edited).not.toEqual(source.extracted_data);
    expect(restored).toEqual(source.extracted_data);
    expect(patchFor(source, restored)).toEqual({ decision: "APPROVE" });
  });

  it("adds a row at the end and discards it again without leaving changes", () => {
    const source = sourceFor(rows());
    const added = addLabResultRow(source.extracted_data!);

    expect(added.lab_results).toEqual([...rows(), { name: "", value: "", unit: null, reference_range: null }]);
    expect(patchFor(source, added).extracted_data).toEqual({ lab_results: added.lab_results });
    const filled = writeReviewField(source.extracted_data, added, labResultPath(3, "name"), "TSH");
    expect((filled.lab_results as { name: string }[])[3].name).toBe("TSH");
    expect(removeLabResultRow(added, 3)).toEqual(source.extracted_data);
    expect(patchFor(source, removeLabResultRow(added, 3))).toEqual({ decision: "APPROVE" });
  });

  it("removes an original row keeping the others in order", () => {
    const source = sourceFor(rows());
    const removed = removeLabResultRow(source.extracted_data!, 1);

    expect(removed.lab_results).toEqual([rows()[0], rows()[2]]);
    expect(patchFor(source, removed).extracted_data).toEqual({ lab_results: [rows()[0], rows()[2]] });
    expect(removeLabResultRow(source.extracted_data!, 9)).toEqual(source.extracted_data);
  });

  it("creates the array when the document has no lab_results and ignores malformed values", () => {
    expect(addLabResultRow({ patient: { name: "Ana" } }).lab_results).toEqual([{ name: "", value: "", unit: null, reference_range: null }]);
    expect(addLabResultRow({ lab_results: null }).lab_results).toHaveLength(1);
    expect(addLabResultRow({ lab_results: "texto" })).toEqual({ lab_results: "texto" });
    expect(removeLabResultRow({ patient: { name: "Ana" } }, 0)).toEqual({ patient: { name: "Ana" } });
  });

  it("keeps unknown properties, nulls and original types of untouched fields", () => {
    const original = [
      { name: "Glucosa", value: 174, unit: null, reference_range: "70–99", flag: "alto", extra: { nota: null } },
      { name: "TSH", value: "2.4", unit: "mUI/L", labCode: 12, ok: true },
    ];
    const source = sourceFor(structuredClone(original));
    const edited = writeReviewField(source.extracted_data, source.extracted_data!, labResultPath(1, "unit"), "mUI/mL");
    const result = edited.lab_results as Record<string, unknown>[];

    expect(result[0]).toEqual(original[0]);
    expect(result[0].value).toBe(174);
    expect(result[0].unit).toBeNull();
    expect(result[1]).toEqual({ ...original[1], unit: "mUI/mL" });
    expect(result[1].labCode).toBe(12);
    expect(result[1].ok).toBe(true);
    expect(Object.keys(result[1])).toEqual(Object.keys(original[1]));
    expect(patchFor(source, edited).extracted_data).toEqual({ lab_results: result });
  });

  it("sends no lab_results without an edit and the full array with one", () => {
    const source = sourceFor(rows());
    const untouched = patchFor(source, structuredClone(source.extracted_data));
    expect(untouched).toEqual({ decision: "APPROVE" });
    expect(untouched.extracted_data).toBeUndefined();

    const edited = writeReviewField(source.extracted_data, source.extracted_data!, labResultPath(2, "value"), "0.9");
    const request = patchFor(source, edited);
    expect(Object.keys(request.extracted_data!)).toEqual(["lab_results"]);
    expect((request.extracted_data!.lab_results as unknown[]).length).toBe(3);
  });

  it("does not mutate the original or the draft", () => {
    const source = sourceFor(rows());
    const original = source.extracted_data!;
    const snapshot = structuredClone(original);
    const frozen = deepFreezeValue(original);

    const edited = writeReviewField(frozen, frozen, labResultPath(0, "value"), "180");
    const added = addLabResultRow(frozen);
    const removed = removeLabResultRow(frozen, 0);
    patchFor(source, edited);

    expect(frozen).toEqual(snapshot);
    expect(edited).not.toBe(frozen);
    expect(added.lab_results).not.toBe(frozen.lab_results);
    expect(removed.lab_results).toHaveLength(2);
  });
});

function deepFreezeValue<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreezeValue(child);
  }
  return value;
}

describe("lab_results editing in the review screen", () => {
  const rows = () => [
    { nombre: "Glucosa", valor: "174", unidad: "mg/dL", referenceRange: "70–99 mg/dL", flag: "alto" },
    { nombre: "TSH", valor: "2.4", unidad: "mUI/L", referenceRange: null },
  ];

  it("finds the original key of lab_results, including aliases, only for non-empty lists of objects", () => {
    expect(findLabResultsKey({ lab_results: rows() })).toBe("lab_results");
    expect(findLabResultsKey({ labResults: rows() })).toBe("labResults");
    expect(findLabResultsKey({ resultados_de_laboratorio: rows() })).toBe("resultados_de_laboratorio");
    expect(findLabResultsKey({ lab_results: [] })).toBeNull();
    expect(findLabResultsKey({ lab_results: ["174"] })).toBeNull();
    expect(findLabResultsKey({ lab_results: null })).toBeNull();
    expect(findLabResultsKey({ measurements: rows() })).toBeNull();
    expect(findLabResultsKey(null)).toBeNull();
  });

  it("can also find the original key when the list is empty or null", () => {
    expect(findLabResultsKey({ labResults: [] }, true)).toBe("labResults");
    expect(findLabResultsKey({ labResults: null }, true)).toBe("labResults");
    expect(findLabResultsKey({ lab_results: ["x"] }, true)).toBeNull();
    expect(findLabResultsKey({ patient: {} }, true)).toBeNull();
    expect(findLabResultsKey({ labResults: [] })).toBeNull();
  });

  it("edits through the original alias key without creating a duplicate property", () => {
    const original = { patient: { name: "Ana" }, labResults: rows() };
    const edited = writeReviewField(original, original, labResultPath(0, "valor", "labResults"), "180");

    expect(Object.keys(edited)).toEqual(["patient", "labResults"]);
    expect(edited).not.toHaveProperty("lab_results");
    expect((edited.labResults as Record<string, unknown>[])[0]).toEqual({ ...rows()[0], valor: "180" });
    expect(changedFields(original, edited)).toEqual({ labResults: (edited.labResults as unknown[]) });
    expect(Object.keys(addLabResultRow(original, undefined, "labResults"))).toEqual(["patient", "labResults"]);
    expect(removeLabResultRow(original, 1, "labResults").labResults).toEqual([rows()[0]]);
  });

  it("detects incomplete rows through the canonical name and value, only when they are new", () => {
    expect(isIncompleteLabRow({ name: "", value: "  ", unit: null })).toBe(true);
    expect(isIncompleteLabRow({})).toBe(true);
    expect(isIncompleteLabRow({ name: "TSH", value: "" })).toBe(true);
    expect(isIncompleteLabRow({ name: "", value: "2.4" })).toBe(true);
    expect(isIncompleteLabRow({ name: "TSH", value: "2.4" })).toBe(false);
    expect(isIncompleteLabRow({ nombre: "TSH", valor: 0 })).toBe(false);
    expect(isIncompleteLabRow({ nombre: "TSH", valor: null })).toBe(true);
    expect(isIncompleteLabRow(null)).toBe(false);

    const list = [{ name: "", value: "" }, { name: "", value: "" }, { name: "TSH", value: "" }, { name: "TSH", value: "1" }];
    expect(incompleteNewLabRows(list, [false, true, true, true])).toEqual([1, 2]);
    expect(incompleteNewLabRows(list, [false, false, false, false])).toEqual([]);
    expect(incompleteNewLabRows("no es lista", [true])).toEqual([]);
  });

  it("drops only the incomplete new rows and never an existing record", () => {
    const draft = { patient: { name: "Ana" }, lab_results: [{ name: "", value: "" }, { name: "TSH", value: "2.4" }, { name: "", value: "" }, { name: "T4", value: "" }] };
    const snapshot = structuredClone(draft);
    const next = dropIncompleteNewLabRows(draft, "lab_results", [false, true, true, true]);

    expect(next.lab_results).toEqual([{ name: "", value: "" }, { name: "TSH", value: "2.4" }]);
    expect(draft).toEqual(snapshot);
    expect(dropIncompleteNewLabRows({ patient: {} }, "lab_results", [true])).toEqual({ patient: {} });
  });

  it("builds a new row with the keys already used by the existing rows", () => {
    expect(newLabResultRow()).toEqual({ name: "", value: "", unit: null, reference_range: null });
    expect(newLabResultRow([{ nombre: "TSH", valor: "2.4", unidad: "mUI/L", referenceRange: null, flag: "x" }])).toEqual({
      nombre: "", valor: "", unidad: null, referenceRange: null,
    });
    expect(Object.keys(addLabResultRow({ labResults: [{ nombre: "TSH", valor: "2" }] }, undefined, "labResults").labResults![1] as object))
      .toEqual(["nombre", "valor", "unit", "reference_range"]);
  });

  it("blocks approval while a new incomplete row exists and leaves existing records alone", () => {
    const ready = {
      documentType: "STUDY_REPORT" as const, priority: "ROUTINE" as const, destination: "MEDICAL_RECORD" as const,
      confirmed: true, saving: false, success: false, conflict: false,
    };
    expect(approvalBlockers({ ...ready, hasIncompleteLabRows: true })).toEqual([
      "Complete Prueba y Resultado, o elimine las filas nuevas incompletas de resultados de laboratorio.",
    ]);
    expect(approvalBlockers({ ...ready, hasIncompleteLabRows: false })).toEqual([]);
    expect(approvalBlockers(ready)).toEqual([]);
  });

  it("reads values by path and coerces visual input without changing the original type", () => {
    const data = { a: { b: [{ c: 1 }, "x"] }, flag: true };
    expect(valueAtPath(data, ["a", "b", 0, "c"])).toBe(1);
    expect(valueAtPath(data, ["a", "b", 1])).toBe("x");
    expect(valueAtPath(data, ["a", "zzz", "q"])).toBeUndefined();
    expect(valueAtPath(null, ["a"])).toBeUndefined();

    expect(coerceFieldInput("8.20", 8.2)).toBe(8.2);
    expect(coerceFieldInput("", 8.2)).toBeNull();
    expect(coerceFieldInput("abc", 8.2)).toBe("abc");
    expect(coerceFieldInput("true", false)).toBe(true);
    expect(coerceFieldInput("false", true)).toBe(false);
    expect(coerceFieldInput("", true)).toBeNull();
    expect(coerceFieldInput("texto", "x")).toBe("texto");
    expect(coerceFieldInput("", "x")).toBeNull();
    expect(coerceFieldInput("", "")).toBe("");
    expect(coerceFieldInput("", null)).toBeNull();
    expect(coerceFieldInput("5", null)).toBe("5");
  });

  it("edits nested scalars, object entries and list items by path and restores them without a patch", () => {
    const original = {
      measurements: { systolic: 128, unit: "mmHg", active: true },
      allergies: ["penicilina", "aspirina"],
      procedures: [{ procedure_name: "Biopsia", notes: null }, { procedure_name: "Ecografía" }],
    };
    let draft = writeReviewField(original, original, ["measurements", "systolic"], coerceFieldInput("130", 128));
    draft = writeReviewField(original, draft, ["allergies", "1"], coerceFieldInput("ibuprofeno", "aspirina"));
    draft = writeReviewField(original, draft, ["procedures", "0", "notes"], coerceFieldInput("sin novedades", null));
    draft = writeReviewField(original, draft, ["procedures", "1", "site"], coerceFieldInput("Abdomen", undefined));

    expect(changedFields(original, draft)).toEqual({
      measurements: { systolic: 130 },
      allergies: ["penicilina", "ibuprofeno"],
      procedures: [{ procedure_name: "Biopsia", notes: "sin novedades" }, { procedure_name: "Ecografía", site: "Abdomen" }],
    });
    expect(original.measurements).toEqual({ systolic: 128, unit: "mmHg", active: true });

    let restored = writeReviewField(original, draft, ["measurements", "systolic"], coerceFieldInput("128", 128));
    restored = writeReviewField(original, restored, ["allergies", "1"], coerceFieldInput("aspirina", "aspirina"));
    restored = writeReviewField(original, restored, ["procedures", "0", "notes"], coerceFieldInput("", null));
    restored = writeReviewField(original, restored, ["procedures", "1", "site"], coerceFieldInput("", undefined));
    expect(restored).toEqual(original);
    expect(changedFields(original, restored)).toEqual({});
  });

  it("restores the original cell value, keeping its type, without a patch", () => {
    const original = { lab_results: [{ name: "Glucosa", value: 174, unit: "mg/dL" }] };
    const edited = writeReviewField(original, original, labResultPath(0, "value"), "180");
    const restored = writeReviewField(original, edited, labResultPath(0, "value"), 174);

    expect(typeof (edited.lab_results as Record<string, unknown>[])[0].value).toBe("string");
    expect(restored).toEqual(original);
    expect(typeof (restored.lab_results as Record<string, unknown>[])[0].value).toBe("number");
    expect(changedFields(original, restored)).toEqual({});
  });
});

describe("regression: types and original state of lab_results", () => {
  const validation: Validation = { inconsistencies: [], missing_fields: [], warnings: [] };
  const sourceFor = (extracted: Record<string, unknown>): ProcessingResponse => ({
    document_id: "DOC-LAB-2",
    status: "NEEDS_AUDIT",
    classification: { document_type: "STUDY_REPORT", specialty: "Laboratorio Clínico", priority_level: "ROUTINE" },
    confidence: null,
    extracted_data: extracted,
    validation,
    routing_decision: { primary_destination: "MEDICAL_RECORD", requires_human_review: true, audit_reasons: [], justification: "Revisar" },
    notification: { generated: false },
    storage: { provider: "OCI_OBJECT_STORAGE", state: "SUCCESS" },
  });
  const patch = (source: ProcessingResponse, extracted: Record<string, unknown>, decision: "APPROVE" | "REJECT" = "APPROVE") =>
    createReviewPatch({
      decision, result: source, documentType: "STUDY_REPORT", priority: "ROUTINE", specialty: "Laboratorio Clínico",
      destination: "MEDICAL_RECORD", extracted, validation: structuredClone(validation), confirmed: true,
    });
  const accepted = (raw: string, original: unknown, column = "value") => {
    const input = coerceLabCellInput(raw, original, column);
    if (!input.ok) throw new Error(input.error);
    return input.value;
  };

  describe("finding 1: edits keep the original type of the cell", () => {
    const original = {
      lab_results: [
        { name: "Glucosa", value: 174, unit: "mg/dL", fasting: true, reference_range: "70–99" },
        { name: "HbA1c", value: "8.2", unit: "%", fasting: null },
      ],
    };

    it("keeps a numeric cell numeric and leaves the other cells and types untouched", () => {
      const source = sourceFor(original);
      const edited = writeReviewField(original, original, labResultPath(0, "value"), accepted("180", 174));
      const rows = edited.lab_results as Record<string, unknown>[];

      expect(rows[0].value).toBe(180);
      expect(typeof rows[0].value).toBe("number");
      expect(rows[0]).toEqual({ ...original.lab_results[0], value: 180 });
      expect(rows[1]).toEqual(original.lab_results[1]);
      expect(rows[1].value).toBe("8.2");
      expect(patch(source, edited).extracted_data).toEqual({ lab_results: rows });
      expect((patch(source, edited).extracted_data!.lab_results as Record<string, unknown>[])[0].value).toBe(180);
    });

    it("restores the original number without a patch and does not normalize equivalent decimals", () => {
      const source = sourceFor({ lab_results: [{ name: "Glucosa", value: 8.2 }] });
      const edited = writeReviewField(source.extracted_data, source.extracted_data!, labResultPath(0, "value"), accepted("9", 8.2));
      const restored = writeReviewField(source.extracted_data, edited, labResultPath(0, "value"), accepted("8.20", 8.2));

      expect(restored).toEqual(source.extracted_data);
      expect(patch(source, restored)).toEqual({ decision: "APPROVE" });
    });

    it.each(["abc", "12a", "1,5", "--3", "1e3", "0x10", "."])("rejects the invalid number %j instead of storing text", (raw) => {
      expect(coerceLabCellInput(raw, 174, "value")).toEqual({ ok: false, error: "Ingrese un número válido." });
    });

    it("never turns an empty numeric entry into 0 or an empty string", () => {
      expect(coerceLabCellInput("", 174, "value")).toEqual({ ok: false, error: "Este valor numérico no puede quedar vacío." });
      expect(coerceLabCellInput("  ", 174, "name")).toEqual({ ok: false, error: "Este valor numérico no puede quedar vacío." });
      expect(coerceLabCellInput("", 5, "unit")).toEqual({ ok: true, value: null });
      expect(coerceLabCellInput("", 5, "reference_range")).toEqual({ ok: true, value: null });
    });

    it("keeps booleans boolean and only allows null where the column admits it", () => {
      expect(coerceLabCellInput("true", false, "fasting")).toEqual({ ok: true, value: true });
      expect(coerceLabCellInput("false", true, "fasting")).toEqual({ ok: true, value: false });
      expect(coerceLabCellInput("", true, "fasting")).toEqual({ ok: true, value: null });
      expect(coerceLabCellInput("", true, "value")).toEqual({ ok: false, error: "Seleccione Sí o No." });
      expect(coerceLabCellInput("quizás", true, "value")).toEqual({ ok: false, error: "Seleccione Sí o No." });
      const edited = writeReviewField(original, original, labResultPath(0, "fasting"), accepted("false", true, "fasting"));
      expect((edited.lab_results as Record<string, unknown>[])[0].fasting).toBe(false);
    });

    it("keeps strings as strings without normalizing clinical text, and does not infer types for null", () => {
      expect(coerceLabCellInput("9.10", "8.2", "value")).toEqual({ ok: true, value: "9.10" });
      expect(coerceLabCellInput("0.860", "0.86", "value")).toEqual({ ok: true, value: "0.860" });
      expect(coerceLabCellInput("8.2", "8.2", "value")).toEqual({ ok: true, value: "8.2" });
      expect(coerceLabCellInput("5", null, "fasting")).toEqual({ ok: true, value: "5" });
      expect(coerceLabCellInput("true", undefined, "extra")).toEqual({ ok: true, value: "true" });
      expect(coerceLabCellInput("", null, "fasting")).toEqual({ ok: true, value: null });
    });
  });

  describe("finding 2: removing rows restores the original state of lab_results", () => {
    const rows = () => [{ name: "TSH", value: "2.4" }];
    const roundTrip = (original: Record<string, unknown>) => {
      const added = addLabResultRow(original);
      const removed = removeLabResultRow(added, (added.lab_results as unknown[]).length - 1, "lab_results", original);
      return { added, removed, source: sourceFor(original) };
    };

    it("absent → add → remove = absent, with no patch and no pending changes", () => {
      const original = { patient: { name: "Ana" }, other: 1 };
      const { added, removed, source } = roundTrip(original);

      expect(Object.hasOwn(added, "lab_results")).toBe(true);
      expect(removed).toStrictEqual(original);
      expect(Object.hasOwn(removed, "lab_results")).toBe(false);
      expect(JSON.stringify(removed)).toBe(JSON.stringify(original));
      expect(patch(source, removed)).toEqual({ decision: "APPROVE" });
      expect(pendingReviewState({
        contentChanged: JSON.stringify(removed) !== JSON.stringify(original), validationChanged: false, confirmed: false,
        drafts: { missing_fields: "", inconsistencies: "", warnings: "" },
      })).toBeNull();
    });

    it("null → add → remove = null, with no patch", () => {
      const original = { patient: { name: "Ana" }, lab_results: null, other: 1 };
      const { removed, source } = roundTrip(original);

      expect(removed).toStrictEqual(original);
      expect(removed.lab_results).toBeNull();
      expect(JSON.stringify(removed)).toBe(JSON.stringify(original));
      expect(patch(source, removed)).toEqual({ decision: "APPROVE" });
    });

    it("[] → add → remove = [], with no patch", () => {
      const original = { patient: { name: "Ana" }, lab_results: [] };
      const { removed, source } = roundTrip(original);

      expect(removed).toStrictEqual(original);
      expect(patch(source, removed)).toEqual({ decision: "APPROVE" });
    });

    it("three rows → deliberately removing all of them = [] and a real change", () => {
      const original = { lab_results: [{ name: "A", value: "1" }, { name: "B", value: "2" }, { name: "C", value: "3" }] };
      const source = sourceFor(original);
      let draft: Record<string, unknown> = original;
      for (let i = 0; i < 3; i++) draft = removeLabResultRow(draft, 0, "lab_results", original);

      expect(draft.lab_results).toEqual([]);
      expect(patch(source, draft).extracted_data).toEqual({ lab_results: [] });
      expect(patch(source, draft).validation).toEqual(validation);
    });

    it("removes an added row from an existing list without touching the original rows", () => {
      const original = { lab_results: rows() };
      const { removed, source } = roundTrip(original);

      expect(removed).toStrictEqual(original);
      expect(patch(source, removed)).toEqual({ decision: "APPROVE" });
    });

    it("rejecting with an incomplete new row does not send lab_results when it did not exist", () => {
      for (const original of [{ patient: { name: "Ana" } }, { patient: { name: "Ana" }, lab_results: null }, { patient: { name: "Ana" }, lab_results: [] }]) {
        const source = sourceFor(original);
        const added = addLabResultRow(original);
        const sent = dropIncompleteNewLabRows(added, "lab_results", [true], original);

        expect(sent).toStrictEqual(original);
        expect(patch(source, sent, "REJECT")).toEqual({ decision: "REJECT" });
      }
    });

    it("keeps a completed new row when rejecting, and drops only the incomplete ones", () => {
      const original = { patient: { name: "Ana" } };
      const source = sourceFor(original);
      let draft = addLabResultRow(original);
      draft = writeReviewField(original, draft, labResultPath(0, "name"), "TSH");
      draft = writeReviewField(original, draft, labResultPath(0, "value"), "2.4");
      draft = addLabResultRow(draft);
      const sent = dropIncompleteNewLabRows(draft, "lab_results", [true, true], original);

      expect(sent.lab_results).toEqual([{ name: "TSH", value: "2.4", unit: null, reference_range: null }]);
      expect(patch(source, sent, "REJECT").extracted_data).toEqual({ lab_results: sent.lab_results });
    });

    it("keeps the previous behavior when no original state is given", () => {
      const added = addLabResultRow({ patient: { name: "Ana" } });
      expect(removeLabResultRow(added, 0).lab_results).toEqual([]);
    });
  });
});

describe("regression: invalid lab drafts never travel silently", () => {
  const validation: Validation = { inconsistencies: [], missing_fields: [], warnings: [] };
  const original = { lab_results: [{ name: "Glucosa", value: 174, unit: "mg/dL" }, { name: "HbA1c", value: "8.2" }] };
  const source: ProcessingResponse = {
    document_id: "DOC-LAB-3",
    status: "NEEDS_AUDIT",
    classification: { document_type: "STUDY_REPORT", specialty: "Laboratorio Clínico", priority_level: "ROUTINE" },
    confidence: null,
    extracted_data: original,
    validation,
    routing_decision: { primary_destination: "MEDICAL_RECORD", requires_human_review: true, audit_reasons: [], justification: "Revisar" },
    notification: { generated: false },
    storage: { provider: "OCI_OBJECT_STORAGE", state: "SUCCESS" },
  };
  const request = (decision: "APPROVE" | "REJECT", extracted: Record<string, unknown>, confirmed: boolean) =>
    createReviewPatch({
      decision, result: source, documentType: "STUDY_REPORT", priority: "ROUTINE", specialty: "Laboratorio Clínico",
      destination: "MEDICAL_RECORD", extracted, validation: structuredClone(validation), confirmed,
    });

  const simulate = (typed: string[]) => {
    let extracted: Record<string, unknown> = original;
    let invalid = 0;
    for (const raw of typed) {
      const input = coerceLabCellInput(raw, 174, "value");
      if (input.ok) {
        invalid = 0;
        extracted = writeReviewField(original, extracted, labResultPath(0, "value"), input.value);
      } else {
        invalid = 1;
      }
    }
    return { extracted, invalid };
  };

  it("174 → 180 → 18a → confirm → reject: the last valid value is held but never sent", () => {
    const { extracted, invalid } = simulate(["180", "18a"]);

    expect((extracted.lab_results as Record<string, unknown>[])[0].value).toBe(180);
    expect(invalid).toBe(1);
    expect(request("REJECT", extracted, invalid === 0)).toEqual({ decision: "REJECT" });
    expect(JSON.stringify(request("REJECT", extracted, invalid === 0))).not.toContain("180");
    expect(approvalBlockers({
      documentType: "STUDY_REPORT", priority: "ROUTINE", destination: "MEDICAL_RECORD", confirmed: true,
      saving: false, success: false, conflict: false, hasInvalidLabCells: invalid > 0,
    })).toEqual(["Corrija los valores inválidos de resultados de laboratorio."]);
  });

  it("the confirmation cannot bypass the protection: rejecting sends only the decision and approving is blocked", () => {
    const { extracted, invalid } = simulate(["180", "18a"]);

    expect(request("REJECT", extracted, invalid === 0)).toEqual({ decision: "REJECT" });
    expect(approvalBlockers({
      documentType: "STUDY_REPORT", priority: "ROUTINE", destination: "MEDICAL_RECORD", confirmed: true,
      saving: false, success: false, conflict: false, hasInvalidLabCells: invalid > 0,
    })).not.toEqual([]);
  });

  it("after correcting 18a with a valid value, the normal behavior returns", () => {
    const { extracted, invalid } = simulate(["180", "18a", "181"]);

    expect(invalid).toBe(0);
    expect(request("REJECT", extracted, invalid === 0).extracted_data).toEqual({
      lab_results: [{ name: "Glucosa", value: 181, unit: "mg/dL" }, { name: "HbA1c", value: "8.2" }],
    });
    expect(request("APPROVE", extracted, true).extracted_data).toEqual(request("REJECT", extracted, true).extracted_data);
  });

  it("restoring the original after an invalid draft leaves no changes", () => {
    const { extracted, invalid } = simulate(["180", "18a", "174"]);

    expect(invalid).toBe(0);
    expect(extracted).toEqual(original);
    expect(request("REJECT", extracted, true)).toEqual({ decision: "REJECT" });
  });

  it("describes what the rejection will send", () => {
    const copy = (confirmed: boolean, incompleteLabRows = 0, invalidLabCells = 0) => rejectionCopy({ confirmed, incompleteLabRows, invalidLabCells });

    expect(copy(true)).toBe("Esta acción registrará el documento como rechazado y enviará las correcciones revisadas. ¿Desea continuar?");
    expect(copy(false)).toBe("Esta acción registrará el documento como rechazado. Las correcciones sin confirmar no se enviarán. ¿Desea continuar?");
    expect(copy(true, 1)).toContain("Las filas nuevas incompletas de resultados de laboratorio no se enviarán.");
    for (const confirmed of [true, false]) {
      const invalid = copy(confirmed, 0, 2);
      expect(invalid).toContain("valores inválidos");
      expect(invalid).toContain("no se enviará ninguna corrección, solo la decisión");
      expect(invalid).not.toContain("enviará las correcciones revisadas");
    }
  });
});
