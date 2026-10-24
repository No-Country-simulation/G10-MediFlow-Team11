import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import DocumentIdentity from "../components/DocumentIdentity";
import { Link, useBlocker, useLocation, useNavigate, useParams } from "react-router-dom";
import DocumentViewer from "../components/DocumentViewer/DocumentViewer";
import type { DocumentViewerState } from "../components/DocumentViewer/types";
import { documentTypeLabel } from "../config/auditLabels";
import { getDocumentContent } from "../services/documentService";
import { ApiError } from "../services/processingService";
import { submitReview, type ReviewDecision } from "../services/reviewService";
import { getDocumentResult } from "../services/resultService";
import type {
  DocumentType,
  ExtractedData,
  Medication,
  PriorityLevel,
  ProcessingResponse,
  RequestedStudy,
  RoutingDestination,
  Validation,
} from "../types/processing";
import {
  activeReviewSection, approvalBlockers, createReviewPatch, hasSpecialtyChanged, hasUnsavedReviewChanges,
  humanizeMissingField, parseAdditionalJson, restoredTextValue, reviewSourceLabel, reviewWarningMessages,
  shouldBlockReviewNavigation, writeReviewField,
} from "./clinicalReviewModel";
import "../styles/clinical-review.css";

type ValidationKey = keyof Validation;
type DialogKind = "reject" | null;

const documentTypes: DocumentType[] = [
  "PRESCRIPTION", "IMAGING_REPORT", "STUDY_REPORT", "PROCEDURE_ORDER",
  "DISCHARGE_SUMMARY", "MEDICAL_CERTIFICATE",
];
const destinations: { value: RoutingDestination; label: string }[] = [
  { value: "MEDICAL_EMERGENCY", label: "Emergencias Médicas" },
  { value: "PHARMACY", label: "Farmacia" },
  { value: "AUTHORIZATION_AUDIT", label: "Auditoría de Autorizaciones" },
  { value: "MEDICAL_RECORD", label: "Expediente Clínico" },
  { value: "HUMAN_REVIEW", label: "Revisión Humana" },
];
const validationGroups: { key: ValidationKey; label: string; empty: string }[] = [
  { key: "missing_fields", label: "Datos no identificados", empty: "Sin datos no identificados" },
  { key: "inconsistencies", label: "Inconsistencias", empty: "Sin inconsistencias" },
  { key: "warnings", label: "Advertencias", empty: "Sin advertencias" },
];
const standardFields: { path: string[]; label: string; number?: boolean; hint?: string }[] = [
  { path: ["patient", "name"], label: "Paciente" },
  { path: ["patient", "age"], label: "Edad", number: true },
  { path: ["requesting_doctor", "name"], label: "Médico responsable" },
  { path: ["requesting_doctor", "license_number"], label: "N.º de colegiado / matrícula profesional" },
  { path: ["primary_diagnosis"], label: "Diagnóstico principal" },
  { path: ["suggested_icd10"], label: "CIE-10 sugerido (opcional)", hint: "Ingrese un código solo si está respaldado por el documento original." },
];
const standardKeys = new Set([
  "patient", "requesting_doctor", "primary_diagnosis", "suggested_icd10",
  "medications", "requested_studies",
]);

function copyData(data: ExtractedData): ExtractedData {
  return structuredClone(data);
}

function readPath(data: ExtractedData, path: string[]): unknown {
  let value: unknown = data;
  for (const key of path) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value === null ? null : undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function emptyValidation(): Validation {
  return { missing_fields: [], inconsistencies: [], warnings: [] };
}

function reviewError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.code === "INVALID_REVIEW_STATE") {
      return "Este documento ya no está pendiente de revisión. Consulte su resultado actualizado.";
    }
    if (error.status === 400 || error.code === "REVIEW_VALIDATION_FAILED") {
      return `No se pudo validar la revisión. Revise clasificación, datos extraídos, validación y destino. ${error.message}`;
    }
  }
  return error instanceof Error ? error.message : "No se pudo registrar la revisión.";
}

