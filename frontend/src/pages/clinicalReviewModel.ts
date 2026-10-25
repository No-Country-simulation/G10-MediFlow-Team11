import type {
  DocumentClassification, DocumentType, ExtractedData, Medication, PriorityLevel,
  ProcessingResponse, RequestedStudy, RoutingDestination, Validation,
} from "../types/processing";
import type { ReviewDecision, ReviewRequest } from "../services/reviewService";
import { auditReasonLabel } from "../config/auditLabels";
import { missingFieldLabel } from "../config/missingFieldLabels";
import { resolveFieldLabel } from "../config/extractedFieldLabels";

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

function normalizeEditedText(value: string | null | undefined, original: string | null | undefined): string | null | undefined {
  if (value === original) return value;
  return value?.trim() || null;
}

export function restoredTextValue(raw: string, original: string | null | undefined): string | null | undefined {
  return raw === "" ? (original === "" || original == null ? original : null) : raw;
}

export function writeReviewField(original: ExtractedData | null, draft: ExtractedData, path: string[], value: unknown): ExtractedData {
  const next: ExtractedData = structuredClone(draft);
  let parent: Record<string, unknown> = next;
  for (const key of path.slice(0, -1)) {
    if (!parent[key] || typeof parent[key] !== "object") parent[key] = {};
    parent = parent[key] as Record<string, unknown>;
  }
  const originalParent = path.slice(0, -1).reduce<unknown>((current, key) =>
    current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, original);
  if (value === undefined || (value === null && path.length > 1 && originalParent === null)) {
    delete parent[path.at(-1)!];
    for (let length = path.length - 1; length > 0; length--) {
      const prefix = path.slice(0, length);
      const child = prefix.reduce<unknown>((current, key) =>
        current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, next);
      const source = prefix.reduce<unknown>((current, key) =>
        current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, original);
      if (!child || typeof child !== "object" || Object.keys(child).length > 0) break;
      const owner = prefix.slice(0, -1).reduce<Record<string, unknown>>((current, key) =>
        current[key] as Record<string, unknown>, next);
      if (source === null) { owner[prefix.at(-1)!] = null; break; }
      if (source !== undefined) break;
      delete owner[prefix.at(-1)!];
    }
  } else parent[path.at(-1)!] = value;
  return next;
}

const LAB_RESULTS_KEY = "lab_results";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function newLabResultRow(existing?: unknown): Record<string, unknown> {
  const keys = Array.isArray(existing) ? existing.flatMap((row) => (isPlainRecord(row) ? Object.keys(row) : [])) : [];
  const keyFor = (canonical: string) =>
    keys.find((key) => resolveFieldLabel(key).canonicalKey === canonical) ?? canonical;
  return {
    [keyFor("name")]: "",
    [keyFor("value")]: "",
    [keyFor("unit")]: null,
    [keyFor("reference_range")]: null,
  };
}

export function labResultPath(index: number, property: string, key = LAB_RESULTS_KEY): string[] {
  return [key, String(index), property];
}

export function addLabResultRow(
  draft: ExtractedData,
  row?: Record<string, unknown>,
  key = LAB_RESULTS_KEY,
): ExtractedData {
  const current = draft[key];
  if (current !== undefined && current !== null && !Array.isArray(current)) return structuredClone(draft);
  return { ...structuredClone(draft), [key]: [...structuredClone(current ?? []), { ...(row ?? newLabResultRow(current)) }] };
}

function restoreOriginalEmptyLabResults(
  next: ExtractedData,
  key: string,
  original: ExtractedData | null | undefined,
): ExtractedData {
  const rows = next[key];
  if (original === undefined || !Array.isArray(rows) || rows.length > 0) return next;
  const originalValue = original?.[key];
  if (originalValue === undefined) delete next[key];
  else if (originalValue === null) next[key] = null;
  return next;
}

export function removeLabResultRow(
  draft: ExtractedData,
  index: number,
  key = LAB_RESULTS_KEY,
  original?: ExtractedData | null,
): ExtractedData {
  const next = structuredClone(draft);
  const current = next[key];
  if (Array.isArray(current)) next[key] = current.filter((_, i) => i !== index);
  return restoreOriginalEmptyLabResults(next, key, original);
}

