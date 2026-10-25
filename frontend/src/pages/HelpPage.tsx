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
import { Link } from "react-router-dom";
import {
  scrollHelpPageToTop,
  shouldShowBackToTop,
} from "./helpBackToTop";
import HelpGuide from "./HelpGuide";
import "../styles/help-page.css";

const documentStates = [
  ["RECEIVED", "Recibido", "MediFlow recibió el documento y lo registró para comenzar su tratamiento."],
  ["PROCESSING", "Procesando", "El documento está siendo analizado."],
  ["PROCESSED", "Procesado", "El procesamiento terminó y no requiere una revisión humana pendiente."],
  ["NEEDS_AUDIT", "Requiere revisión", "El documento necesita una revisión humana antes de confirmar su resultado."],
  ["APPROVED", "Aprobado", "Una persona autorizada revisó y aprobó el documento."],
  ["REJECTED", "Rechazado", "El documento fue rechazado durante la revisión humana."],
  ["FAILED", "Fallido", "El procesamiento no pudo completarse debido a un problema técnico y el documento original no pudo recuperarse."],
] as const;

const frequentProblems = [
  ["No puedo cargar un documento", "Compruebe que el archivo sea PDF, JPG o PNG, que tenga contenido y que no supere el tamaño permitido. Después, vuelva a seleccionarlo."],
  ["No puedo comenzar el procesamiento", "Compruebe que haya ingresado el documento o texto, seleccionado el canal de origen y completado los campos solicitados."],
  ["No fue posible procesar el documento", "Si MediFlow muestra un error durante el procesamiento, la información ingresada se conserva. Seleccione «Reintentar» para realizar un nuevo intento."],
  ["Una receta u orden de examen no se interpretó correctamente", <>Revise el resultado del documento. Si MediFlow indica que necesita revisión, ingrese a <Link className="help-page__inline-link" to="/audit">Auditoría</Link> para consultar el documento y continuar con su revisión.</>],
  ["La información extraída no coincide con el documento original", <>Si la información extraída no coincide con el documento original, compruebe el resultado. Si el documento está pendiente de revisión humana, ingrese a <Link className="help-page__inline-link" to="/audit">Auditoría</Link>, abra Revisión Clínica y corrija los campos permitidos antes de registrar la decisión.</>],
  ["Un documento quedó pendiente de revisión", <>Ingrese a <Link className="help-page__inline-link" to="/audit">Auditoría</Link> para consultar los documentos pendientes. Si tiene esa responsabilidad, abra el documento y realice la revisión correspondiente.</>],
  ["No puedo consultar el resultado de un documento", "Si aparece el mensaje «No fue posible cargar el resultado», seleccione «Reintentar» para volver a consultar la información."],
  ["Necesito consultar los cambios realizados a un documento", <>Puede consultar los cambios de un documento desde su resultado, seleccionando «Ver historial». También puede ingresar a «<Link className="help-page__inline-link" to="/history">Historial</Link>» desde el menú lateral, buscar el documento por su identificador o nombre de archivo y seleccionar «Consultar historial».</>],
] as const;