function ReviewDialog({
  title, children, onClose, actions,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      returnFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="clinical-review__dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <h2 id={titleId}>{title}</h2>
      <p>{children}</p>
      <div className="clinical-review__dialog-actions">{actions}</div>
    </dialog>
  );
}

function ReviewSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} data-review-section className="clinical-review__section">
      <h3>{title}</h3>
      <div className="clinical-review__section-body">{children}</div>
    </section>
  );
}

function ReviewWorkspace({ result, viewer }: { result: ProcessingResponse; viewer: DocumentViewerState }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [documentType, setDocumentType] = useState<DocumentType | "">(result.classification?.document_type ?? "");
  const [priority, setPriority] = useState<PriorityLevel | "">(result.classification?.priority_level ?? "");
  const [specialty, setSpecialty] = useState(result.classification?.specialty ?? "");
  const [destination, setDestination] = useState<RoutingDestination>(result.routing_decision.primary_destination);
  const [extracted, setExtracted] = useState<ExtractedData>(() => copyData(result.extracted_data ?? {}));
  const medicationOriginals = useRef<Medication[]>(structuredClone(result.extracted_data?.medications ?? []));
  const studyOriginals = useRef<RequestedStudy[]>(structuredClone(result.extracted_data?.requested_studies ?? []));
  const [validation, setValidation] = useState<Validation>(() => ({
    missing_fields: [...(result.validation?.missing_fields ?? [])],
    inconsistencies: [...(result.validation?.inconsistencies ?? [])],
    warnings: [...(result.validation?.warnings ?? [])],
  }));
  const [drafts, setDrafts] = useState<Record<ValidationKey, string>>({
    missing_fields: "", inconsistencies: "", warnings: "",
  });
  const [extraJson, setExtraJson] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(result.extracted_data ?? {})
      .filter(([key]) => !standardKeys.has(key))
      .map(([key, value]) => [key, JSON.stringify(value, null, 2)])),
  );
  const [extraErrors, setExtraErrors] = useState<Record<string, string | null>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState("review-classification");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState<ReviewDecision | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const validationCheckboxRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const redirectTimer = useRef<number | undefined>(undefined);
  const initialExtraJson = Object.fromEntries(Object.entries(result.extracted_data ?? {})
    .filter(([key]) => !standardKeys.has(key))
    .map(([key, value]) => [key, JSON.stringify(value, null, 2)]));

  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const update = () => {
      const sections = root.querySelectorAll<HTMLElement>("[data-review-section]");
      const ownScroll = root.scrollHeight > root.clientHeight + 2;
      const line = ownScroll ? root.getBoundingClientRect().top + 52 : 52;
      const visibleIds: string[] = [];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) visibleIds.push(section.id);
      }
      const current = activeReviewSection(
        Array.from(sections, (section) => section.id),
        ownScroll
          ? root.scrollHeight - root.scrollTop - root.clientHeight <= 2
          : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2,
        visibleIds,
      );
      if (current) setActiveTab(current);
    };
    root.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      root.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => { if (saveError) errorRef.current?.focus(); }, [saveError]);

  const classificationChanged = documentType !== (result.classification?.document_type ?? "")
    || priority !== (result.classification?.priority_level ?? "")
    || hasSpecialtyChanged(result.classification?.specialty, specialty);
  const extractedChanged = JSON.stringify(extracted) !== JSON.stringify(result.extracted_data ?? {});
  const destinationChanged = destination !== result.routing_decision.primary_destination;
  const validationChanged = JSON.stringify(validation) !== JSON.stringify(result.validation ?? emptyValidation());
  const contentChanged = classificationChanged || extractedChanged || destinationChanged;
  const needsValidation = result.validation === null || contentChanged || validationChanged;
  const dirty = hasUnsavedReviewChanges({ contentChanged, validationChanged, confirmed, drafts, extraJson, initialExtraJson });
  const hasExtraError = Object.values(extraErrors).some(Boolean);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => shouldBlockReviewNavigation({
    dirty, saving, success: !!success,
    currentPath: currentLocation.pathname + currentLocation.search,
    nextPath: nextLocation.pathname + nextLocation.search,
    allowResultPath: conflict ? `/results/${encodeURIComponent(result.document_id)}` : undefined,
  }));
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if ((dirty || saving) && !success) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saving, success]);
  const approvalReasons = approvalBlockers({
    documentType, priority, destination, hasExtraError, needsValidation, confirmed,
    saving, success: !!success, conflict,
  });
  const canApprove = approvalReasons.length === 0;

  const updateExtraction = (path: string[], value: unknown) => {
    setExtracted((previous) => writeReviewField(result.extracted_data, previous, path, value));
    setConfirmed(false);
  };
  const updateMedication = (index: number, key: keyof Medication, raw: string) => {
    const items = (extracted.medications ?? []).map((item) => ({ ...item }));
    items[index][key] = restoredTextValue(raw, medicationOriginals.current[index]?.[key]);
    setExtracted((previous) => ({ ...previous, medications: items }));
    setConfirmed(false);
  };
  const updateStudy = (index: number, raw: string) => {
    const items: RequestedStudy[] = (extracted.requested_studies ?? []).map((item) => ({ ...item }));
    items[index].name = restoredTextValue(raw, studyOriginals.current[index]?.name);
    setExtracted((previous) => ({ ...previous, requested_studies: items }));
    setConfirmed(false);
  };
  const updateValidation = (key: ValidationKey, values: string[]) => {
    setValidation((previous) => ({ ...previous, [key]: values }));
    setConfirmed(false);
  };
  const addValidation = (key: ValidationKey) => {
    const value = drafts[key].trim();
    if (!value) return;
    updateValidation(key, [...validation[key], value]);
    setDrafts((previous) => ({ ...previous, [key]: "" }));
  };
  const updateExtraJson = (key: string, text: string) => {
    setExtraJson((previous) => ({ ...previous, [key]: text }));
    const parsed = parseAdditionalJson(result.extracted_data?.[key], text, key);
    setExtraErrors((previous) => ({ ...previous, [key]: parsed.error ?? null }));
    if (!parsed.error) setExtracted((previous) => ({ ...previous, [key]: parsed.value }));
    setConfirmed(false);
  };

  const submit = async (decision: ReviewDecision) => {
    if (saving || success || conflict || (decision === "APPROVE" && !canApprove)) return;
    const request = createReviewPatch({
      decision, result, documentType, priority, specialty, destination,
      extracted, medicationOriginals: medicationOriginals.current, studyOriginals: studyOriginals.current,
      validation, confirmed, hasExtraError,
    });
    setDialog(null);
    setSaving(true);
    setSaveError(null);
    try {
      const response = await submitReview(result.document_id, request);
      if (response.status !== (decision === "APPROVE" ? "APPROVED" : "REJECTED")) {
        throw new Error("El Backend confirmó un estado distinto a la decisión solicitada.");
      }
      setSuccess(decision);
      redirectTimer.current = window.setTimeout(() => {
        navigate(`/results/${encodeURIComponent(result.document_id)}`);
      }, 900);
    } catch (error) {
      setSaveError(reviewError(error));
      if (error instanceof ApiError && (error.status === 409 || error.code === "INVALID_REVIEW_STATE")) setConflict(true);
    } finally {
      setSaving(false);
    }
  };

  const leave = () => blocker.state === "blocked" ? blocker.proceed() : navigate("/audit");
  const sourceName = reviewSourceLabel(result.document_id, viewer.status === "text", location.state);
  const warningMessages = reviewWarningMessages(result.routing_decision.audit_reasons, result.validation?.missing_fields);

  return (
    <div className="clinical-review">
      <div className="clinical-review__content">
        <header className="clinical-review__heading">
          <h1>Revisión clínica</h1>
          <p>Compare el documento original con la información procesada, realice las correcciones necesarias y registre una decisión.</p>
        </header>
        <div className="clinical-review__grid">
          <section className="clinical-review__panel clinical-review__panel--review" aria-label="Revisión">
            <div className="clinical-review__panel-title clinical-review__panel-title--review">
              <h2>Revisión</h2>
              <DocumentIdentity documentId={result.document_id} />
            </div>
            <div ref={scrollRef} className="clinical-review__scroll">
              <div className="clinical-review__modules">
                <div className="clinical-review__warning">
                  <div><AlertTriangle size={16} aria-hidden="true" /> <strong>Requiere revisión</strong></div>
                  {warningMessages.length > 0 && (
                    <ul>{warningMessages.map((message, index) =>
                      <li key={`${index}-${message}`}>{message}</li>)}</ul>
                  )}
                  <p className="clinical-review__warning-guidance">Complete únicamente los datos respaldados por el documento original.</p>
                </div>
                <nav className="clinical-review__tabs" aria-label="Secciones de la revisión">
                  {[
                    ["Clasificación", "review-classification"],
                    ["Datos extraídos", "review-extracted-data"],
                    ["Validación", "review-validation"],
                    ["Destino", "review-destination"],
                  ].map(([label, id]) => (
                    <button key={id} type="button" aria-current={activeTab === id ? "true" : undefined}
                      onClick={() => {
                        setActiveTab(id);
                        scrollRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}>{label}</button>
                  ))}
                </nav>
                <ReviewSection id="review-classification" title="Clasificación">
                  <div className="clinical-review__field-legend">
                    <span><span className="clinical-review__legend-required" aria-hidden="true">*</span> Requerido para aprobar</span>
                    <span><span className="clinical-review__legend-missing" aria-hidden="true" /> Dato no identificado; no bloquea por sí solo</span>
                  </div>
                  <div className="clinical-review__fields clinical-review__fields--three">
                    <label><span>Tipo de documento <em aria-hidden="true">*</em></span>
                      <select value={documentType} required aria-required="true" onChange={(event) => { setDocumentType(event.target.value as DocumentType | ""); setConfirmed(false); }} disabled={saving || !!success}>
                        <option value="">Seleccione un tipo</option>
                        {documentTypes.map((type) => <option key={type} value={type}>{documentTypeLabel(type)}</option>)}
                      </select>
                    </label>
                    <label>Especialidad
                      <input value={specialty} onChange={(event) => { setSpecialty(event.target.value); setConfirmed(false); }} placeholder="Sin valor" disabled={saving || !!success} />
                    </label>
                    <label><span>Prioridad <em aria-hidden="true">*</em></span>
                      <select value={priority} required aria-required="true" onChange={(event) => { setPriority(event.target.value as PriorityLevel | ""); setConfirmed(false); }} disabled={saving || !!success}>
                        <option value="">Seleccione prioridad</option>
                        <option value="ROUTINE">Rutinaria</option><option value="URGENT">Urgente</option>
                      </select>
                    </label>
                  </div>
                </ReviewSection>
                <ReviewSection id="review-extracted-data" title="Datos extraídos">
                  <div className="clinical-review__fields">
                    {standardFields.map((field) => {
                      const current = readPath(extracted, field.path);
                      const missing = result.validation?.missing_fields.some((item) => item === field.path.join(".") || item === field.path.at(-1));
                      const missingDescriptionId = `clinical-missing-${field.path.join("-")}`;
                      const hintId = `clinical-hint-${field.path.join("-")}`;
                      return <label key={field.path.join(".")} className={missing ? "clinical-review__missing" : ""}>{field.label}
                        <span className="clinical-review__input-wrap">
                          {missing && <span aria-hidden="true" className="clinical-review__missing-indicator" />}
                          <input type={field.number ? "number" : "text"} min={field.number ? 0 : undefined}
                            step={field.number ? 1 : undefined} value={typeof current === "string" || typeof current === "number" ? current : ""} placeholder="Sin valor"
                            aria-describedby={[missing && missingDescriptionId, field.hint && hintId].filter(Boolean).join(" ") || undefined}
                            disabled={saving || !!success}
                            onChange={(event) => {
                              const raw = event.target.value;
                              if (field.number && raw !== "" && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))) return;
                              const original = readPath(result.extracted_data ?? {}, field.path);
                              const value = field.number ? (raw === "" ? null : Number(raw))
                                : restoredTextValue(raw, original as string | null | undefined);
                              updateExtraction(field.path, value);
                            }} />
                        </span>
                        {missing && <span id={missingDescriptionId} className="clinical-review__missing-note">No identificado</span>}
                        {field.hint && <small id={hintId} className="clinical-review__hint">{field.hint}</small>}
                      </label>;
                    })}
                  </div>
                  <div className="clinical-review__array-group">
                    <h4>Medicamentos</h4>
                    {(extracted.medications ?? []).map((item, index) => (
                      <div className="clinical-review__array-row" key={index}>
                        <label>Medicamento {index + 1}<input value={item.name ?? ""} placeholder="Nombre" disabled={saving || !!success} onChange={(event) => updateMedication(index, "name", event.target.value)} /></label>
                        <label>Dosis<input value={item.dosage ?? ""} placeholder="Sin valor" disabled={saving || !!success} onChange={(event) => updateMedication(index, "dosage", event.target.value)} /></label>
                        <button type="button" aria-label={`Eliminar medicamento ${index + 1}`} disabled={saving || !!success} onClick={() => { medicationOriginals.current.splice(index, 1); setExtracted((previous) => ({ ...previous, medications: (previous.medications ?? []).filter((_, i) => i !== index) })); setConfirmed(false); }}><X size={16} /></button>
                      </div>
                    ))}
                    <button type="button" className="clinical-review__add" disabled={saving || !!success} onClick={() => { medicationOriginals.current.push({ name: null, dosage: null }); setExtracted((previous) => ({ ...previous, medications: [...(previous.medications ?? []), { name: null, dosage: null }] })); setConfirmed(false); }}>Agregar medicamento</button>
                  </div>
                  <div className="clinical-review__array-group">
                    <h4>Estudios solicitados</h4>
                    {(extracted.requested_studies ?? []).map((item, index) => (
                      <div className="clinical-review__array-row" key={index}>
                        <label>Estudio {index + 1}<input value={item.name ?? ""} placeholder="Sin valor" disabled={saving || !!success} onChange={(event) => updateStudy(index, event.target.value)} /></label>
                        <button type="button" aria-label={`Eliminar estudio ${index + 1}`} disabled={saving || !!success} onClick={() => { studyOriginals.current.splice(index, 1); setExtracted((previous) => ({ ...previous, requested_studies: (previous.requested_studies ?? []).filter((_, i) => i !== index) })); setConfirmed(false); }}><X size={16} /></button>
                      </div>
                    ))}
                    <button type="button" className="clinical-review__add" disabled={saving || !!success} onClick={() => { studyOriginals.current.push({ name: null }); setExtracted((previous) => ({ ...previous, requested_studies: [...(previous.requested_studies ?? []), { name: null }] })); setConfirmed(false); }}>Agregar estudio</button>
                  </div>
                  {Object.keys(extraJson).length > 0 && <div className="clinical-review__array-group"><h4>Otros datos</h4>
                    {Object.entries(extraJson).map(([key, value], index) => <label key={key}>{key}
                      <textarea value={value} rows={3} spellCheck={false} disabled={saving || !!success} aria-invalid={!!extraErrors[key]} aria-describedby={extraErrors[key] ? `clinical-extra-error-${index}` : undefined} onChange={(event) => updateExtraJson(key, event.target.value)} />
                      {extraErrors[key] && <span id={`clinical-extra-error-${index}`} className="clinical-review__field-error">{extraErrors[key]}</span>}
                    </label>)}
                  </div>}
                </ReviewSection>
                <ReviewSection id="review-validation" title="Validación">
                  {validationGroups.map((group) => <div className="clinical-review__validation-group" key={group.key}>
                    <h4>{group.label}</h4>
                    {group.key === "missing_fields" && <p>Son hallazgos del análisis, no requisitos automáticos para aprobar.</p>}
                    {validation[group.key].length ? <ul>{validation[group.key].map((item, index) =>
                      <li key={`${item}-${index}`}><span>{group.key === "missing_fields" ? humanizeMissingField(item) : item}</span><button type="button" aria-label={`Eliminar ${item}`} disabled={saving || !!success} onClick={() => updateValidation(group.key, validation[group.key].filter((_, i) => i !== index))}><X size={14} /></button></li>)}</ul>
                      : <p>{group.empty}</p>}
                    <div className="clinical-review__validation-add">
                      <input aria-label={`Agregar a ${group.label.toLowerCase()}`} placeholder={group.key === "missing_fields" ? "Agregar dato no identificado" : group.key === "inconsistencies" ? "Agregar inconsistencia" : "Agregar advertencia"} value={drafts[group.key]} disabled={saving || !!success}
                        onChange={(event) => setDrafts((previous) => ({ ...previous, [group.key]: event.target.value }))}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addValidation(group.key); } }} />
                      <button type="button" disabled={!drafts[group.key].trim() || saving || !!success} onClick={() => addValidation(group.key)}>Agregar</button>
                    </div>
                  </div>)}
                  <label className="clinical-review__confirmation"><input ref={validationCheckboxRef} type="checkbox" checked={confirmed} disabled={saving || !!success} onChange={(event) => setConfirmed(event.target.checked)} />Validación revisada</label>
                  {needsValidation && !confirmed && <p className="clinical-review__hint">Confirme la validación después de revisar los cambios realizados.</p>}
                </ReviewSection>
                <ReviewSection id="review-destination" title="Destino">
                  <label className="clinical-review__destination"><span>Destino principal <em aria-hidden="true">*</em></span>
                    <select value={destination} required aria-required="true" aria-describedby="clinical-destination-hint" disabled={saving || !!success} onChange={(event) => { setDestination(event.target.value as RoutingDestination); setConfirmed(false); }}>
                      {destinations.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                    </select>
                    <small id="clinical-destination-hint">{destination === "HUMAN_REVIEW" ? "Seleccione un destino final para poder aprobar la revisión." : "Se confirmará el destino lógico al aprobar la revisión."}</small>
                  </label>
                </ReviewSection>
                {success && <div className="clinical-review__success" role="status"><Check size={16} />{success === "APPROVE" ? "Revisión aprobada" : "Documento rechazado"}. Redirigiendo al resultado…</div>}
              </div>
            </div>
            {saveError && <div ref={errorRef} tabIndex={-1} className="clinical-review__error clinical-review__error--persistent" role="alert">
              <span>{saveError}</span>
              {conflict && <Link to={`/results/${encodeURIComponent(result.document_id)}`}>Ver resultado actualizado</Link>}
            </div>}
            <div className="clinical-review__actions">
              <div className="clinical-review__action-context">
                <p id="clinical-approval-help" className="clinical-review__approval-help" role="status" aria-live="polite" aria-atomic="true">
                  {approvalReasons.length > 0 && (saving || success || conflict
                    ? approvalReasons.join(" ")
                    : `Para aprobar: ${approvalReasons.join(" ")}`)}
                </p>
                {needsValidation && !confirmed && !saving && !success && !conflict && <button type="button" className="clinical-review__validation-jump" onClick={() => {
                  setActiveTab("review-validation");
                  validationCheckboxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  validationCheckboxRef.current?.focus({ preventScroll: true });
                }}>Ir a validación</button>}
                <span>{dirty && !success ? "● Cambios sin registrar" : ""}</span>
              </div>
              <div className="clinical-review__action-buttons">
                <button type="button" className="clinical-review__cancel" disabled={saving || !!success} onClick={leave}>Cancelar</button>
                <button type="button" className="clinical-review__reject" disabled={saving || !!success || conflict} onClick={() => setDialog("reject")}>Rechazar</button>
                <button type="button" className="clinical-review__approve" disabled={!canApprove}
                  aria-describedby={!canApprove ? "clinical-approval-help" : undefined}
                  onClick={() => void submit("APPROVE")}>{saving ? "Guardando…" : "Aprobar revisión"}</button>
              </div>
            </div>
          </section>
          <section className="clinical-review__panel clinical-review__panel--document" aria-label="Documento original">
            <div className="clinical-review__panel-title clinical-review__panel-title--document"><h2>Documento</h2><span>{sourceName}</span></div>
            <div className="clinical-review__viewer"><DocumentViewer document={viewer} ariaLabel={`Documento original ${result.document_id}`} /></div>
          </section>
        </div>
      </div>
      {dialog === "reject" && <ReviewDialog title="Rechazar documento" onClose={() => setDialog(null)} actions={<>
        <button type="button" onClick={() => setDialog(null)}>Cancelar</button>
        <button type="button" className="clinical-review__dialog-danger" onClick={() => void submit("REJECT")}>Confirmar rechazo</button>
      </>}>{confirmed && !hasExtraError
        ? "Esta acción registrará el documento como rechazado y enviará las correcciones revisadas. ¿Desea continuar?"
        : "Esta acción registrará el documento como rechazado. Las correcciones sin confirmar no se enviarán. ¿Desea continuar?"}</ReviewDialog>}
      {blocker.state === "blocked" && <ReviewDialog title="Cambios sin guardar" onClose={() => blocker.reset()} actions={<>
        <button type="button" onClick={() => blocker.reset()}>Continuar editando</button>
        <button type="button" className="clinical-review__dialog-primary" onClick={leave}>Salir sin registrar</button>
      </>}>Se realizaron modificaciones que no han sido registradas. ¿Desea salir de todas formas?</ReviewDialog>}
    </div>
  );
}