export function findLabResultsKey(data: ExtractedData | null | undefined, includeEmpty = false): string | null {
  if (!data) return null;
  return Object.keys(data).find((key) => {
    const value = data[key];
    if (resolveFieldLabel(key).canonicalKey !== LAB_RESULTS_KEY) return false;
    if (includeEmpty && value === null) return true;
    return Array.isArray(value) && (includeEmpty || value.length > 0) && value.every(isPlainRecord);
  }) ?? null;
}

function isBlankValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function labCell(row: Record<string, unknown>, canonical: string): unknown {
  const key = Object.keys(row).find((candidate) => resolveFieldLabel(candidate).canonicalKey === canonical);
  return key === undefined ? undefined : row[key];
}

export function isIncompleteLabRow(row: unknown): boolean {
  return isPlainRecord(row) && (isBlankValue(labCell(row, "name")) || isBlankValue(labCell(row, "value")));
}

export function incompleteNewLabRows(rows: unknown, isNew: readonly boolean[]): number[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row, index) => (isNew[index] === true && isIncompleteLabRow(row) ? [index] : []));
}

export function dropIncompleteNewLabRows(
  draft: ExtractedData,
  key: string,
  isNew: readonly boolean[],
  original?: ExtractedData | null,
): ExtractedData {
  const next = structuredClone(draft);
  const rows = next[key];
  if (Array.isArray(rows)) {
    const dropped = new Set(incompleteNewLabRows(rows, isNew));
    next[key] = rows.filter((_, index) => !dropped.has(index));
  }
  return restoreOriginalEmptyLabResults(next, key, original);
}

export function rejectionCopy(input: { confirmed: boolean; incompleteLabRows: number; invalidLabCells: number }): string {
  if (input.invalidLabCells > 0) {
    return "Esta acción registrará el documento como rechazado. Hay valores inválidos en resultados de laboratorio, marcados en la tabla: no se enviará ninguna corrección, solo la decisión. ¿Desea continuar?";
  }
  return (input.confirmed
    ? "Esta acción registrará el documento como rechazado y enviará las correcciones revisadas."
    : "Esta acción registrará el documento como rechazado. Las correcciones sin confirmar no se enviarán.")
    + (input.confirmed && input.incompleteLabRows > 0 ? " Las filas nuevas incompletas de resultados de laboratorio no se enviarán." : "")
    + " ¿Desea continuar?";
}

export function labCellAdmitsNull(columnKey: string): boolean {
  const canonical = resolveFieldLabel(columnKey).canonicalKey;
  return canonical !== "name" && canonical !== "value";
}

export type LabCellInput = { ok: true; value: unknown } | { ok: false; error: string };

const NUMBER_INPUT = /^-?(\d+\.?\d*|\.\d+)$/;

export function coerceLabCellInput(raw: string, original: unknown, columnKey: string): LabCellInput {
  if (typeof original === "number") {
    const text = raw.trim();
    if (text === "") {
      return labCellAdmitsNull(columnKey)
        ? { ok: true, value: null }
        : { ok: false, error: "Este valor numérico no puede quedar vacío." };
    }
    return NUMBER_INPUT.test(text) && Number.isFinite(Number(text))
      ? { ok: true, value: Number(text) }
      : { ok: false, error: "Ingrese un número válido." };
  }
  if (typeof original === "boolean") {
    if (raw === "true") return { ok: true, value: true };
    if (raw === "false") return { ok: true, value: false };
    return labCellAdmitsNull(columnKey)
      ? { ok: true, value: null }
      : { ok: false, error: "Seleccione Sí o No." };
  }
  return { ok: true, value: restoredTextValue(raw, original as string | null | undefined) };
}

export function valueAtPath(data: unknown, path: readonly (string | number)[]): unknown {
  let current: unknown = data;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key as string];
  }
  return current;
}

