import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import fileProcedureImage from "../assets/help/procedimiento-archivo.png";
import textProcedureImage from "../assets/help/procedimiento-texto.png";

type GuideMode = "file" | "text";
type Highlight = readonly [number, number, number, number];

type GuideStep = {
  title: string;
  description: string;
  highlight: Highlight | null;
};

type GuideDefinition = {
  mode: GuideMode;
  title: string;
  image: string;
  imageAlt: string;
  steps: readonly GuideStep[];
};

const RESULT_STEP: GuideStep = {
  title: "Consulte el resultado",
  description: "Al finalizar el procesamiento, MediFlow lo llevará automáticamente a «Resultado».",
  highlight: null,
};

const GUIDE_DEFINITIONS: Record<GuideMode, GuideDefinition> = {
  file: {
    mode: "file",
    title: "Procesar un archivo",
    image: fileProcedureImage,
    imageAlt: "Pantalla de Procesamiento de MediFlow en la modalidad Archivo, con un documento seleccionado y su vista previa.",
    steps: [
      { title: "Ingrese a Procesamiento", description: "Abra Procesamiento desde el menú lateral.", highlight: [12, 159, 216, 64] },
      { title: "Seleccione Archivo", description: "Elija la modalidad Archivo.", highlight: [264, 132, 70, 36] },
      { title: "Cargue el documento", description: "Seleccione un archivo PDF, JPG o PNG.", highlight: [274, 275, 514, 102] },
      { title: "Seleccione el Canal de origen", description: "Seleccione el canal correspondiente.", highlight: [274, 419, 514, 60] },
      { title: "Inicie el procesamiento", description: "Pulse Procesar documento.", highlight: [274, 713, 162, 42] },
      RESULT_STEP,
    ],
  },
  text: {
    mode: "text",
    title: "Procesar texto",
    image: textProcedureImage,
    imageAlt: "Pantalla de Procesamiento de MediFlow en la modalidad Texto, con contenido clínico y Canal de origen.",
    steps: [
      { title: "Ingrese a Procesamiento", description: "Abra Procesamiento desde el menú lateral.", highlight: [13, 159, 216, 64] },
      { title: "Seleccione Texto", description: "Elija la modalidad Texto.", highlight: [354, 132, 57, 36] },
      { title: "Escriba o pegue el contenido", description: "Introduzca el texto clínico en el campo correspondiente.", highlight: [437, 230, 735, 227] },
      { title: "Seleccione el Canal de origen", description: "Seleccione el canal correspondiente.", highlight: [437, 483, 506, 56] },
      { title: "Inicie el procesamiento", description: "Pulse Procesar texto.", highlight: [437, 576, 124, 40] },
      RESULT_STEP,
    ],
  },
};

