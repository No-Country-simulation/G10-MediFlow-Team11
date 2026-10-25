import type { ViewerMimeType } from "../components/DocumentViewer/types";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const OTHER_CHANNEL = "Otro";

export const ORIGIN_CHANNELS = [
  "Guardia de Emergencias",
  "Consulta Externa",
  "Hospitalización",
  "Laboratorio",
  "Referencia Externa",
  OTHER_CHANNEL,
] as const;

export const FILE_ERROR_MESSAGES = {
  unsupportedFormat: "Formato no admitido. Seleccione un archivo PDF, JPG o PNG.",
  emptyFile: "El archivo está vacío. Seleccione un documento con contenido.",
  tooLarge: "El archivo no puede superar los 10 MB.",
} as const;

type FileLike = Pick<File, "name" | "type" | "size">;

const MIME_BY_EXTENSION: Record<string, ViewerMimeType> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const FILE_TYPE_LABELS: Record<ViewerMimeType, "PDF" | "PNG" | "JPG"> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
};

function isViewerMimeType(value: string): value is ViewerMimeType {
  return value in FILE_TYPE_LABELS;
}

export function getFileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index).toLowerCase();
}

export function normalizeViewerMimeType(
  file: Pick<File, "name" | "type">,
): ViewerMimeType | null {
  if (isViewerMimeType(file.type)) return file.type;
  return MIME_BY_EXTENSION[getFileExtension(file.name)] ?? null;
}

export function validateProcessingFile(file: FileLike): string | null {
  if (normalizeViewerMimeType(file) === null) {
    return FILE_ERROR_MESSAGES.unsupportedFormat;
  }
  if (file.size === 0) return FILE_ERROR_MESSAGES.emptyFile;
  if (file.size > MAX_FILE_SIZE) return FILE_ERROR_MESSAGES.tooLarge;
  return null;
}

export function getFileTypeLabel(mimeType: ViewerMimeType): "PDF" | "PNG" | "JPG" {
  return FILE_TYPE_LABELS[mimeType];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function resolveOriginChannel(channel: string, otherChannel: string): string {
  return channel === OTHER_CHANNEL ? otherChannel.trim() : channel;
}

export function isOtherChannelMissing(channel: string, otherChannel: string): boolean {
  return channel === OTHER_CHANNEL && otherChannel.trim().length === 0;
}

export function hasOriginChannel(channel: string, otherChannel: string): boolean {
  return channel !== "" && !isOtherChannelMissing(channel, otherChannel);
}

export type OriginErrorTarget = "select" | "other" | null;

export function getOriginErrorTarget(
  hasError: boolean,
  channel: string,
  otherChannel: string,
): OriginErrorTarget {
  if (!hasError) return null;
  return isOtherChannelMissing(channel, otherChannel) ? "other" : "select";
}
