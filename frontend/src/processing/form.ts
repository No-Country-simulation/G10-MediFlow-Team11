export const ALLOWED_FILE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ACCEPTED_FILE_EXTENSIONS = ".pdf,.jpg,.jpeg,.png";

export const ORIGIN_CHANNELS = [
  "Consulta Externa",
  "Hospitalización",
  "Guardia / Emergencias",
  "Portal de Pacientes",
  "Farmacia",
  "Laboratorio",
] as const;

export type OriginChannel = (typeof ORIGIN_CHANNELS)[number];

export type FileKind = "PDF" | "JPG" | "PNG";

export type FileValidationResult =
  | { ok: true; kind: FileKind }
  | { ok: false; message: string };

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;

function getExtension(fileName: string): string {
  const separator = fileName.lastIndexOf(".");

  if (separator < 0) {
    return "";
  }

  return fileName.slice(separator + 1).toLowerCase();
}

export function getFileKind(file: File): FileKind | null {
  const extension = getExtension(file.name);

  if (file.type === "application/pdf" || extension === "pdf") {
    return "PDF";
  }

  if (file.type === "image/jpeg" || extension === "jpg" || extension === "jpeg") {
    return "JPG";
  }

  if (file.type === "image/png" || extension === "png") {
    return "PNG";
  }

  return null;
}

export function isAllowedFile(file: File): boolean {
  return getFileKind(file) !== null;
}

export function validateSelectedFile(file: File): FileValidationResult {
  const kind = getFileKind(file);

  if (!kind) {
    return {
      ok: false,
      message: "Formato no admitido. Selecciona un archivo PDF, JPG o PNG.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      message: "El archivo no puede superar los 10 MB.",
    };
  }

  return { ok: true, kind };
}

export function hasProcessableText(text: string): boolean {
  return text.trim().length > 0;
}

export function hasOriginChannel(channel: string): boolean {
  return channel.trim().length > 0;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPdfFile(file: File): boolean {
  return getFileKind(file) === "PDF";
}

export function isImageFile(file: File): boolean {
  const kind = getFileKind(file);
  return kind === "JPG" || kind === "PNG";
}

export { ALLOWED_EXTENSIONS };
