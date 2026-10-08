export type ViewerMimeType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

export type DocumentViewerState =
  | { status: "loading"; documentKey: string }
  | { status: "unavailable"; documentKey: string }
  | { status: "error"; documentKey: string; message?: string }
  | {
      status: "ready";
      documentKey: string;
      blob: Blob;
      mimeType: ViewerMimeType;
      fileName?: string;
    };

export type DocumentViewerProps = {
  document: DocumentViewerState;
  ariaLabel: string;
  className?: string;
};