export function coerceFieldInput(raw: string, original: unknown): unknown {
  if (typeof original === "number") {
    if (raw.trim() === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  if (typeof original === "boolean") return raw === "true" ? true : raw === "false" ? false : null;
  return restoredTextValue(raw, original as string | null | undefined);
}

export function normalizeReviewExtraction(
  original: ExtractedData | null, draft: ExtractedData,
  medicationOriginals = original?.medications ?? [], studyOriginals = original?.requested_studies ?? [],
): ExtractedData {
  const normalized: ExtractedData = structuredClone(draft);
  if (draft.medications) {
    normalized.medications = draft.medications.map((item, index): Medication => ({
      ...item,
      name: normalizeEditedText(item.name, medicationOriginals[index]?.name),
      dosage: normalizeEditedText(item.dosage, medicationOriginals[index]?.dosage),
    }));
  }
  if (draft.requested_studies) {
    normalized.requested_studies = draft.requested_studies.map((item, index): RequestedStudy => ({
      ...item,
      name: normalizeEditedText(item.name, studyOriginals[index]?.name),
    }));
  }
  return normalized;
}

const VALIDATION_KEYS = ["missing_fields", "inconsistencies", "warnings"] as const;

export function hasValidationChanged(current: Validation, original: Validation | null | undefined): boolean {
  return VALIDATION_KEYS.some((key) => {
    const before = original?.[key] ?? [];
    const after = current[key] ?? [];
    return before.length !== after.length || before.some((item, index) => item !== after[index]);
  });
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
  hasIncompleteLabRows?: boolean;
  hasInvalidLabCells?: boolean;
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
  if (input.hasIncompleteLabRows) {
    reasons.push("Complete Prueba y Resultado, o elimine las filas nuevas incompletas de resultados de laboratorio.");
  }
  if (input.hasInvalidLabCells) reasons.push("Corrija los valores inválidos de resultados de laboratorio.");
  if (!input.confirmed) reasons.push("Confirme la validación revisada.");
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
  hasInvalidLabDrafts?: boolean;
}): boolean {
  return input.contentChanged || input.validationChanged || input.confirmed || !!input.hasInvalidLabDrafts
    || Object.values(input.drafts).some((value) => value.length > 0);
}

export type PendingReviewState = "data" | "confirmation" | null;

export function pendingReviewState(input: Parameters<typeof hasUnsavedReviewChanges>[0]): PendingReviewState {
  if (hasUnsavedReviewChanges({ ...input, confirmed: false })) return "data";
  return input.confirmed ? "confirmation" : null;
}

export function pendingReviewCopy(state: Exclude<PendingReviewState, null>): {
  indicator: string;
  dialogTitle: string;
  dialogMessage: string;
} {
  return state === "data"
    ? {
      indicator: "● Cambios sin registrar",
      dialogTitle: "Cambios sin guardar",
      dialogMessage: "Se realizaron modificaciones que no han sido registradas. ¿Desea salir de todas formas?",
    }
    : {
      indicator: "✓ Validación confirmada · decisión sin registrar",
      dialogTitle: "Decisión sin registrar",
      dialogMessage: "Confirmó la validación, pero aún no registró una decisión. No se modificaron datos. ¿Desea salir de todas formas?",
    };
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
  medicationOriginals?: Medication[];
  studyOriginals?: RequestedStudy[];
  validation: Validation;
  confirmed: boolean;
}): ReviewRequest {
  const { decision, result, documentType, priority, specialty, destination, validation } = input;
  const request: ReviewRequest = { decision };
  if (decision === "REJECT" && !input.confirmed) return request;
  const classification: Partial<DocumentClassification> = {};
  if (documentType && documentType !== result.classification?.document_type) classification.document_type = documentType;
  if (priority && priority !== result.classification?.priority_level) classification.priority_level = priority;
  const normalizedSpecialty = specialty.trim() || null;
  if (hasSpecialtyChanged(result.classification?.specialty, specialty)) classification.specialty = normalizedSpecialty;
  const classificationChanged = Object.keys(classification).length > 0;
  const extracted = normalizeReviewExtraction(result.extracted_data, input.extracted, input.medicationOriginals, input.studyOriginals);
  const extractionPatch = changedFields(result.extracted_data ?? {}, extracted);
  const extractedChanged = Object.keys(extractionPatch).length > 0;
  const destinationChanged = destination !== result.routing_decision.primary_destination;
  const validationChanged = hasValidationChanged(validation, result.validation);
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
