import type {
  DocumentClassification, DocumentType, ExtractedData, Medication, PriorityLevel,
  ProcessingResponse, RequestedStudy, RoutingDestination, Validation,
} from "../types/processing";
import type { ReviewDecision, ReviewRequest } from "../services/reviewService";
import { auditReasonLabel } from "../config/auditLabels";
import { missingFieldLabel } from "../config/missingFieldLabels";

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

export function warningMissingFieldLabels(missingFields: Validation["missing_fields"] | null | undefined): string[] {
  return [...new Set((missingFields ?? [])
    .filter((field) => field.trim().length > 0 && field !== "__proto__")
    .map(missingFieldLabel)
    .filter((label) => label !== "Dato no identificado"))];
}

export function reviewWarningMessages(auditReasons: string[], missingFields: Validation["missing_fields"] | null | undefined): string[] {
  const labels = warningMissingFieldLabels(missingFields);
  const missingMessage = labels.length > 0
    ? `Datos no identificados: ${labels.join(", ")}.`
    : "Datos no identificados. Revise la validación y el documento original.";
  const messages = auditReasons.map((reason) => {
    if (reason === "MISSING_CRITICAL_FIELDS") return labels.length > 0
      ? `Información crítica incompleta: ${labels.join(", ")}.`
      : "Información crítica incompleta. Revise la validación y el documento original.";
    if (reason === "LOW_CONFIDENCE") return "La IA asignó baja confianza al análisis. Verifique los datos con el documento original.";
    return auditReasonLabel(reason);
  });
  if (labels.length > 0 && !auditReasons.includes("MISSING_CRITICAL_FIELDS")) messages.push(missingMessage);
  return messages;
}

export function humanizeMissingField(value: string): string {
  return missingFieldLabel(value);
}

export function hasSpecialtyChanged(original: string | null | undefined, draft: string): boolean {
  return draft !== (original ?? "");
}

export function approvalBlockers(input: {
  documentType: DocumentType | "";
  priority: PriorityLevel | "";
  destination: RoutingDestination;
  hasExtraError: boolean;
  needsValidation: boolean;
  confirmed: boolean;
  saving: boolean;
  success: boolean;
  conflict: boolean;
}): string[] {
  if (input.conflict) return ["El documento ya no está pendiente de revisión."];
  if (input.success) return ["La revisión ya fue registrada."];
  if (input.saving) return ["Se está registrando la revisión."];

  const reasons: string[] = [];
  if (!input.documentType) reasons.push("Seleccione el tipo de documento.");
  if (!input.priority) reasons.push("Seleccione la prioridad.");
  if (input.destination === "HUMAN_REVIEW") reasons.push("Seleccione un destino final.");
  if (input.hasExtraError) reasons.push("Corrija los errores de formato en Otros datos.");
  if (input.needsValidation && !input.confirmed) reasons.push("Confirme la validación revisada.");
  return reasons;
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
  if (hasSpecialtyChanged(result.classification?.specialty, specialty)) classification.specialty = normalizedSpecialty;
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
