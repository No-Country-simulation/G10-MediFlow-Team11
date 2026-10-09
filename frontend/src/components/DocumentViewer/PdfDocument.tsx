import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ComponentType, Ref } from "react";
import { Alert, CircularProgress } from "@mui/material";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ArrowViewerIcon, AttachmentViewerIcon, BookmarkViewerIcon, DownloadViewerIcon,
  FullScreenViewerIcon, MoreViewerIcon, PrintViewerIcon, SearchViewerIcon,
  ThemeViewerIcon, ThumbnailViewerIcon, ZoomViewerIcon,
} from "./ViewerIcons";

GlobalWorkerOptions.workerSrc = workerUrl;

type PdfDocumentProps = { blob: Blob; title: string; fileName?: string };
type PageSize = { width: number; height: number };
type Load =
  | { blob: Blob; status: "loading" | "error" }
  | { blob: Blob; status: "ready"; pdf: PDFDocumentProxy; pages: PageSize[] };
type ZoomMode = "fixed" | "fit-width" | "fit-page";
type Action = { label: string; icon: ComponentType; onClick?: () => void; disabled?: boolean };
type MenuAction = { key: string; label: string; icon: ComponentType; disabled?: boolean };
const zoomSteps = [50, 75, 100, 125, 130, 150, 200, 300, 400];
const zoomOptions = [
  ["actual", "Tamaño real"], ["page", "Ajustar a la página"],
  ["width", "Ajustar al ancho"], ...zoomSteps
    .map((step) => [String(step), String(step) + " %"]),
];

function ToolButton({ label, icon: Icon, onClick, disabled, active, className = "", buttonRef, expanded, controls }:
  Action & { active?: boolean; className?: string; buttonRef?: Ref<HTMLButtonElement>; expanded?: boolean; controls?: string }) {
  return <span className={"document-viewer__tool-wrap " + className}>
    <button ref={buttonRef} type="button" className="document-viewer__tool" aria-label={label}
      aria-pressed={active} aria-expanded={expanded} aria-controls={controls}
      disabled={disabled} onClick={onClick}><Icon /></button>
    <span className="document-viewer__tooltip" role="tooltip">{label}</span>
  </span>;
}

function PdfCanvas({ pdf, pageNumber, scale, root, onError }: {
  pdf: PDFDocumentProxy; pageNumber: number; scale: number;
  root: React.RefObject<HTMLDivElement | null>; onError: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !root.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting),
      { root: root.current, rootMargin: "500px" });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [root]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    canvas.width = 0;
    canvas.height = 0;
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
    void pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = String(viewport.width) + "px";
      canvas.style.height = String(viewport.height) + "px";
      task = page.render({ canvas, viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      return task.promise;
    }).catch((error: unknown) => {
      if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) onError();
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, pageNumber, scale, visible, onError]);
  return <canvas ref={canvasRef} className="document-viewer__page-canvas" aria-hidden="true" />;
}