type HelpGuideViewProps = {
  mode: GuideMode;
  activeStep: number;
  expanded: boolean;
  detailExpanded: boolean;
  onStepChange: (step: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
  onToggleDetail: () => void;
  openButtonRef?: RefObject<HTMLButtonElement | null>;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  dialogRef?: RefObject<HTMLElement | null>;
  scrollerRef?: RefObject<HTMLDivElement | null>;
};

function GuideImage({ definition, activeStep }: { definition: GuideDefinition; activeStep: number }) {
  const step = definition.steps[activeStep];
  const highlight = step.highlight;
  const highlightStyle = highlight ? {
    left: `${highlight[0] / 1366 * 100}%`,
    top: `${highlight[1] / 768 * 100}%`,
    width: `${highlight[2] / 1366 * 100}%`,
    height: `${highlight[3] / 768 * 100}%`,
  } : undefined;
  const showFileArrow = definition.mode === "file" && activeStep === 2;

  return (
    <div className="help-guide__screen" data-guide-image={definition.mode}>
      <img src={definition.image} alt={definition.imageAlt} />
      {highlight && <span className="help-guide__highlight" style={highlightStyle} aria-hidden="true" />}
      {showFileArrow && (
        <svg className="help-guide__arrow" viewBox="0 0 1366 768" preserveAspectRatio="none" aria-hidden="true">
          <line className="help-guide__arrow-halo" x1="788" y1="326" x2="799" y2="326" />
          <line x1="788" y1="326" x2="799" y2="326" />
          <polygon points="807,326 797,320 797,332" />
        </svg>
      )}
    </div>
  );
}

export function HelpGuideSteps({ mode, activeStep, onStepChange }: Pick<HelpGuideViewProps, "mode" | "activeStep" | "onStepChange">) {
  const definition = GUIDE_DEFINITIONS[mode];
  return (
    <ol className="help-guide__steps" aria-label={`Pasos para ${definition.title.toLowerCase()}`}>
      {definition.steps.map((step, index) => (
        <li key={step.title}>
          <button
            type="button"
            className="help-guide__step"
            aria-current={index === activeStep ? "step" : undefined}
            onClick={() => onStepChange(index)}
          >
            <span className="help-guide__step-number" aria-hidden="true">{index + 1}</span>
            <span><strong>{step.title}</strong><span>{step.description}</span></span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function HelpGuideView({
  mode,
  activeStep,
  expanded,
  detailExpanded,
  onStepChange,
  onOpen,
  onClose,
  onPrevious,
  onNext,
  onRestart,
  onToggleDetail,
  openButtonRef,
  closeButtonRef,
  dialogRef,
  scrollerRef,
}: HelpGuideViewProps) {
  const definition = GUIDE_DEFINITIONS[mode];
  const step = definition.steps[activeStep];
  const isLastStep = activeStep === definition.steps.length - 1;
  const titleId = `help-guide-${mode}-dialog-title`;

  return (
    <article className="help-guide" data-guide={mode}>
      <h3>{definition.title}</h3>
      <div className="help-guide__layout">
        <GuideImage definition={definition} activeStep={activeStep} />
        <HelpGuideSteps mode={mode} activeStep={activeStep} onStepChange={onStepChange} />
      </div>
      <div className="help-guide__footer">
        <span>6 pasos · selecciona uno</span>
        <button ref={openButtonRef} type="button" className="help-guide__primary-button" onClick={onOpen}>Ampliar guía</button>
      </div>

      {expanded && (
        <div className="help-guide__overlay" onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
          if (event.target === event.currentTarget) onClose();
        }}>
          <section ref={dialogRef} className="help-guide__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="help-guide__dialog-header">
              <h2 id={titleId}>{definition.title} — visita guiada</h2>
              <button ref={closeButtonRef} type="button" className="help-guide__secondary-button" onClick={onClose}>Cerrar</button>
            </header>
            <div className="help-guide__dialog-content">
              <div ref={scrollerRef} className={`help-guide__image-scroller${detailExpanded ? " help-guide__image-scroller--expanded" : ""}`} tabIndex={0} aria-label="Captura ampliada; desplázate horizontalmente para inspeccionar el detalle">
                <GuideImage definition={definition} activeStep={activeStep} />
              </div>
              <button type="button" className="help-guide__detail-button" aria-pressed={detailExpanded} onClick={onToggleDetail}>
                {detailExpanded ? "Ver imagen completa" : "Ampliar detalle"}
              </button>
              <div className="help-guide__dialog-steps">
                <HelpGuideSteps mode={mode} activeStep={activeStep} onStepChange={onStepChange} />
              </div>
              <div className="help-guide__mobile-step" aria-live="polite">
                <strong>{activeStep + 1}. {step.title}</strong>
                <p>{step.description}</p>
              </div>
              <div className="help-guide__controls">
                <button type="button" className="help-guide__secondary-button" disabled={activeStep === 0} onClick={onPrevious}>Anterior</button>
                <span aria-live="polite">{activeStep + 1} / {definition.steps.length}</span>
                {isLastStep ? (
                  <button type="button" className="help-guide__primary-button" onClick={onRestart}>Reiniciar</button>
                ) : (
                  <button type="button" className="help-guide__primary-button" onClick={onNext}>Siguiente</button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

function HelpGuide({ mode }: { mode: GuideMode }) {
  const [activeStep, setActiveStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setExpanded(false);
    setDetailExpanded(false);
    window.requestAnimationFrame(() => openButtonRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [close, expanded]);

  useEffect(() => {
    if (!expanded || !detailExpanded || !scrollerRef.current) return;
    const definition = GUIDE_DEFINITIONS[mode];
    const highlight = definition.steps[activeStep].highlight;
    if (!highlight) {
      scrollerRef.current.scrollLeft = 0;
      return;
    }
    const centerRatio = (highlight[0] + highlight[2] / 2) / 1366;
    const target = centerRatio * scrollerRef.current.scrollWidth - scrollerRef.current.clientWidth / 2;
    scrollerRef.current.scrollTo({
      left: Math.max(0, target),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [activeStep, detailExpanded, expanded, mode]);

  return (
    <HelpGuideView
      mode={mode}
      activeStep={activeStep}
      expanded={expanded}
      detailExpanded={detailExpanded}
      onStepChange={setActiveStep}
      onOpen={() => setExpanded(true)}
      onClose={close}
      onPrevious={() => setActiveStep((step) => Math.max(0, step - 1))}
      onNext={() => setActiveStep((step) => Math.min(GUIDE_DEFINITIONS[mode].steps.length - 1, step + 1))}
      onRestart={() => setActiveStep(0)}
      onToggleDetail={() => setDetailExpanded((value) => !value)}
      openButtonRef={openButtonRef}
      closeButtonRef={closeButtonRef}
      dialogRef={dialogRef}
      scrollerRef={scrollerRef}
    />
  );
}

export default HelpGuide;