function ReviewPageLoader({ documentId, onRetry }: { documentId: string; onRetry: () => void }) {
  const [result, setResult] = useState<ProcessingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DocumentViewerState>({ status: "loading", documentKey: documentId });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getDocumentResult(documentId).then((data) => {
      if (active) setResult(data);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "No se pudo cargar el resultado.");
    }).finally(() => { if (active) setLoading(false); });
    void getDocumentContent(documentId, controller.signal).then((content) => {
      if (!active) return;
      if (!content) setViewer({ status: "unavailable", documentKey: documentId });
      else if (content.kind === "text") setViewer({ status: "text", documentKey: documentId, text: content.text });
      else setViewer({ status: "ready", documentKey: documentId, blob: content.blob, mimeType: content.mimeType });
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) setViewer({ status: "error", documentKey: documentId, message: error instanceof Error ? error.message : "No se pudo cargar el documento." });
    });
    return () => { active = false; controller.abort(); };
  }, [documentId]);

  if (loading) return <div className="clinical-review__state" role="status">Cargando revisión clínica…</div>;
  if (loadError) return <div className="clinical-review__state" role="alert"><p>{loadError}</p><button type="button" onClick={onRetry}>Reintentar</button></div>;
  if (!result) return <div className="clinical-review__state" role="status">No se encontró el documento solicitado.</div>;
  if (result.status !== "NEEDS_AUDIT") return <div className="clinical-review__state" role="status"><p>Este documento ya no está pendiente de revisión.</p><Link to={`/results/${encodeURIComponent(result.document_id)}`}>Ver resultado</Link></div>;
  return <ReviewWorkspace key={result.document_id} result={result} viewer={viewer.documentKey === result.document_id ? viewer : { status: "loading", documentKey: result.document_id }} />;
}

function ClinicalReviewPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [retry, setRetry] = useState(0);
  if (!documentId) return <div className="clinical-review__state" role="status">No se encontró el documento solicitado.</div>;
  return <ReviewPageLoader key={`${documentId}:${retry}`} documentId={documentId} onRetry={() => setRetry((value) => value + 1)} />;
}

export default ClinicalReviewPage;
