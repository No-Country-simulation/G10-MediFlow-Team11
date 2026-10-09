import { useEffect, useRef, useState } from "react";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import PdfDocument from "./PdfDocument";
import type { DocumentViewerProps } from "./types";
import "../../styles/document-viewer.css";

type ImageDocumentProps = {
  blob: Blob;
  fileName?: string;
};

function ImageDocument({ blob, fileName }: ImageDocumentProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadState, setLoadState] = useState<{
    blob: Blob;
    status: "loading" | "ready" | "error";
  }>({ blob, status: "loading" });
  const status = loadState.blob === blob ? loadState.status : "loading";

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const url = URL.createObjectURL(blob);
    const onLoad = () => {
      if (image.src === url) setLoadState({ blob, status: "ready" });
    };
    const onError = () => {
      if (image.src === url) setLoadState({ blob, status: "error" });
    };
    image.addEventListener("load", onLoad);
    image.addEventListener("error", onError);
    image.src = url;

    return () => {
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  return (
    <Box className="document-viewer__image-stage">
      {status === "loading" && (
        <Box className="document-viewer__message" role="status">
          <CircularProgress size={24} aria-hidden="true" />
          <Typography>Cargando imagen…</Typography>
        </Box>
      )}
      {status === "error" && (
        <Alert severity="error">No se pudo mostrar la imagen.</Alert>
      )}
      <img
        ref={imageRef}
        alt={fileName || "Documento"}
        className="document-viewer__image"
        hidden={status !== "ready"}
      />
    </Box>
  );
}

function DocumentViewer({ document, ariaLabel, className }: DocumentViewerProps) {
  return (
    <Box
      component="section"
      role="region"
      aria-label={ariaLabel}
      className={["document-viewer", className].filter(Boolean).join(" ")}
    >
      {document.status === "loading" && (
        <Box className="document-viewer__message" role="status">
          <CircularProgress size={24} aria-hidden="true" />
          <Typography>Cargando documento…</Typography>
        </Box>
      )}
      {document.status === "unavailable" && (
        <Box className="document-viewer__message" role="status">
          <Typography>El contenido del documento no está disponible.</Typography>
        </Box>
      )}
      {document.status === "error" && (
        <Alert severity="error">
          {document.message || "No se pudo cargar el documento."}
        </Alert>
      )}
      {document.status === "ready" &&
        (document.mimeType === "application/pdf" ? (
          <PdfDocument
            key={document.documentKey}
            blob={document.blob}
            title={document.fileName ? `Visor PDF: ${document.fileName}` : "Visor PDF"}
            fileName={document.fileName}
          />
        ) : (
          <ImageDocument
            key={document.documentKey}
            blob={document.blob}
            fileName={document.fileName}
          />
        ))}
    </Box>
  );
}

export default DocumentViewer;
export type { DocumentViewerProps, DocumentViewerState, ViewerMimeType } from "./types";