const faqs = [
  ["¿Qué archivos puedo cargar?", "Puede cargar documentos en formato PDF, JPG o PNG."],
  ["¿Puedo procesar texto sin cargar un archivo?", "Sí. Seleccione Texto, escriba o pegue el contenido clínico y complete el Canal de origen."],
  ["¿Debo ingresar un identificador?", "No. MediFlow genera automáticamente un identificador para cada documento procesado."],
  ["¿Qué significa URGENT?", "Significa que MediFlow clasificó el documento con prioridad urgente. Esta clasificación no sustituye una evaluación clínica profesional."],
  ["¿Qué significa revisión humana?", "Significa que una persona debe comprobar la información del documento antes de confirmar el resultado."],
  ["¿Por qué un documento puede requerir auditoría?", "Porque MediFlow puede detectar información poco clara, datos faltantes o inconsistentes, o dificultades durante el procesamiento."],
  ["¿Qué ocurre si falla el procesamiento?", "Depende de la situación. Si el documento puede recuperarse y revisarse, MediFlow puede enviarlo a auditoría. Si no puede completarse ni conservarse de forma recuperable, puede quedar en estado Fallido."],
  ["¿Qué significa el estado de mi documento?", "El estado indica en qué etapa se encuentra su documento. «Recibido» significa que ingresó al sistema; «Procesando», que está siendo analizado; y «Procesado», que terminó sin una revisión humana pendiente."],
  ["¿Cómo puedo consultar el historial de un documento?", <>Ingrese a «<Link className="help-page__inline-link" to="/history">Historial</Link>» desde el menú lateral. Busque el documento por su identificador o nombre de archivo y seleccione «Consultar historial» para revisar los registros disponibles. No necesita volver a procesar el documento.</>],
  ["¿Cómo cambio entre modo claro y oscuro?", <>Ingrese a <Link className="help-page__inline-link" to="/settings">Configuración</Link>, busque Apariencia y seleccione Claro u Oscuro.</>],
  ["¿Qué significa la opción Sistema?", <>La opción Sistema hace que MediFlow utilice el modo claro u oscuro definido en su dispositivo. Puede seleccionarla en <Link className="help-page__inline-link" to="/settings">Configuración</Link>.</>],
  ["¿Se guarda mi preferencia de apariencia?", "Sí. MediFlow guarda su elección de apariencia en el navegador para utilizarla cuando vuelva a ingresar. Si el navegador no permite guardar esta información, podrá seguir utilizando el tema seleccionado mientras la aplicación permanezca abierta."],
  ["¿Qué hago si el modo oscuro no se aplica correctamente?", <>Ingrese a <Link className="help-page__inline-link" to="/settings">Configuración</Link> y seleccione nuevamente Oscuro. Si utiliza Sistema, compruebe también el modo de apariencia configurado en su dispositivo.</>],
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
          <p>Conozca cómo procesar documentos, interpretar sus resultados y resolver situaciones frecuentes.</p>
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
              <p>También evalúa el nivel de confianza del resultado. Cuando detecta información insuficiente, dudas o dificultades, puede enviar el documento a revisión humana.</p>
              <p>De esta manera, facilita la organización de la información y permite identificar los casos que requieren atención adicional.</p>
              <div className="help-page__note help-page__note--info">
                <strong>Limitaciones de esta versión.</strong> Esta versión utiliza únicamente datos clínicos sintéticos. MediFlow simula el envío de documentos a distintas áreas hospitalarias, pero no los envía realmente ni está conectado con sistemas hospitalarios externos. Sus resultados no sustituyen la evaluación de profesionales de salud.
              </div>
            </div>
          </section>

          <section id="process" className="help-page__card" aria-labelledby="process-title">
            <SectionTitle id="process-title" icon={<FileUp size={20} />}>Procesar un documento</SectionTitle>
            <p className="help-page__section-action">Utilice las siguientes guías o ingrese a <Link className="help-page__inline-link" to="/processing">Procesamiento</Link> para comenzar.</p>
            <div className="help-page__process-guides">
              <HelpGuide mode="file" />
              <HelpGuide mode="text" />
            </div>
            <div className="help-page__note"><strong>Canal de origen obligatorio.</strong> Debe seleccionarlo en ambos modos. Si elige Otro, complete la información adicional solicitada por el formulario.</div>
            <div className="help-page__note help-page__note--info"><strong>Identificador.</strong> No necesita crear un identificador. MediFlow asigna uno automáticamente a cada documento para poder identificarlo y consultar su seguimiento.</div>
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
                <div className="help-page__priority-options"><div><code>ROUTINE</code><span>Rutinaria</span><p>Documento clasificado con prioridad habitual.</p></div><div><code>URGENT</code><span>Urgente</span><p>Documento identificado con prioridad urgente.</p></div></div>
              </section>
              <section className="help-page__result-group" aria-labelledby="analysis-title">
                <h3 id="analysis-title">Análisis del documento</h3>
                <dl><div><dt>Información extraída</dt><dd>Datos relevantes identificados en el documento.</dd></div><div><dt>Nivel de confianza</dt><dd>Indica qué tan confiable considera MediFlow el resultado de su análisis. Una confianza baja puede dar lugar a revisión humana.</dd></div></dl>
              </section>
              <section className="help-page__result-group" aria-labelledby="decision-title">
                <h3 id="decision-title">Decisión del flujo</h3>
                <dl><div><dt>Destino del documento</dt><dd>Según el estado del documento, el destino puede estar pendiente, propuesto para revisión, confirmado o registrado sin aplicarse como destino final. En esta versión, el enrutamiento es simulado.</dd></div><div><dt>Estado</dt><dd>Muestra la etapa actual del documento.</dd></div></dl>
              </section>
            </div>
            <div className="help-page__notice"><TriangleAlert size={18} aria-hidden="true" /><p>La clasificación y la prioridad son resultados del procesamiento y no sustituyen la evaluación de un profesional de salud.</p></div>
          </section>

          <section id="audit" className="help-page__card" aria-labelledby="audit-title">
            <SectionTitle id="audit-title" icon={<ShieldCheck size={20} />}>Revisión humana / Auditoría</SectionTitle>
            <div className="help-page__prose">
              <p>En algunos casos, MediFlow necesita que una persona revise el documento antes de confirmar el resultado. Cuando esto ocurre, el documento queda pendiente de revisión en Auditoría.</p>
              <p>Puede deberse a confianza insuficiente, un documento ilegible, información importante faltante, datos inconsistentes o dificultades temporales durante el procesamiento.</p>
              <p>Consulte <Link className="help-page__inline-link" to="/audit">Auditoría</Link> para revisar los documentos pendientes.</p>
              <p>Desde Auditoría puede abrir un documento pendiente de revisión y acceder a Revisión Clínica. Allí podrá consultar el documento original, comprobar la información procesada y corregir los campos permitidos. Al finalizar, podrá aprobar o rechazar el documento según corresponda.</p>
            </div>
            <div className="help-page__note help-page__note--info"><strong>Tenga en cuenta:</strong> un documento enviado a auditoría no significa necesariamente que su contenido sea incorrecto. Significa que necesita una comprobación adicional.</div>
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
