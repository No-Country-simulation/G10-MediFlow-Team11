import {
  BookOpen,
  CircleHelp,
  FileCheck2,
  FileUp,
  ListChecks,
  ShieldCheck,
  TriangleAlert,
  ArrowUp,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import fileGuideImage from "../assets/help/guia-archivo.png";
import textGuideImage from "../assets/help/guia-texto.png";
import {
  scrollHelpPageToTop,
  shouldShowBackToTop,
} from "./helpBackToTop";
import "../styles/help-page.css";

const documentStates = [
  ["RECEIVED", "Recibido", "MediFlow recibió el documento y lo registró para comenzar su tratamiento."],
  ["PROCESSING", "En procesamiento", "El documento está siendo analizado."],
  ["PROCESSED", "Procesado", "El procesamiento terminó y no requiere una revisión humana pendiente."],
  ["NEEDS_AUDIT", "Requiere auditoría", "El documento necesita una revisión humana antes de confirmar su resultado."],
  ["APPROVED", "Aprobado", "Una persona autorizada revisó y aprobó el documento."],
  ["REJECTED", "Rechazado", "El documento fue rechazado durante la revisión humana."],
  ["FAILED", "Fallido", "El procesamiento no pudo completarse y el documento no quedó disponible para una revisión recuperable dentro del flujo."],
] as const;

const frequentProblems = [
  ["Archivo no admitido", "Utiliza un documento en formato PDF, JPG o PNG."],
  ["Archivo vacío o dañado", "Comprueba que el archivo contenga información y pueda abrirse correctamente."],
  ["Texto vacío", "Escribe o pega contenido clínico en el campo correspondiente."],
  ["Falta el Canal de origen", "Selecciona el Canal de origen. Si eliges Otro, completa también la información adicional solicitada."],
  ["Error de comunicación", "Comprueba la conexión e intenta nuevamente cuando corresponda."],
  ["Documento en auditoría", "Consulta la sección Auditoría para revisar los documentos pendientes."],
  ["Procesamiento no completado", "Revisa el archivo y los datos ingresados. Un documento Fallido no pudo completar el procesamiento; uno que Requiere auditoría sí puede ser comprobado por una persona."],
] as const;

const faqs = [
  ["¿Qué archivos puedo cargar?", "Puedes cargar documentos en formato PDF, JPG o PNG."],
  ["¿Puedo procesar texto sin cargar un archivo?", "Sí. Selecciona Texto, escribe o pega el contenido clínico y completa el Canal de origen."],
  ["¿Debo ingresar un identificador?", "No. MediFlow genera automáticamente un identificador para cada documento procesado."],
  ["¿Qué significa URGENT?", "Significa que MediFlow clasificó el documento con prioridad urgente. Esta clasificación no sustituye una evaluación clínica profesional."],
  ["¿Qué significa revisión humana?", "Significa que una persona debe comprobar la información del documento antes de confirmar el resultado."],
  ["¿Por qué un documento puede requerir auditoría?", "Porque puede existir baja confianza, información ilegible, datos faltantes o inconsistentes, o una dificultad durante el procesamiento."],
  ["¿Qué ocurre si falla el procesamiento?", "Depende de la situación. Si el documento puede recuperarse y revisarse, MediFlow puede enviarlo a auditoría. Si no puede completarse ni conservarse de forma recuperable, puede quedar en estado Fallido."],
  ["¿Qué significa el estado de mi documento?", "Indica su etapa actual. Recibido significa que ingresó al sistema; En procesamiento, que está siendo analizado; y Procesado, que terminó sin una revisión humana pendiente."],
] as const;

function SectionTitle({
  id,
  icon,
  children,
}: {
  id: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="help-page__section-heading">
      <span className="help-page__section-icon" aria-hidden="true">{icon}</span>
      <h2 id={id}>{children}</h2>
    </div>
  );
}

type HelpPageContentProps = {
  showBackToTop?: boolean;
  onBackToTop?: () => void;
};

export function HelpPageContent({
  showBackToTop = false,
  onBackToTop,
}: HelpPageContentProps) {
  return (
    <div className="help-page">
      <div className="help-page__container">
        <header className="help-page__header">
          <h1>Centro de ayuda</h1>
          <p>Conoce cómo procesar documentos, interpretar sus resultados y resolver situaciones frecuentes.</p>
        </header>

        <nav className="help-page__contents" aria-label="Secciones del Centro de ayuda">
          <p>En esta guía</p>
          <ul>
            <li><a href="#about">Acerca de MediFlow</a></li>
            <li><a href="#process">Procesar un documento</a></li>
            <li><a href="#results">Entender el resultado</a></li>
            <li><a href="#audit">Revisión humana / Auditoría</a></li>
            <li><a href="#states">Estados del documento</a></li>
            <li><a href="#problems">Problemas frecuentes</a></li>
            <li><a href="#faq">Preguntas frecuentes</a></li>
          </ul>
        </nav>

        <div className="help-page__sections">
          <section id="about" className="help-page__card" aria-labelledby="about-title">
            <SectionTitle id="about-title" icon={<BookOpen size={20} />}>Acerca de MediFlow</SectionTitle>
            <div className="help-page__prose">
              <p>MediFlow es una herramienta que ayuda a organizar y procesar documentos clínicos.</p>
              <p>Permite ingresar documentos como archivos o texto, identificar su contenido, extraer información relevante y determinar su prioridad y destino.</p>
              <p>También evalúa qué tan confiable es el resultado. Cuando detecta información insuficiente, dudas o dificultades, puede enviar el documento a revisión humana.</p>
              <p>De esta manera, facilita la organización de la información y permite identificar los casos que requieren atención adicional.</p>
            </div>
          </section>

          <section id="process" className="help-page__card" aria-labelledby="process-title">
            <SectionTitle id="process-title" icon={<FileUp size={20} />}>Procesar un documento</SectionTitle>
            <div className="help-page__process-guides">
              <figure className="help-page__process-guide">
                <a className="help-page__guide-image-link" href={fileGuideImage} target="_blank" rel="noreferrer" aria-label="Abrir guía para procesar un archivo en tamaño completo">
                  <img src={fileGuideImage} alt="Guía de MediFlow para procesar un archivo: seleccionar Archivo, cargar un PDF, JPG o PNG, elegir el Canal de origen e iniciar el procesamiento." />
                </a>
                <figcaption>
                  <h3>Procesar un archivo</h3>
                  <p>Consulta la guía visual para cargar un documento clínico en formato PDF, JPG o PNG.</p>
                  <a href={fileGuideImage} target="_blank" rel="noreferrer">Abrir guía de archivo en tamaño completo</a>
                </figcaption>
              </figure>
              <figure className="help-page__process-guide">
                <a className="help-page__guide-image-link" href={textGuideImage} target="_blank" rel="noreferrer" aria-label="Abrir guía para procesar texto en tamaño completo">
                  <img src={textGuideImage} alt="Guía de MediFlow para procesar texto: seleccionar Texto, escribir o pegar contenido clínico, elegir el Canal de origen e iniciar el procesamiento." />
                </a>
                <figcaption>
                  <h3>Procesar texto</h3>
                  <p>Consulta la guía visual para ingresar o pegar contenido clínico directamente en MediFlow.</p>
                  <a href={textGuideImage} target="_blank" rel="noreferrer">Abrir guía de texto en tamaño completo</a>
                </figcaption>
              </figure>
            </div>
            <div className="help-page__note"><strong>Canal de origen obligatorio.</strong> Debes seleccionarlo en ambos modos. Si eliges Otro, completa la información adicional solicitada por el formulario.</div>
            <div className="help-page__note help-page__note--info"><strong>Identificador.</strong> No necesitas crear uno. MediFlow genera automáticamente un ID para cada documento procesado y lo utiliza para mantener su trazabilidad.</div>
          </section>

          <section id="results" className="help-page__card" aria-labelledby="results-title">
            <SectionTitle id="results-title" icon={<FileCheck2 size={20} />}>Entender el resultado</SectionTitle>
            <div className="help-page__result-groups">
              <section className="help-page__result-group" aria-labelledby="identification-title">
                <h3 id="identification-title">Identificación del documento</h3>
                <dl><div><dt>Clasificación</dt><dd>Indica el tipo de documento identificado.</dd></div><div><dt>Especialidad</dt><dd>Señala el área clínica relacionada, cuando esta información está disponible.</dd></div><div><dt>Identificador</dt><dd>Código único generado automáticamente para reconocer y consultar el documento.</dd></div></dl>
              </section>
              <section className="help-page__result-group help-page__result-group--priority" aria-labelledby="priority-title">
                <h3 id="priority-title">Prioridad</h3>
                <p>Distingue documentos de atención habitual de documentos identificados como urgentes.</p>
                <div className="help-page__priority-options"><div><code>ROUTINE</code><span>Rutina</span><p>Documento clasificado con prioridad habitual.</p></div><div><code>URGENT</code><span>Urgente</span><p>Documento identificado con prioridad urgente.</p></div></div>
              </section>
              <section className="help-page__result-group" aria-labelledby="analysis-title">
                <h3 id="analysis-title">Análisis del documento</h3>
                <dl><div><dt>Información extraída</dt><dd>Datos relevantes identificados en el documento.</dd></div><div><dt>Nivel de confianza</dt><dd>Indica qué tan confiable considera MediFlow el resultado de su análisis. Una confianza baja puede dar lugar a revisión humana.</dd></div></dl>
              </section>
              <section className="help-page__result-group" aria-labelledby="decision-title">
                <h3 id="decision-title">Decisión del flujo</h3>
                <dl><div><dt>Destino asignado</dt><dd>Indica hacia dónde se ha determinado dirigir el documento. Cuando requiere auditoría, la confirmación del destino queda pendiente de revisión.</dd></div><div><dt>Estado</dt><dd>Muestra la etapa actual del documento.</dd></div></dl>
              </section>
            </div>
            <div className="help-page__notice"><TriangleAlert size={18} aria-hidden="true" /><p>La clasificación y la prioridad son resultados del procesamiento y no sustituyen la evaluación de un profesional de salud.</p></div>
          </section>

          <section id="audit" className="help-page__card" aria-labelledby="audit-title">
            <SectionTitle id="audit-title" icon={<ShieldCheck size={20} />}>Revisión humana / Auditoría</SectionTitle>
            <div className="help-page__prose">
              <p>MediFlow puede necesitar una revisión humana antes de confirmar un resultado. Cuando esto ocurre, el documento pasa a <code>NEEDS_AUDIT</code> — Requiere auditoría.</p>
              <p>Puede deberse a confianza insuficiente, un documento ilegible, información importante faltante, datos inconsistentes o dificultades temporales durante el procesamiento.</p>
              <p>Consulta la sección Auditoría para revisar los documentos pendientes.</p>
            </div>
            <div className="help-page__note help-page__note--info"><strong>Ten en cuenta:</strong> un documento enviado a auditoría no significa necesariamente que su contenido sea incorrecto. Significa que necesita una comprobación adicional.</div>
          </section>

          <section id="states" className="help-page__card" aria-labelledby="states-title">
            <SectionTitle id="states-title" icon={<ListChecks size={20} />}>Estados del documento</SectionTitle>
            <div className="help-page__state-list">
              {documentStates.map(([code, label, description]) => (
                <article key={code} className="help-page__state">
                  <code>{code}</code><h3>{label}</h3><p>{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="problems" className="help-page__card" aria-labelledby="problems-title">
            <SectionTitle id="problems-title" icon={<TriangleAlert size={20} />}>Problemas frecuentes</SectionTitle>
            <ul className="help-page__problem-list">
              {frequentProblems.map(([title, description]) => <li key={title}><div><h3>{title}</h3><p>{description}</p></div></li>)}
            </ul>
          </section>

          <section id="faq" className="help-page__card" aria-labelledby="faq-title">
            <SectionTitle id="faq-title" icon={<CircleHelp size={20} />}>Preguntas frecuentes</SectionTitle>
            <div className="help-page__faq-list">
              {faqs.map(([question, answer]) => (
                <details key={question} className="help-page__faq">
                  <summary>{question}</summary><p>{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
      {showBackToTop && (
        <button
          type="button"
          className="help-page__back-to-top"
          aria-label="Volver al inicio"
          onClick={onBackToTop}
        >
          <ArrowUp aria-hidden="true" size={20} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function HelpPage() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const updateBackToTopVisibility = () => {
      setShowBackToTop(shouldShowBackToTop(window.scrollY));
    };

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);

  const handleBackToTop = () => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    scrollHelpPageToTop(reducedMotion);
  };

  return (
    <HelpPageContent
      showBackToTop={showBackToTop}
      onBackToTop={handleBackToTop}
    />
  );
}

export default HelpPage;
