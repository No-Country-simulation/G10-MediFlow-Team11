import type {
  DocumentClassification, DocumentType, ExtractedData, Medication, PriorityLevel,
  ProcessingResponse, RequestedStudy, RoutingDestination, Validation,
} from "../types/processing";
import type { ReviewDecision, ReviewRequest } from "../services/reviewService";

export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    const previous = before[key];
    if (JSON.stringify(previous) === JSON.stringify(value)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)
      && previous && typeof previous === "object" && !Array.isArray(previous)) {
      patch[key] = changedFields(previous as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      patch[key] = value;
    }
  }
  return patch;
}

function normalizeEditedText(value: string | null | undefined, originalValues: (string | null | undefined)[]): string | null {
  if (originalValues.includes(value)) return value ?? null;
  return value?.trim() || null;
}

export function normalizeReviewExtraction(original: ExtractedData | null, draft: ExtractedData): ExtractedData {
  const normalized: ExtractedData = structuredClone(draft);
  if (draft.medications) {
    const source = original?.medications ?? [];
    normalized.medications = draft.medications.map((item): Medication => ({
      ...item,
      name: normalizeEditedText(item.name, source.map((entry) => entry.name)),
      dosage: normalizeEditedText(item.dosage, source.map((entry) => entry.dosage)),
    }));
  }
  if (draft.requested_studies) {
    const source = original?.requested_studies ?? [];
    normalized.requested_studies = draft.requested_studies.map((item): RequestedStudy => ({
      ...item,
      name: normalizeEditedText(item.name, source.map((entry) => entry.name)),
    }));
  }
  return normalized;
}

function removedNestedKey(before: unknown, after: unknown, path: string): string | null {
  if (after === null) return null; 
  if (!before || typeof before !== "object" || Array.isArray(before)) return null;
  if (!after || typeof after !== "object" || Array.isArray(after)) return path;
  const oldObject = before as Record<string, unknown>;
  const newObject = after as Record<string, unknown>;
  for (const key of Object.keys(oldObject)) {
    const childPath = path ? `${path}.${key}` : key;
    if (!Object.hasOwn(newObject, key)) return childPath;
    const nested = removedNestedKey(oldObject[key], newObject[key], childPath);
    if (nested) return nested;
  }
  return null;
}

export function parseAdditionalJson(original: unknown, text: string, key: string): { value?: unknown; error?: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: "Ingrese un valor JSON válido." };
  }
  const removed = removedNestedKey(original, value, key);
  if (removed) return { error: `No se puede eliminar la clave ${removed}: el Backend conserva las claves omitidas. Use null solo si el campo admite un valor nulo.` };
  return { value };
}

export function humanizeMissingField(value: string): string {
  const labels: Record<string, string> = {
    "patient.name": "Nombre del paciente", "patient.age": "Edad del paciente",
    "requesting_doctor.name": "Médico responsable", "requesting_doctor.license_number": "N.º de colegiado / matrícula profesional",
    primary_diagnosis: "Diagnóstico principal", suggested_icd10: "CIE-10 sugerido (opcional)",
    medications: "Medicamentos", requested_studies: "Estudios solicitados",
  };
  if (labels[value]) return labels[value];
  if (/\s/.test(value)) return value;
  const readable = value.replace(/[._]/g, " ");
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export function reviewSourceLabel(documentId: string, textContent: boolean, routeState: unknown): string {
  if (textContent) return "Texto ingresado";
  if (typeof routeState !== "object" || routeState === null) return "Archivo original";
  const metadata = routeState as Record<string, unknown>;
  if (metadata.documentId !== documentId) return "Archivo original";
  if (metadata.inputType === "TEXT") return "Texto ingresado";
  if (metadata.inputType === "FILE" && typeof metadata.fileName === "string" && metadata.fileName.trim()) {
    return metadata.fileName;
  }
  return "Archivo original";
}

export function hasUnsavedReviewChanges(input: {
  contentChanged: boolean;
  validationChanged: boolean;
  confirmed: boolean;
  drafts: Record<keyof Validation, string>;
  extraJson: Record<string, string>;
  initialExtraJson: Record<string, string>;
}): boolean {
  return input.contentChanged || input.validationChanged || input.confirmed
    || Object.values(input.drafts).some((value) => value.length > 0)
    || Object.keys(input.extraJson).some((key) => input.extraJson[key] !== input.initialExtraJson[key]);
}

export function shouldBlockReviewNavigation(input: {
  dirty: boolean; saving: boolean; success: boolean;
  currentPath: string; nextPath: string;
  allowResultPath?: string;
}): boolean {
  return (input.dirty || input.saving) && !input.success
    && input.nextPath !== input.allowResultPath && input.currentPath !== input.nextPath;
}

export function activeReviewSection(sectionIds: string[], atBottom: boolean, visibleIds: string[]): string | undefined {
  if (atBottom) return sectionIds.at(-1);
  return visibleIds.at(-1) ?? sectionIds[0];
}

export function createReviewPatch(input: {
  decision: ReviewDecision;
  result: ProcessingResponse;
  documentType: DocumentType | "";
  priority: PriorityLevel | "";
  specialty: string;
  destination: RoutingDestination;
  extracted: ExtractedData;
  validation: Validation;
  confirmed: boolean;
  hasExtraError: boolean;
}): ReviewRequest {
  const { decision, result, documentType, priority, specialty, destination, validation } = input;
  const request: ReviewRequest = { decision };
  if (decision === "REJECT" && (!input.confirmed || input.hasExtraError)) return request;
  const classification: Partial<DocumentClassification> = {};
  if (documentType && documentType !== result.classification?.document_type) classification.document_type = documentType;
  if (priority && priority !== result.classification?.priority_level) classification.priority_level = priority;
  const normalizedSpecialty = specialty.trim() || null;
  if (normalizedSpecialty !== (result.classification?.specialty ?? null)) classification.specialty = normalizedSpecialty;
  const classificationChanged = Object.keys(classification).length > 0;
  const extracted = normalizeReviewExtraction(result.extracted_data, input.extracted);
  const extractionPatch = changedFields(result.extracted_data ?? {}, extracted);
  const extractedChanged = Object.keys(extractionPatch).length > 0;
  const destinationChanged = destination !== result.routing_decision.primary_destination;
  const validationChanged = JSON.stringify(validation) !== JSON.stringify(result.validation ?? { missing_fields: [], inconsistencies: [], warnings: [] });
  if (classificationChanged) request.classification = classification;
  if (extractedChanged || (decision === "APPROVE" && result.extracted_data === null)) {
    request.extracted_data = extractionPatch as ExtractedData;
  }
  if (destinationChanged) request.routing_decision = { primary_destination: destination };
  if (result.validation === null || classificationChanged || extractedChanged || destinationChanged || validationChanged) {
    request.validation = validation;
  }
  return request;
}
