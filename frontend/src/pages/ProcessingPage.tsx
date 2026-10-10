import "../styles/processing-page.css";
import PageHeader from "../components/PageHeader";
import { Box, CircularProgress } from "@mui/material";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DocumentViewer, {
  type DocumentViewerState,
  type ViewerMimeType,
} from "../components/DocumentViewer/DocumentViewer";
import { processFile, processText } from "../services/processingService";
import { useNotification } from "../notifications/useNotification";
import type { ProcessingResponse } from "../types/processing";

const RESULT_HANDOFF_STORAGE_KEY = "mediflow.result.handoff" as const;

type InputMode = "file" | "text";

const EXT_TO_MIME: Record<string, ViewerMimeType> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function isViewerMimeType(value: string): value is ViewerMimeType {
  return (
    value === "application/pdf" ||
    value === "image/jpeg" ||
    value === "image/png"
  );
}

function normalizeViewerMimeType(file: File): ViewerMimeType | null {
  if (isViewerMimeType(file.type)) return file.type;
  const byExt = EXT_TO_MIME[getFileExtension(file.name)];
  return byExt ?? null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ORIGIN_CHANNELS = [
  "Guardia de Emergencias",
  "Consulta Externa",
  "Hospitalización",
  "Laboratorio",
  "Referencia Externa",
  "Otro",
] as const;

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

function isValidFile(file: File): boolean {
  return normalizeViewerMimeType(file) !== null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(file: File): "PDF" | "PNG" | "JPG" {
  const resolved = normalizeViewerMimeType(file);
  if (resolved === "application/pdf") return "PDF";
  if (resolved === "image/png") return "PNG";
  if (resolved === "image/jpeg") return "JPG";
  const ext = getFileExtension(file.name);
  if (ext === ".pdf") return "PDF";
  if (ext === ".png") return "PNG";
  return "JPG";
}

function UploadEmptyStateIllustration() {
  return (
    <svg
      aria-hidden="true"
      width="160"
      height="152"
      viewBox="0 0 160 152"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M67.797 151.228C105.24 151.228 135.594 145.556 135.594 138.56C135.594 131.564 105.24 125.892 67.797 125.892C30.3537 125.892 0 131.564 0 138.56C0 145.556 30.3537 151.228 67.797 151.228Z"
        fill="#AEB8C2"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M122.034 101.344L98.1091 71.8991C96.9611 70.5131 95.2831 69.6741 93.5161 69.6741H42.0761C40.3101 69.6741 38.6321 70.5131 37.4841 71.8991L13.5601 101.344V114.727H122.035V101.344H122.034Z"
        fill="#AEB8C2"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M33.83 31.67H101.763C102.824 31.67 103.841 32.0915 104.591 32.8416C105.342 33.5918 105.763 34.6092 105.763 35.67V129.014C105.763 130.075 105.342 131.092 104.591 131.842C103.841 132.593 102.824 133.014 101.763 133.014H33.83C32.7691 133.014 31.7517 132.593 31.0015 131.842C30.2514 131.092 29.83 130.075 29.83 129.014V35.67C29.83 34.6092 30.2514 33.5918 31.0015 32.8416C31.7517 32.0915 32.7691 31.67 33.83 31.67Z"
        fill="#F5F5F5"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M42.678 41.623H92.915C93.4454 41.623 93.9541 41.8338 94.3292 42.2088C94.7043 42.5839 94.915 43.0926 94.915 43.623V68.58C94.915 69.1105 94.7043 69.6192 94.3292 69.9943C93.9541 70.3693 93.4454 70.58 92.915 70.58H42.678C42.1475 70.58 41.6388 70.3693 41.2637 69.9943C40.8887 69.6192 40.678 69.1105 40.678 68.58V43.623C40.678 43.0926 40.8887 42.5839 41.2637 42.2088C41.6388 41.8338 42.1475 41.623 42.678 41.623ZM42.94 81.437H92.653C93.2529 81.437 93.8282 81.6754 94.2524 82.0996C94.6766 82.5238 94.915 83.0991 94.915 83.699C94.915 84.299 94.6766 84.8743 94.2524 85.2985C93.8282 85.7227 93.2529 85.961 92.653 85.961H42.94C42.34 85.961 41.7647 85.7227 41.3405 85.2985C40.9163 84.8743 40.678 84.299 40.678 83.699C40.678 83.0991 40.9163 82.5238 41.3405 82.0996C41.7647 81.6754 42.34 81.437 42.94 81.437ZM42.94 93.2H92.653C93.253 93.2 93.8285 93.4384 94.2528 93.8627C94.6771 94.287 94.9155 94.8625 94.9155 95.4625C94.9155 96.0626 94.6771 96.6381 94.2528 97.0624C93.8285 97.4867 93.253 97.725 92.653 97.725H42.94C42.3399 97.725 41.7644 97.4867 41.3401 97.0624C40.9158 96.6381 40.6775 96.0626 40.6775 95.4625C40.6775 94.8625 40.9158 94.287 41.3401 93.8627C41.7644 93.4384 42.3399 93.2 42.94 93.2ZM121.813 136.702C121.038 139.773 118.316 142.062 115.078 142.062H20.515C17.277 142.062 14.555 139.772 13.781 136.702C13.6333 136.117 13.5588 135.516 13.559 134.912V101.345H39.877C42.784 101.345 45.127 103.793 45.127 106.765V106.805C45.127 109.776 47.497 112.175 50.404 112.175H85.189C88.096 112.175 90.466 109.754 90.466 106.782V106.77C90.466 103.798 92.809 101.344 95.716 101.344H122.034V134.913C122.034 135.53 121.957 136.129 121.813 136.702Z"
        fill="#DCE0E6"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M125.121 33.292L118.291 35.942C118.116 36.0102 117.924 36.0275 117.74 35.992C117.555 35.9564 117.384 35.8693 117.246 35.7408C117.108 35.6123 117.01 35.4476 116.962 35.2656C116.914 35.0836 116.918 34.8917 116.974 34.712L118.911 28.505C116.322 25.561 114.802 21.971 114.802 18.097C114.802 8.102 124.92 0 137.402 0C149.881 0 160 8.102 160 18.097C160 28.092 149.882 36.194 137.401 36.194C132.873 36.194 128.657 35.128 125.121 33.292Z"
        fill="#F5F5F5"
      />
      <path
        d="M146.304 21.365C147.878 21.365 149.153 20.1047 149.153 18.55C149.153 16.9953 147.878 15.735 146.304 15.735C144.731 15.735 143.455 16.9953 143.455 18.55C143.455 20.1047 144.731 21.365 146.304 21.365Z"
        fill="#AEB8C2"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M131.348 21.013H125.65L128.548 16.087L131.348 21.013ZM134.909 16.087H139.894V21.013H134.909V16.087Z"
        fill="#AEB8C2"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="processing-page__spinner"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      className="processing-page__inline-error-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

interface OriginFieldsProps {
  originId: string;
  originChannel: string;
  originOtro: string;
  disabled?: boolean;
  fieldError?: string | null;
  onChannelChange: (value: string) => void;
  onOtherChange: (value: string) => void;
}

function OriginFields({
  originId,
  originChannel,
  originOtro,
  disabled,
  fieldError,
  onChannelChange,
  onOtherChange,
}: OriginFieldsProps) {
  const isOtro = originChannel === "Otro";
  const otroId = `${originId}-otro`;
  const selectErrorId = `${originId}-select-err`;
  const otroErrorId = `${originId}-otro-err`;

  const errorTargetsOtro =
    Boolean(fieldError) && isOtro && originOtro.length === 0;
  const errorTargetsSelect = Boolean(fieldError) && !errorTargetsOtro;

  return (
    <div className="processing-page__origin-wrap--inline">
      <label htmlFor={originId} className="processing-page__field-label">
        Canal de origen <span className="processing-page__required">*</span>
      </label>
      <select
        id={originId}
        value={originChannel}
        onChange={(event) => onChannelChange(event.target.value)}
        disabled={disabled}
        className="processing-page__select"
        aria-invalid={errorTargetsSelect || undefined}
        aria-describedby={errorTargetsSelect ? selectErrorId : undefined}
      >
        <option value="" disabled>
          Seleccione un canal
        </option>
        {ORIGIN_CHANNELS.map((channel) => (
          <option key={channel} value={channel}>
            {channel}
          </option>
        ))}
      </select>
      {fieldError && errorTargetsSelect && (
        <p
          id={selectErrorId}
          className="processing-page__file-field-error"
          role="alert"
        >
          {fieldError}
        </p>
      )}
      {isOtro && (
        <div
          className="processing-page__origin-wrap--inline"
          style={{ marginTop: 8 }}
        >
          <label htmlFor={otroId} className="processing-page__field-label">
            Especifique el canal{" "}
            <span className="processing-page__required">*</span>
          </label>
          <input
            id={otroId}
            type="text"
            value={originOtro}
            onChange={(event) => onOtherChange(event.target.value)}
            placeholder="Escriba el canal de origen"
            disabled={disabled}
            className="processing-page__textinput"
            aria-invalid={errorTargetsOtro || undefined}
            aria-describedby={errorTargetsOtro ? otroErrorId : undefined}
          />
          {fieldError && errorTargetsOtro && (
            <p
              id={otroErrorId}
              className="processing-page__file-field-error"
              role="alert"
              style={{ marginTop: 8 }}
            >
              {fieldError}
            </p>
          )}
        </div>
      )}
      {fieldError &&
        !errorTargetsSelect &&
        !errorTargetsOtro &&
        isOtro &&
        originOtro.length > 0 && (
          <p
            id={selectErrorId}
            className="processing-page__file-field-error"
            role="alert"
            style={{ marginTop: 8 }}
          >
            {fieldError}
          </p>
        )}
    </div>
  );
}

function ProcessingPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPickerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tabFileRef = useRef<HTMLButtonElement>(null);
  const tabTextRef = useRef<HTMLButtonElement>(null);

  const textareaId = useId();
  const originIdFile = useId();
  const originIdText = useId();

  const { showNotification, showError } = useNotification();
  const navigate = useNavigate();

  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [originChannel, setOriginChannel] = useState("");
  const [originOtro, setOriginOtro] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [originFieldError, setOriginFieldError] = useState<string | null>(null);
  const [textFieldError, setTextFieldError] = useState<string | null>(null);

  interface SuccessState {
    result: ProcessingResponse;
    sourceKind: InputMode;
    sourceText: string | null;
    sourceFile: File | null;
    originChannel: string;
  }
  const [successState, setSuccessState] = useState<SuccessState | null>(null);

  const previewDocument: DocumentViewerState | null = selectedFile
    ? (() => {
        const resolvedMime = normalizeViewerMimeType(selectedFile);
        if (!resolvedMime) return null;
        return {
          status: "ready",
          documentKey:
            selectedFile.name +
            String(selectedFile.lastModified) +
            String(selectedFile.size),
          blob: selectedFile,
          mimeType: resolvedMime,
          fileName: selectedFile.name,
        };
      })()
    : null;

  const handleFile = useCallback((file: File) => {
    if (!isValidFile(file)) {
      setSelectedFile(null);
      setFileError(
        "Formato no admitido. Seleccione un archivo PDF, JPG o PNG.",
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setFileError("El archivo no puede superar los 10 MB.");
      return;
    }

    setSelectedFile(file);
    setFileError(null);
    setProcessingError(false);
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (isProcessing || !files || files.length === 0) return;
      handleFile(files[0]);
    },
    [handleFile, isProcessing],
  );

  const openPicker = useCallback(() => {
    if (isProcessing) return;
    setFileError(null);
    fileInputRef.current?.click();
  }, [isProcessing]);

  const resolveOriginChannel = (): string => {
    return originChannel === "Otro" ? originOtro.trim() : originChannel;
  };

  const isOtro = originChannel === "Otro";
  const hasOrigin =
    originChannel !== "" && (!isOtro || originOtro.trim().length > 0);

  const validateForm = (): boolean => {
    let ok = true;
    setOriginFieldError(null);
    setTextFieldError(null);
    setFormError(null);
    setFileError((prev) => prev);

    if (!originChannel.trim()) {
      setOriginFieldError("Indique el canal de origen.");
      ok = false;
    } else if (originChannel === "Otro" && !originOtro.trim()) {
      setOriginFieldError("Especifique el canal de origen.");
      ok = false;
    }

    if (inputMode === "file" && !selectedFile) {
      setFileError("Seleccione un documento para procesar.");
      ok = false;
    }

    if (inputMode === "text" && !documentText.trim()) {
      setTextFieldError("Ingrese el contenido del documento.");
      ok = false;
    }

    return ok;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const resolvedOriginChannel = resolveOriginChannel();

    setIsProcessing(true);
    setProcessingError(false);

    try {
      let result: ProcessingResponse | null = null;
      if (inputMode === "file" && selectedFile) {
        result = await processFile({
          file: selectedFile,
          origin_channel: resolvedOriginChannel,
        });
      }

      if (inputMode === "text") {
        result = await processText({
          document_text: documentText.trim(),
          origin_channel: resolvedOriginChannel,
        });
      }

      const finalResult = result as ProcessingResponse;

      const handoff = {
        result: finalResult,
        sourceKind: inputMode,
        sourceText: inputMode === "text" ? documentText : null,
        originChannel: resolvedOriginChannel,
        sourceFileMeta:
          inputMode === "file" && selectedFile
            ? {
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
                lastModified: selectedFile.lastModified,
              }
            : null,
        storedAt: new Date().toISOString(),
      };
      try {
        sessionStorage.setItem(
          RESULT_HANDOFF_STORAGE_KEY,
          JSON.stringify(handoff),
        );
      } catch {
        // Silencioso: sessionStorage handoff opcional.
      }

      setSuccessState({
        result: finalResult,
        sourceKind: inputMode,
        sourceText: inputMode === "text" ? documentText : null,
        sourceFile: inputMode === "file" ? selectedFile : null,
        originChannel: resolvedOriginChannel,
      });

      showNotification({
        message: "Documento procesado correctamente.",
        severity: "success",
      });

      navigate("/result", {
        state: {
          result: finalResult,
          sourceKind: inputMode,
          sourceText: inputMode === "text" ? documentText : null,
          sourceFile:
            inputMode === "file" && selectedFile
              ? {
                  name: selectedFile.name,
                  size: selectedFile.size,
                  type: selectedFile.type,
                  lastModified: selectedFile.lastModified,
                }
              : null,
          originChannel: resolvedOriginChannel,
        },
      });
    } catch (error) {
      showError(error);
      setProcessingError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearForm = () => {
    if (isProcessing) return;
    setInputMode("file");
    setSelectedFile(null);
    setDocumentText("");
    setOriginChannel("");
    setOriginOtro("");
    setFileError(null);
    setFormError(null);
    setProcessingError(false);
    setOriginFieldError(null);
    setTextFieldError(null);
    setSuccessState(null);

    try {
      sessionStorage.removeItem(RESULT_HANDOFF_STORAGE_KEY);
    } catch {
      // sessionStorage opcional
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleProcessAnother = () => {
    try {
      sessionStorage.removeItem(RESULT_HANDOFF_STORAGE_KEY);
    } catch {
      // sessionStorage opcional
    }
    setSuccessState(null);
    setIsProcessing(false);
    handleClearForm();
  };

  const hasClearableData = useMemo(() => {
    return (
      successState !== null ||
      selectedFile !== null ||
      documentText.length > 0 ||
      originChannel !== "" ||
      originOtro.length > 0 ||
      Boolean(fileError) ||
      Boolean(formError) ||
      Boolean(processingError) ||
      Boolean(originFieldError) ||
      Boolean(textFieldError)
    );
  }, [
    successState,
    selectedFile,
    documentText,
    originChannel,
    originOtro,
    fileError,
    formError,
    processingError,
    originFieldError,
    textFieldError,
  ]);

  const isValidForSubmit = useMemo(() => {
    if (inputMode === "file") {
      return selectedFile !== null && hasOrigin && !fileError;
    }
    return documentText.trim().length > 0 && hasOrigin && !textFieldError;
  }, [
    inputMode,
    selectedFile,
    hasOrigin,
    fileError,
    documentText,
    textFieldError,
  ]);

  const submitLabel = useMemo(() => {
    if (isProcessing) {
      return inputMode === "text"
        ? "Procesando texto…"
        : "Procesando documento…";
    }
    if (processingError) return "Reintentar";
    return inputMode === "text" ? "Procesar texto" : "Procesar documento";
  }, [isProcessing, processingError, inputMode]);

  const changeMode = useCallback(
    (next: InputMode) => {
      if (isProcessing) return;
      setInputMode(next);
      setProcessingError(false);
      setOriginFieldError(null);
      setTextFieldError(null);

      requestAnimationFrame(() => {
        if (next === "text") {
          textareaRef.current?.focus();
        } else {
          uploadPickerRef.current?.focus();
        }
      });
    },
    [isProcessing],
  );

  const MODES: InputMode[] = ["file", "text"];

  const handleTablistKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isProcessing) return;
    const currentIdx = MODES.indexOf(inputMode);
    let nextMode: InputMode | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      nextMode = MODES[(currentIdx + 1) % MODES.length];
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      nextMode = MODES[(currentIdx - 1 + MODES.length) % MODES.length];
    } else if (event.key === "Home") {
      event.preventDefault();
      nextMode = MODES[0];
    } else if (event.key === "End") {
      event.preventDefault();
      nextMode = MODES[MODES.length - 1];
    }

    if (nextMode !== null) {
      setInputMode(nextMode);
      setProcessingError(false);
      setOriginFieldError(null);
      setTextFieldError(null);
      requestAnimationFrame(() => {
        const ref = nextMode === "file" ? tabFileRef : tabTextRef;
        ref.current?.focus();
      });
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    handleFiles(event.dataTransfer.files);
  };

  const actionsBlock = (
    <div className="processing-page__actions">
      <div className="processing-page__actions-row">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isProcessing || !isValidForSubmit}
          className={[
            "processing-page__btn-primary",
            isProcessing
              ? "processing-page__btn-primary--enabled processing-page__btn-primary--loading"
              : isValidForSubmit
                ? "processing-page__btn-primary--enabled"
                : "processing-page__btn-primary--disabled",
          ].join(" ")}
        >
          {isProcessing && <Spinner />}
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={handleClearForm}
          disabled={isProcessing || !hasClearableData}
          className="processing-page__btn-secondary"
        >
          Limpiar
        </button>
      </div>
      {isProcessing && (
        <p className="processing-page__processing-hint">
          El procesamiento puede tardar unos segundos.
        </p>
      )}
    </div>
  );

  const successViewerState: DocumentViewerState | null =
    successState?.sourceFile
      ? (() => {
          const resolvedMime = normalizeViewerMimeType(successState.sourceFile);
          if (!resolvedMime) return null;
          return {
            status: "ready",
            documentKey:
              successState.sourceFile.name +
              String(successState.sourceFile.lastModified) +
              String(successState.sourceFile.size),
            blob: successState.sourceFile,
            mimeType: resolvedMime,
            fileName: successState.sourceFile.name,
          };
        })()
      : null;

  const classification = successState?.result.classification;
  const confidence = successState?.result.confidence;
  const extractedData = successState?.result.extracted_data;
  const routingDecision = successState?.result.routing_decision;
  const storage = successState?.result.storage;
  const needsAudit =
    successState?.result.status === "NEEDS_AUDIT" ||
    Boolean(routingDecision?.requires_human_review);

  const successSummaryBlock = (
    <div
      className="processing-page__card"
      style={{
        maxWidth: 896,
        margin: "0 auto",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 999,
            background: "rgba(11, 117, 115, 0.10)",
            color: "var(--proc-status)",
          }}
        >
          <CheckCircleRoundedIcon sx={{ fontSize: 32 }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              lineHeight: "24px",
              fontWeight: 600,
              color: "var(--proc-text)",
            }}
          >
            Documento procesado correctamente
          </div>
          <div
            style={{ fontSize: 13, color: "var(--proc-muted)", marginTop: 2 }}
          >
            Identificador canónico del backend:{" "}
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                color: "var(--proc-text)",
              }}
            >
              {successState?.result.document_id}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--proc-muted-light)",
              marginTop: 4,
            }}
          >
            Estado: {successState?.result.status} · Canal de origen:{" "}
            {successState?.originChannel}
          </div>
        </div>
      </div>

      {needsAudit && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 9,
            background: "var(--proc-error-bg)",
            border: "1px solid var(--proc-error-border)",
            fontSize: 13,
            color: "var(--proc-text)",
          }}
        >
          <strong style={{ color: "var(--proc-required)" }}>
            Requiere auditoría humana.
          </strong>
          <span style={{ color: "var(--proc-muted)" }}>
            La clasificación automática superó el umbral de revisión. El
            documento queda en cola para validación manual.
          </span>
        </div>
      )}

      {(classification ||
        confidence ||
        extractedData ||
        routingDecision ||
        storage) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            borderTop: "1px solid var(--proc-border)",
            borderBottom: "1px solid var(--proc-border)",
            padding: "16px 0",
          }}
        >
          {classification && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--proc-muted)",
                  marginBottom: 6,
                }}
              >
                Clasificación
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: "22px",
                  color: "var(--proc-text)",
                }}
              >
                {classification.document_type && (
                  <span style={{ marginRight: 12 }}>
                    Tipo:{" "}
                    <strong>{String(classification.document_type)}</strong>
                  </span>
                )}
                {classification.specialty && (
                  <span style={{ marginRight: 12 }}>
                    Especialidad: <strong>{classification.specialty}</strong>
                  </span>
                )}
                {classification.priority_level && (
                  <span>
                    Prioridad:{" "}
                    <strong style={{ color: "var(--proc-primary)" }}>
                      {String(classification.priority_level)}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          )}
          {confidence && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--proc-muted)",
                  marginBottom: 6,
                }}
              >
                Confianza
              </div>
              <div style={{ fontSize: 14, color: "var(--proc-text)" }}>
                Global: <strong>{Math.round(confidence.global * 100)}%</strong>
                {typeof confidence.classification === "number" && (
                  <span style={{ marginLeft: 12 }}>
                    Clasificación:{" "}
                    <strong>
                      {Math.round(confidence.classification * 100)}%
                    </strong>
                  </span>
                )}
                {typeof confidence.extraction === "number" && (
                  <span style={{ marginLeft: 12 }}>
                    Extracción:{" "}
                    <strong>{Math.round(confidence.extraction * 100)}%</strong>
                  </span>
                )}
              </div>
            </div>
          )}
          {extractedData && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--proc-muted)",
                  marginBottom: 6,
                }}
              >
                Datos extraídos (resumen)
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: "21px",
                  color: "var(--proc-text)",
                }}
              >
                {(extractedData.patient?.name ||
                  extractedData.patient?.age != null) && (
                  <div>
                    Paciente:{" "}
                    <strong>
                      {[
                        extractedData.patient.name,
                        extractedData.patient.age != null
                          ? `${extractedData.patient.age} años`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </strong>
                  </div>
                )}
                {(extractedData.requesting_doctor?.name ||
                  extractedData.requesting_doctor?.license_number) && (
                  <div>
                    Solicitante:{" "}
                    <strong>
                      {[
                        extractedData.requesting_doctor.name,
                        extractedData.requesting_doctor.license_number,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </strong>
                  </div>
                )}
                {extractedData.primary_diagnosis && (
                  <div style={{ marginTop: 4 }}>
                    Diagnóstico principal:{" "}
                    <strong>{extractedData.primary_diagnosis}</strong>
                  </div>
                )}
                {extractedData.suggested_icd10 && (
                  <div>
                    CIE-10 sugerido:{" "}
                    <strong style={{ color: "var(--proc-primary)" }}>
                      {String(extractedData.suggested_icd10)}
                    </strong>
                  </div>
                )}
                {Array.isArray(extractedData.medications) &&
                  extractedData.medications.length > 0 && (
                    <div>
                      Medicaciones:{" "}
                      <strong>
                        {extractedData.medications.length} ítem(es)
                      </strong>
                    </div>
                  )}
              </div>
            </div>
          )}
          {routingDecision && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--proc-muted)",
                  marginBottom: 6,
                }}
              >
                Enrutamiento
              </div>
              <div style={{ fontSize: 13, color: "var(--proc-text)" }}>
                Destino:{" "}
                <strong>{String(routingDecision.primary_destination)}</strong>
                {routingDecision.justification && (
                  <span style={{ color: "var(--proc-muted)" }}>
                    {" "}
                    · {routingDecision.justification}
                  </span>
                )}
              </div>
            </div>
          )}
          {storage && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--proc-muted)",
                  marginBottom: 6,
                }}
              >
                Almacenamiento
              </div>
              <div style={{ fontSize: 13, color: "var(--proc-text)" }}>
                Estado: <strong>{String(storage.state)}</strong>
                {storage.provider && (
                  <span style={{ marginLeft: 12 }}>
                    Provider: <strong>{String(storage.provider)}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--proc-muted-light)",
            lineHeight: "18px",
          }}
        >
          La visualización detallada del resultado (Ticket <strong>#20</strong>)
          es elaborada por el equipo asignado. La información de esta transición
          ha sido depositada en{" "}
          <code
            style={{
              fontFamily: "ui-monospace, monospace",
              background: "var(--proc-surface-alt)",
              padding: "1px 5px",
              borderRadius: 5,
              fontSize: 11,
            }}
          >
            sessionStorage
          </code>{" "}
          bajo la clave{" "}
          <code
            style={{
              fontFamily: "ui-monospace, monospace",
              background: "var(--proc-surface-alt)",
              padding: "1px 5px",
              borderRadius: 5,
              fontSize: 11,
            }}
          >
            mediflow.result.handoff
          </code>{" "}
          para que el resultado oficial consuma sin re-procesar.
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={handleProcessAnother}
            className="processing-page__btn-primary processing-page__btn-primary--enabled"
          >
            Procesar otro documento
          </button>
          {needsAudit && (
            <button
              type="button"
              onClick={() => navigate("/audit")}
              className="processing-page__btn-secondary"
            >
              Ir a Auditoría
            </button>
          )}
          <button
            type="button"
            onClick={handleClearForm}
            className="processing-page__btn-secondary"
          >
            Descartar y limpiar
          </button>
        </div>
      </div>
    </div>
  );

  const successViewerBlock = (
    <div
      className="processing-page__viewer-panel"
      style={{ minHeight: "100%" }}
    >
      <div className="processing-page__viewer-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <ArticleOutlinedIcon
            sx={{ fontSize: 16, color: "var(--proc-muted)" }}
            aria-hidden
          />
          <div
            className="processing-page__viewer-title"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {successState?.sourceKind === "file" && successState?.sourceFile
              ? successState.sourceFile.name
              : "Documento de texto (modo texto)"}
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {successState?.sourceKind === "file" && successState?.sourceFile && (
            <>
              <span
                className="processing-page__file-type-badge"
                style={{ fontSize: 10, width: 34, height: 24 }}
              >
                {(successState.sourceFile.name.split(".").pop() || "")
                  .toUpperCase()
                  .slice(0, 3) || "FILE"}
              </span>
              <span style={{ fontSize: 12, color: "var(--proc-muted)" }}>
                {successState.sourceFile.size < 1024
                  ? `${successState.sourceFile.size} B`
                  : successState.sourceFile.size < 1024 * 1024
                    ? `${(successState.sourceFile.size / 1024).toFixed(1)} KB`
                    : `${(successState.sourceFile.size / 1024 / 1024).toFixed(2)} MB`}
              </span>
            </>
          )}
          {successState?.sourceKind === "text" && successState?.sourceText && (
            <span style={{ fontSize: 12, color: "var(--proc-muted)" }}>
              {successState.sourceText.length} caracteres
            </span>
          )}
        </div>
      </div>
      <div
        className="processing-page__viewer-body"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          background: "#F1F3F6",
        }}
      >
        {successViewerState ? (
          <DocumentViewer
            document={successViewerState}
            ariaLabel="Vista previa del documento procesado"
          />
        ) : (
          <div style={{ padding: 16, height: "100%", overflow: "auto" }}>
            <pre
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: "21px",
                color: "var(--proc-text)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
                background: "var(--proc-surface)",
                border: "1px solid var(--proc-border)",
                borderRadius: 10,
                padding: 16,
              }}
            >
              {successState?.sourceText || "(sin contenido)"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Box className="processing-page">
      <PageHeader
        title="Procesamiento de documentos"
        description="Cargue un documento clínico o ingrese texto para iniciar su clasificación, extracción y enrutamiento."
      />
      <Box sx={{ width: "100%", maxWidth: 1400, mx: "auto" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          style={{ display: "none" }}
          disabled={isProcessing}
          onChange={(event) => {
            handleFiles(event.target.files);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        />

        {successState ? (
          <div className="processing-page__grid">
            <div className="processing-page__grid-col processing-page__grid-col--config">
              {successSummaryBlock}
            </div>
            <div className="processing-page__grid-col processing-page__grid-col--viewer">
              {successViewerBlock}
            </div>
          </div>
        ) : (
          <></>
        )}

        {!successState && (
          <>
            <div
              className="processing-page__tablist"
              role="tablist"
              aria-label="Tipo de entrada"
              aria-orientation="horizontal"
              onKeyDown={handleTablistKeyDown}
            >
              {[
                {
                  mode: "file" as const,
                  label: "Archivo",
                  Icon: FileUploadIcon,
                  ref: tabFileRef,
                },
                {
                  mode: "text" as const,
                  label: "Texto",
                  Icon: DescriptionOutlinedIcon,
                  ref: tabTextRef,
                },
              ].map(({ mode, label, Icon, ref }) => {
                const isActive = inputMode === mode;
                return (
                  <button
                    key={mode}
                    ref={ref}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`${mode}-panel`}
                    id={`${mode}-tab`}
                    tabIndex={isActive ? 0 : -1}
                    disabled={isProcessing}
                    onClick={() => changeMode(mode)}
                    className={[
                      "processing-page__tab",
                      isActive ? "processing-page__tab--active" : "",
                    ].join(" ")}
                  >
                    <Icon sx={{ fontSize: 14 }} aria-hidden="true" />
                    {label}
                    {isActive && (
                      <span
                        className="processing-page__tab-underline"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {inputMode === "file" && selectedFile === null && (
              <section
                id="file-panel"
                role="tabpanel"
                aria-labelledby="file-tab"
                aria-busy={isProcessing}
                className="processing-page__card"
                style={{ padding: 24, maxWidth: 896, margin: "0 auto" }}
              >
                <div>
                  <span className="processing-page__field-label--inline">
                    Documento{" "}
                    <span className="processing-page__required">*</span>
                  </span>
                </div>
                <div
                  className={[
                    "processing-page__upload-drop",
                    isDragOver ? "processing-page__upload-drop--drag" : "",
                  ].join(" ")}
                  onClick={() => {
                    if (isProcessing) return;
                    openPicker();
                  }}
                  onDragOver={(event) => {
                    if (isProcessing) return;
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <UploadEmptyStateIllustration />
                  <p className="processing-page__upload-label">
                    Agregue un archivo para previsualizarlo aquí
                  </p>
                  <p className="processing-page__upload-sub">PDF, JPG o PNG</p>
                  <button
                    ref={uploadPickerRef}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openPicker();
                    }}
                    className="processing-page__upload-picker-btn"
                  >
                    <span aria-hidden="true">+</span>
                    Seleccionar archivo
                  </button>
                </div>
                {fileError && (
                  <p className="processing-page__file-field-error" role="alert">
                    {fileError}
                  </p>
                )}

                <div className="processing-page__origin-wrap">
                  <OriginFields
                    originId={originIdFile}
                    originChannel={originChannel}
                    originOtro={originOtro}
                    disabled={isProcessing}
                    fieldError={originFieldError}
                    onChannelChange={(value) => {
                      setOriginChannel(value);
                      setOriginOtro("");
                      setOriginFieldError(null);
                    }}
                    onOtherChange={(value) => {
                      setOriginOtro(value);
                      setOriginFieldError(null);
                    }}
                  />
                </div>

                <div className="processing-page__divider--actions">
                  {actionsBlock}
                  {formError && (
                    <p
                      className="processing-page__file-field-error"
                      role="alert"
                      style={{ marginTop: 10 }}
                    >
                      {formError}
                    </p>
                  )}
                </div>
              </section>
            )}

            {inputMode === "file" && selectedFile !== null && (
              <div
                id="file-panel"
                role="tabpanel"
                aria-labelledby="file-tab"
                className="processing-page__grid"
              >
                <div className="processing-page__grid-col processing-page__grid-col--config">
                  <section
                    aria-busy={isProcessing}
                    className="processing-page__config-panel"
                  >
                    <div
                      className="processing-page__section-header"
                      style={{ height: 36 }}
                    >
                      Configuración del procesamiento
                    </div>
                    <div className="processing-page__config-body">
                      <div>
                        <p
                          style={{
                            margin: "0 0 12px 0",
                            fontSize: 14,
                            lineHeight: "22px",
                            color: "var(--proc-text)",
                          }}
                        >
                          Archivo seleccionado
                        </p>
                        <div className="processing-page__file-info-card">
                          <div className="processing-page__file-info-row">
                            <span className="processing-page__file-type-badge">
                              {fileType(selectedFile)}
                            </span>
                            <div className="processing-page__file-info-meta">
                              <p className="processing-page__file-info-name">
                                {selectedFile.name}
                              </p>
                              <p className="processing-page__file-info-sub">
                                {fileType(selectedFile)} ·{" "}
                                {formatBytes(selectedFile.size)}
                              </p>
                            </div>
                          </div>
                          <div className="processing-page__file-info-actions">
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={openPicker}
                              className="processing-page__link-btn processing-page__link-btn--primary"
                            >
                              Cambiar archivo
                            </button>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => {
                                setSelectedFile(null);
                                setFileError(null);
                                setProcessingError(false);
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = "";
                                }
                              }}
                              className="processing-page__link-btn processing-page__link-btn--muted"
                            >
                              Quitar archivo
                            </button>
                          </div>
                        </div>
                      </div>

                      <hr className="processing-page__divider" />

                      <OriginFields
                        originId={originIdFile}
                        originChannel={originChannel}
                        originOtro={originOtro}
                        disabled={isProcessing}
                        fieldError={originFieldError}
                        onChannelChange={(value) => {
                          setOriginChannel(value);
                          setOriginOtro("");
                          setOriginFieldError(null);
                          setProcessingError(false);
                        }}
                        onOtherChange={(value) => {
                          setOriginOtro(value);
                          setOriginFieldError(null);
                          setProcessingError(false);
                        }}
                      />

                      {selectedFile && hasOrigin && !processingError && (
                        <div className="processing-page__status-chip">
                          <span className="processing-page__status-chip-label">
                            Estado
                          </span>
                          <span className="processing-page__status-chip-value">
                            <span className="processing-page__status-dot" />
                            Listo para procesar
                          </span>
                        </div>
                      )}

                      {processingError && (
                        <div
                          className="processing-page__inline-error"
                          role="alert"
                        >
                          <WarningIcon />
                          <div>
                            <p className="processing-page__inline-error-title">
                              No fue posible procesar el documento
                            </p>
                            <p className="processing-page__inline-error-body">
                              Conservamos la información ingresada. Intente
                              nuevamente.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="processing-page__config-footer">
                      {actionsBlock}
                    </div>
                  </section>
                </div>

                <div className="processing-page__grid-col processing-page__grid-col--viewer">
                  <section className="processing-page__viewer-panel">
                    <div className="processing-page__viewer-header">
                      <h2 className="processing-page__viewer-title">
                        Documento
                      </h2>
                      <span
                        className="processing-page__viewer-filename"
                        title={selectedFile.name}
                      >
                        {selectedFile.name}
                      </span>
                    </div>
                    <div className="processing-page__viewer-body">
                      {previewDocument ? (
                        <DocumentViewer
                          document={previewDocument}
                          ariaLabel="Vista previa del documento seleccionado"
                          className="processing-page__viewer-body"
                        />
                      ) : (
                        <Box
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <CircularProgress aria-label="Cargando vista previa" />
                        </Box>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {inputMode === "text" && (
              <section
                id="text-panel"
                role="tabpanel"
                aria-labelledby="text-tab"
                aria-busy={isProcessing}
                className="processing-page__card"
                style={{ padding: 24, maxWidth: 896, margin: "0 auto" }}
              >
                <div>
                  <label
                    htmlFor={textareaId}
                    className="processing-page__field-label"
                  >
                    Texto del documento{" "}
                    <span className="processing-page__required">*</span>
                  </label>
                  <textarea
                    ref={textareaRef}
                    id={textareaId}
                    value={documentText}
                    onChange={(event) => {
                      setDocumentText(event.target.value);
                      setTextFieldError(null);
                      setProcessingError(false);
                    }}
                    placeholder="Ingrese o pegue el contenido clínico aquí."
                    disabled={isProcessing}
                    aria-invalid={Boolean(textFieldError)}
                    aria-describedby={
                      textFieldError ? `${textareaId}-err` : undefined
                    }
                    className="processing-page__textarea"
                  />
                  {textFieldError && (
                    <p
                      id={`${textareaId}-err`}
                      className="processing-page__file-field-error"
                      role="alert"
                    >
                      {textFieldError}
                    </p>
                  )}
                </div>

                <div className="processing-page__origin-wrap">
                  <OriginFields
                    originId={originIdText}
                    originChannel={originChannel}
                    originOtro={originOtro}
                    disabled={isProcessing}
                    fieldError={originFieldError}
                    onChannelChange={(value) => {
                      setOriginChannel(value);
                      setOriginOtro("");
                      setOriginFieldError(null);
                      setProcessingError(false);
                    }}
                    onOtherChange={(value) => {
                      setOriginOtro(value);
                      setOriginFieldError(null);
                      setProcessingError(false);
                    }}
                  />
                </div>

                {documentText.trim().length > 0 &&
                  hasOrigin &&
                  !processingError && (
                    <div className="processing-page__status-chip">
                      <span className="processing-page__status-chip-label">
                        Estado
                      </span>
                      <span className="processing-page__status-chip-value">
                        <span className="processing-page__status-dot" />
                        Listo para procesar
                      </span>
                    </div>
                  )}

                {processingError && (
                  <div
                    className="processing-page__inline-error--text"
                    role="alert"
                  >
                    No fue posible procesar el texto. La información ingresada
                    se ha conservado.
                  </div>
                )}

                <div className="processing-page__divider--actions">
                  {actionsBlock}
                  {formError && (
                    <p
                      className="processing-page__file-field-error"
                      role="alert"
                      style={{ marginTop: 10 }}
                    >
                      {formError}
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

export default ProcessingPage;