function PdfDocument({ blob, title, fileName }: PdfDocumentProps) {
  const zoomMenuId = useId();
  const moreMenuId = useId();
  const searchPopoverId = useId();
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const zoomTriggerRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [load, setLoad] = useState<Load>({ blob, status: "loading" });
  const sourceUrlRef = useRef<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [viewerWidth, setViewerWidth] = useState(0);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fixed");
  const [zoomPercent, setZoomPercent] = useState(130);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWords, setWholeWords] = useState(false);
  const [matches, setMatches] = useState<number[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const handleRenderError = useCallback(() => setRenderError(true), []);
  const [userZoomed, setUserZoomed] = useState(false);
  const [actualSizeSelected, setActualSizeSelected] = useState(false);
  const status = load.blob === blob ? load.status : "loading";
  const pdf = load.blob === blob && load.status === "ready" ? load.pdf : null;
  const pages = load.blob === blob && load.status === "ready" ? load.pages : [];
  const totalPages = pages.length;
  const compactToolbar = viewerWidth > 0 && viewerWidth <= 400;
  const secondaryHidden = viewerWidth > 0 && viewerWidth < 560;
  const compactChrome = viewerWidth > 0 && viewerWidth < 760;
  const firstPage = pages[0];
  const fitWidth = firstPage && canvasSize.width ? Math.max(1, (canvasSize.width - 16) / firstPage.width * 100) : 130;
  const fitPage = firstPage && canvasSize.width && canvasSize.height
    ? Math.max(1, Math.min((canvasSize.width - 16) / firstPage.width, (canvasSize.height - 16) / firstPage.height) * 100)
    : 130;
  const effectiveZoom = zoomMode === "fit-width" || (zoomMode === "fixed" && !userZoomed && fitWidth < 130)
    ? fitWidth : zoomMode === "fit-page" ? fitPage : zoomPercent;

  useEffect(() => {
    if (blob.size === 0) return;
    let cancelled = false;
    let loadingTask: ReturnType<typeof getDocument> | undefined;
    void blob.arrayBuffer().then(async (buffer) => {
      if (cancelled) return;
      loadingTask = getDocument({ data: new Uint8Array(buffer) });
      const document = await loadingTask.promise;
      if (cancelled) return;
      const sizes = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
        const pdfPage = await document.getPage(index + 1);
        const viewport = pdfPage.getViewport({ scale: 1 });
        return { width: viewport.width, height: viewport.height };
      }));
      if (!cancelled) {
        setPage(1);
        setPageInput("1");
        setMatches([]);
        setMatchIndex(0);
        setThumbnailsOpen(false);
        setUserZoomed(false);
        setActualSizeSelected(false);
        setZoomMode("fixed");
        setZoomPercent(130);
        setRenderError(false);
        setLoad({ blob, status: "ready", pdf: document, pages: sizes });
      }
    }).catch(() => { if (!cancelled) setLoad({ blob, status: "error" }); });
    return () => { cancelled = true; void loadingTask?.destroy(); };
  }, [blob]);

  useEffect(() => {
    if (blob.size === 0) return;
    const url = URL.createObjectURL(blob);
    sourceUrlRef.current = url;
    return () => { sourceUrlRef.current = null; URL.revokeObjectURL(url); };
  }, [blob]);

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const update = () => {
      setViewerWidth(viewer.clientWidth);
      if (viewer.clientWidth >= 760) setMoreMenuOpen(false);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewer);
    return () => observer.disconnect();
  }, [status]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => setCanvasSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [status]);

  useEffect(() => {
    if (!pdf || !searchQuery.trim()) return;
    let cancelled = false;
    const query = matchCase ? searchQuery.trim() : searchQuery.trim().toLocaleLowerCase();
    void Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
      const pdfPage = await pdf.getPage(index + 1);
      const content = await pdfPage.getTextContent();
      const rawText = content.items.map((item) => "str" in item ? item.str : "").join(" ");
      const text = matchCase ? rawText : rawText.toLocaleLowerCase();
      const found: number[] = [];
      let position = 0;
      while ((position = text.indexOf(query, position)) !== -1) {
        const before = text[position - 1];
        const after = text[position + query.length];
        const matchesWord = !wholeWords ||
          ((!before || !/[\p{L}\p{N}]/u.test(before)) && (!after || !/[\p{L}\p{N}]/u.test(after)));
        if (matchesWord) {
          found.push(index + 1);
          break;
        }
        position += query.length;
      }
      return found;
    })).then((found) => {
      if (cancelled) return;
      const nextMatches = found.flat();
      setMatches(nextMatches);
      setMatchIndex(0);
    }).catch(() => { if (!cancelled) setMatches([]); });
    return () => { cancelled = true; };
  }, [pdf, searchQuery, matchCase, wholeWords]);

  useEffect(() => {
    if (!zoomMenuOpen && !moreMenuOpen && !searchOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (searchOpen) {
        (compactToolbar ? moreTriggerRef : searchTriggerRef).current?.focus();
      } else if (zoomMenuOpen) {
        zoomTriggerRef.current?.focus();
      } else if (moreMenuOpen) {
        moreTriggerRef.current?.focus();
      }
      setZoomMenuOpen(false); setMoreMenuOpen(false); setSearchOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (viewerRef.current && !viewerRef.current.contains(event.target as Node)) {
        setZoomMenuOpen(false); setMoreMenuOpen(false); setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [zoomMenuOpen, moreMenuOpen, searchOpen, compactToolbar]);

  useEffect(() => {
    if (zoomMenuOpen) zoomMenuRef.current?.querySelector("button")?.focus();
  }, [zoomMenuOpen]);

  useEffect(() => {
    if (moreMenuOpen) moreMenuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [moreMenuOpen]);

  const goToPage = (number: number) => {
    const next = Math.max(1, Math.min(totalPages, number));
    setPage(next); setPageInput(String(next));
    canvasRef.current?.scrollTo({ top: pageRefs.current[next - 1]?.offsetTop ?? 0 });
  };
  const commitPage = () => {
    const requested = Number(pageInput);
    if (Number.isInteger(requested) && requested >= 1 && requested <= totalPages) goToPage(requested);
    else setPageInput(String(page));
  };
  const changeZoom = (direction: -1 | 1) => {
    const next = direction < 0
      ? [...zoomSteps].reverse().find((value) => value < effectiveZoom) ?? zoomSteps[0]
      : zoomSteps.find((value) => value > effectiveZoom) ?? zoomSteps[zoomSteps.length - 1];
    setUserZoomed(true); setZoomMode("fixed"); setZoomPercent(next);
    setActualSizeSelected(false);
  };
  const onCanvasScroll = () => {
    const canvas = canvasRef.current;
    if (!canvas || !totalPages) return;
    const center = canvas.scrollTop + canvas.clientHeight / 2;
    let nearest = 0; let distance = Infinity;
    pageRefs.current.forEach((element, index) => {
      if (!element) return;
      const difference = Math.abs(element.offsetTop + element.offsetHeight / 2 - center);
      if (difference < distance) { nearest = index; distance = difference; }
    });
    if (nearest + 1 !== page) { setPage(nearest + 1); setPageInput(String(nearest + 1)); }
  };
  const selectZoom = (value: string) => {
    setUserZoomed(true);
    setActualSizeSelected(value === "actual");
    if (value === "page") setZoomMode("fit-page");
    else if (value === "width") setZoomMode("fit-width");
    else { setZoomMode("fixed"); setZoomPercent(value === "actual" ? 100 : Number(value)); }
    setZoomMenuOpen(false);
  };
  const nextMatch = () => {
    if (!matches.length) return;
    const next = matchIndex >= matches.length ? 1 : matchIndex + 1;
    setMatchIndex(next); goToPage(matches[next - 1]);
  };
  const actions: MenuAction[] = [
    { key: "search", label: "Buscar en el documento", icon: SearchViewerIcon },
    { key: "zoom-out", label: "Reducir zoom", icon: () => <ZoomViewerIcon type="minus" /> },
    { key: "zoom-in", label: "Aumentar zoom", icon: () => <ZoomViewerIcon type="plus" /> },
    { key: "thumbnails", label: "Miniaturas", icon: ThumbnailViewerIcon },
    { key: "bookmarks", label: "Marcadores", icon: BookmarkViewerIcon, disabled: true },
    { key: "attachments", label: "Adjuntos", icon: AttachmentViewerIcon, disabled: true },
    { key: "theme", label: dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro", icon: ThemeViewerIcon },
    { key: "fullscreen", label: "Pantalla completa", icon: FullScreenViewerIcon },
    { key: "download", label: "Descargar", icon: DownloadViewerIcon },
    { key: "print", label: "Abrir PDF para imprimir", icon: PrintViewerIcon },
  ];
  const overflowActions = actions.filter((action) =>
    (compactToolbar && ["search", "zoom-out", "zoom-in"].includes(action.key)) ||
    (compactChrome && ["thumbnails", "bookmarks", "attachments"].includes(action.key)) ||
    (secondaryHidden && ["theme", "fullscreen", "download", "print"].includes(action.key)));
  const handleAction = (key: string) => {
    if (key === "search") { setSearchOpen(true); requestAnimationFrame(() => searchRef.current?.focus()); }
    if (key === "zoom-out") changeZoom(-1);
    if (key === "zoom-in") changeZoom(1);
    if (key === "thumbnails") setThumbnailsOpen((open) => !open);
    if (key === "theme") setDark((value) => !value);
    if (key === "fullscreen") {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      else void viewerRef.current?.requestFullscreen().catch(() => undefined);
    }
    if (key === "download" && sourceUrlRef.current) {
      const link = document.createElement("a");
      link.href = sourceUrlRef.current; link.download = fileName || "documento.pdf"; link.click();
    }
    if (key === "print" && sourceUrlRef.current) window.open(sourceUrlRef.current, "_blank", "noopener,noreferrer");
  };

  if (status === "loading" && blob.size > 0) return <div className="document-viewer__message" role="status"><CircularProgress size={24} />Cargando PDF…</div>;
  if (status === "error" || blob.size === 0 || renderError || !pdf) return <Alert severity="error">No se pudo mostrar el PDF.</Alert>;
  return <div ref={viewerRef} className={"document-viewer__pdf-viewer" + (dark ? " document-viewer__pdf-viewer--dark" : "")} aria-label={title}>
    <div className="document-viewer__toolbar">
      <div className="document-viewer__toolbar-start">
        <ToolButton label="Buscar en el documento" icon={SearchViewerIcon} className="document-viewer__search-button" buttonRef={searchTriggerRef} expanded={searchOpen} controls={searchOpen ? searchPopoverId : undefined} onClick={() => { setSearchOpen((open) => !open); requestAnimationFrame(() => searchRef.current?.focus()); }} />
        <ToolButton label="Página anterior" icon={() => <ArrowViewerIcon direction="up" />} disabled={page === 1} onClick={() => goToPage(page - 1)} />
        <div className="document-viewer__page-control">
          <input aria-label="Página actual" inputMode="numeric" value={pageInput} onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))} onBlur={commitPage} onKeyDown={(event) => { if (event.key === "Enter") { commitPage(); event.currentTarget.blur(); } }} />
          <span>/ {totalPages}</span>
        </div>
        <ToolButton label="Página siguiente" icon={() => <ArrowViewerIcon direction="down" />} disabled={page === totalPages} onClick={() => goToPage(page + 1)} />
      </div>
      <div className="document-viewer__toolbar-zoom">
        <ToolButton label="Reducir zoom" icon={() => <ZoomViewerIcon type="minus" />} className="document-viewer__zoom-step" onClick={() => changeZoom(-1)} />
        <button ref={zoomTriggerRef} type="button" className="document-viewer__zoom-selector" aria-label="Seleccionar escala del documento" aria-expanded={zoomMenuOpen} aria-controls={zoomMenuOpen ? zoomMenuId : undefined} onClick={() => setZoomMenuOpen((open) => !open)}>{Math.round(effectiveZoom)}% <span aria-hidden="true">▾</span></button>
        <ToolButton label="Aumentar zoom" icon={() => <ZoomViewerIcon type="plus" />} className="document-viewer__zoom-step" onClick={() => changeZoom(1)} />
      </div>
      <div className="document-viewer__toolbar-end">
        <span className="document-viewer__secondary-actions">{actions.slice(6).map((action) => <ToolButton key={action.key} label={action.label} icon={action.icon} onClick={() => handleAction(action.key)} />)}</span>
        {overflowActions.length > 0 && <ToolButton label="Más acciones" icon={MoreViewerIcon} buttonRef={moreTriggerRef} expanded={moreMenuOpen} controls={moreMenuOpen ? moreMenuId : undefined} onClick={() => setMoreMenuOpen((open) => !open)} />}
      </div>
      {zoomMenuOpen && <div ref={zoomMenuRef} id={zoomMenuId} className="document-viewer__zoom-menu" role="group" aria-label="Escala del documento">
        {zoomOptions.map(([value, label]) => <button key={value} type="button" aria-pressed={(value === "page" && zoomMode === "fit-page") || (value === "width" && zoomMode === "fit-width") || (value === "actual" && zoomMode === "fixed" && actualSizeSelected) || (zoomMode === "fixed" && !actualSizeSelected && (userZoomed || fitWidth >= 130) && value === String(zoomPercent))} onClick={() => { selectZoom(value); requestAnimationFrame(() => zoomTriggerRef.current?.focus()); }}>{label}</button>)}
      </div>}
      {moreMenuOpen && <div ref={moreMenuRef} id={moreMenuId} className="document-viewer__more-menu" role="group" aria-label="Más acciones">
        {overflowActions.map((action) => { const Icon = action.icon; return <button key={action.key} type="button" disabled={action.disabled} onClick={() => { handleAction(action.key); setMoreMenuOpen(false); if (action.key !== "search") requestAnimationFrame(() => moreTriggerRef.current?.focus()); }}><Icon />{action.label}</button>; })}
      </div>}
      {searchOpen && <div id={searchPopoverId} className="document-viewer__search-popover" role="group" aria-label="Buscar en el documento">
        <div className="document-viewer__search-input"><input ref={searchRef} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setMatches([]); setMatchIndex(0); }} placeholder="Escribir para buscar" aria-label="Buscar en el documento" onKeyDown={(event) => { if (event.key === "Enter") nextMatch(); }} /><span className="document-viewer__search-count">{matchIndex ? String(matchIndex) + "/" + String(matches.length) : String(matches.length) + (matches.length === 1 ? " resultado" : " resultados")}</span></div>
        <label><input type="checkbox" checked={matchCase} onChange={(event) => { setMatchCase(event.target.checked); setMatches([]); setMatchIndex(0); }} />Coincidir mayúsculas</label>
        <label><input type="checkbox" checked={wholeWords} onChange={(event) => { setWholeWords(event.target.checked); setMatches([]); setMatchIndex(0); }} />Palabras completas</label>
        <button type="button" disabled={!searchQuery.trim() || !matches.length} onClick={nextMatch}>Buscar</button>
      </div>}
    </div>
    <div className="document-viewer__body">
      <div className="document-viewer__rail">
        <ToolButton label="Miniaturas" icon={ThumbnailViewerIcon} active={thumbnailsOpen} onClick={() => setThumbnailsOpen((open) => !open)} />
        <ToolButton label="Marcadores" icon={BookmarkViewerIcon} disabled />
        <ToolButton label="Adjuntos" icon={AttachmentViewerIcon} disabled />
      </div>
      <div className={"document-viewer__thumbnails" + (thumbnailsOpen ? " document-viewer__thumbnails--open" : "")} aria-hidden={!thumbnailsOpen}>
        <div ref={thumbnailsRef} className="document-viewer__thumbnail-list">{pages.map((size, index) => <button key={index} type="button" tabIndex={thumbnailsOpen ? 0 : -1} aria-current={page === index + 1 ? "page" : undefined} className={"document-viewer__thumbnail" + (page === index + 1 ? " document-viewer__thumbnail--active" : "")} onClick={() => goToPage(index + 1)}>
          <span className="document-viewer__thumbnail-sheet" style={{ width: 100, height: 100 * size.height / size.width }}><PdfCanvas pdf={pdf} pageNumber={index + 1} scale={100 / size.width} root={thumbnailsRef} onError={handleRenderError} /></span><span>Página {index + 1}</span>
        </button>)}</div>
      </div>
      <div ref={canvasRef} className="document-viewer__canvas" role="region" onScroll={onCanvasScroll} tabIndex={0} aria-label="Páginas del PDF">
        {pages.map((size, index) => <div key={index} ref={(element) => { pageRefs.current[index] = element; }} className="document-viewer__page" style={{ width: size.width * effectiveZoom / 100, height: size.height * effectiveZoom / 100 }}>
          <PdfCanvas pdf={pdf} pageNumber={index + 1} scale={effectiveZoom / 100} root={canvasRef} onError={handleRenderError} />
        </div>)}
      </div>
    </div>
  </div>;
}

export default PdfDocument;
