import { useEffect, useRef, useState } from "react";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import PdfDocument from "./PdfDocument";
import { IMAGE_ZOOM_LEVELS, imageDisplaySize, nextImageZoomIndex } from "./imageZoom";
import type { DocumentViewerProps } from "./types";
import { ZoomViewerIcon } from "./ViewerIcons";
import "../../styles/document-viewer.css";

type ImageDocumentProps = {
  blob: Blob;
  fileName?: string;
};

function ImageDocument({ blob, fileName }: ImageDocumentProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [loadState, setLoadState] = useState<{
    blob: Blob;
    status: "loading" | "ready" | "error";
    natural?: { width: number; height: number };
  }>({ blob, status: "loading" });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [zoomIndex, setZoomIndex] = useState(0);
  const status = loadState.blob === blob ? loadState.status : "loading";
  const zoom = IMAGE_ZOOM_LEVELS[zoomIndex];
  const displaySize = status === "ready" && loadState.natural
    ? imageDisplaySize(loadState.natural, stageSize, zoom) : null;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateSize = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const url = URL.createObjectURL(blob);
    const onLoad = () => {
      if (image.src === url) {
        setZoomIndex(0);
        if (stageRef.current) { stageRef.current.scrollLeft = 0; stageRef.current.scrollTop = 0; }
        setLoadState({ blob, status: "ready", natural: { width: image.naturalWidth, height: image.naturalHeight } });
      }
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

  const resetZoom = () => {
    setZoomIndex(0);
    if (stageRef.current) { stageRef.current.scrollLeft = 0; stageRef.current.scrollTop = 0; }
  };

  return (
    <Box className="document-viewer__image-viewer">
      <div className="document-viewer__image-toolbar" role="group" aria-label="Zoom de imagen">
        <button type="button" className="document-viewer__image-tool" aria-label="Alejar imagen"
          disabled={status !== "ready" || zoomIndex === 0}
          onClick={() => setZoomIndex((index) => nextImageZoomIndex(index, -1))}>
          <ZoomViewerIcon type="minus" />
        </button>
        <output className="document-viewer__image-zoom-value" aria-live="polite" aria-atomic="true">
          {zoomIndex === 0 ? "Ajustada" : `${Math.round(zoom * 100)} %`}
        </output>
        <button type="button" className="document-viewer__image-tool" aria-label="Acercar imagen"
          disabled={status !== "ready" || zoomIndex === IMAGE_ZOOM_LEVELS.length - 1}
          onClick={() => setZoomIndex((index) => nextImageZoomIndex(index, 1))}>
          <ZoomViewerIcon type="plus" />
        </button>
        <button type="button" className="document-viewer__image-reset"
          aria-label="Restablecer ajuste de imagen" disabled={status !== "ready" || zoomIndex === 0}
          onClick={resetZoom}>Ajustar</button>
      </div>
      <div ref={stageRef} className="document-viewer__image-stage" role="region"
        aria-label="Imagen del documento; use las flechas para desplazarse al ampliar" tabIndex={status === "ready" ? 0 : -1}>
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
          style={displaySize ? { width: displaySize.width, height: displaySize.height } : undefined}
          hidden={status !== "ready" || !displaySize}
        />
      </div>
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
      {document.status === "text" && (
        <div className="document-viewer__text-stage">
          <p className="document-viewer__text">{document.text}</p>
        </div>
      )}
    </Box>
  );
}

export default DocumentViewer;
export type { DocumentViewerProps, DocumentViewerState, ViewerMimeType } from "./types";
