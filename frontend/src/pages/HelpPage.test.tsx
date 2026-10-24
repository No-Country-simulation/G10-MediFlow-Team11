import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Link, MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppSidebar from "../components/AppSidebar";
import SidebarNavItem from "../components/SidebarNavItem";
import AppLayout from "../layouts/AppLayout";
import AppRoutes from "../routes/AppRoutes";
import {
  BACK_TO_TOP_SCROLL_THRESHOLD,
  scrollHelpPageToTop,
  shouldShowBackToTop,
} from "./helpBackToTop";
import HelpGuide, {
  HelpGuideSteps,
  HelpGuideView,
} from "./HelpGuide";
import HelpPage, { HelpPageContent } from "./HelpPage";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    createBrowserRouter: (routes: unknown) => ({ routes }),
  };
});

type ElementProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

function walkElements(node: ReactNode): ReactElement<ElementProps>[] {
  const elements: ReactElement<ElementProps>[] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement<ElementProps>(child)) return;

    elements.push(child);
    elements.push(...walkElements(child.props.children));
  });

  return elements;
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!isValidElement<ElementProps>(node)) {
    return Children.toArray(node).map(textContent).join("");
  }

  return textContent(node.props.children);
}

const expectedSectionIds = [
  "about",
  "process",
  "results",
  "audit",
  "states",
  "problems",
  "faq",
];

const expectedFaqs = [
  "¿Qué archivos puedo cargar?",
  "¿Puedo procesar texto sin cargar un archivo?",
  "¿Debo ingresar un identificador?",
  "¿Qué significa URGENT?",
  "¿Qué significa revisión humana?",
  "¿Por qué un documento puede requerir auditoría?",
  "¿Qué ocurre si falla el procesamiento?",
  "¿Qué significa el estado de mi documento?",
  "¿Cómo puedo consultar el historial de un documento?",
  "¿Cómo cambio entre modo claro y oscuro?",
  "¿Qué significa la opción Sistema?",
  "¿Se guarda mi preferencia de apariencia?",
  "¿Qué hago si el modo oscuro no se aplica correctamente?",
];

const expectedStates = [
  "RECEIVED",
  "PROCESSING",
  "PROCESSED",
  "NEEDS_AUDIT",
  "APPROVED",
  "REJECTED",
  "FAILED",
];

const expectedFileSteps = [
  "Ingresa a Procesamiento",
  "Selecciona Archivo",
  "Carga el documento",
  "Selecciona el Canal de origen",
  "Inicia el procesamiento",
  "Consulta el resultado",
];

const expectedTextSteps = [
  "Ingresa a Procesamiento",
  "Selecciona Texto",
  "Escribe o pega el contenido",
  "Selecciona el Canal de origen",
  "Inicia el procesamiento",
  "Consulta el resultado",
];

function guideMarkup(mode: "file" | "text", activeStep = 0, expanded = false) {
  return renderToStaticMarkup(
    <HelpGuideView
      mode={mode}
      activeStep={activeStep}
      expanded={expanded}
      detailExpanded={false}
      onStepChange={vi.fn()}
      onOpen={vi.fn()}
      onClose={vi.fn()}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onRestart={vi.fn()}
      onToggleDetail={vi.fn()}
    />,
  );
}

const expectedProblems = [
  ["No puedo cargar un documento", "Comprueba que el archivo sea PDF, JPG o PNG, que tenga contenido y que no supere el tamaño permitido. Después, vuelve a seleccionarlo."],
  ["No puedo comenzar el procesamiento", "Comprueba que hayas ingresado el documento o texto, seleccionado el canal de origen y completado los campos solicitados."],
  ["No fue posible procesar el documento", "Si MediFlow muestra un error durante el procesamiento, la información ingresada se conserva. Selecciona «Reintentar» para realizar un nuevo intento."],
  ["Una receta u orden de examen no se interpretó correctamente", "Revisa el resultado del documento. Si MediFlow indica que necesita revisión, entra a Auditoría para consultar el documento y continuar con su revisión."],
  ["La información extraída no coincide con el documento original", "Si la información extraída no coincide con el documento original, comprueba el resultado. Si el documento está pendiente de revisión humana, entra a Auditoría, abre Revisión Clínica y corrige los campos permitidos antes de registrar la decisión."],
  ["Un documento quedó pendiente de revisión", "Entra a Auditoría para consultar los documentos pendientes. Si tienes esa responsabilidad, abre el documento y realiza la revisión correspondiente."],
  ["No puedo consultar el resultado de un documento", "Si aparece el mensaje «No fue posible cargar el resultado», selecciona «Reintentar» para volver a consultar la información."],
  ["Necesito consultar los cambios realizados a un documento", "Puedes consultar los cambios de un documento desde su resultado, seleccionando «Ver historial». También puedes entrar a «Historial» desde el menú lateral, buscar el documento por su identificador o nombre de archivo y seleccionar «Consultar historial»."],
];

describe("Ticket #76 - Centro de ayuda", () => {
  const page = HelpPageContent({});
  const pageElements = walkElements(page);

  it("T76-01 renderiza HelpPage con el encabezado oficial", () => {
    const markup = renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>);

    expect(markup).toContain("<h1>Centro de ayuda</h1>");
    expect(markup).toContain(
      "Conoce cómo procesar documentos, interpretar sus resultados y resolver situaciones frecuentes.",
    );
    expect(markup).not.toContain('aria-label="Ruta de navegación"');
    expect(markup).not.toContain('aria-current="page"');
  });

  it("T76-02 contiene las siete secciones aprobadas", () => {
    const sectionIds = pageElements
      .filter((element) => element.type === "section" && element.props.id)
      .map((element) => element.props.id);

    expect(sectionIds).toEqual(expectedSectionIds);
  });

  it("T76-03 relaciona los siete enlaces del índice con sus destinos", () => {
    const index = pageElements.find(
      (element) =>
        element.type === "nav" &&
        element.props["aria-label"] === "Secciones del Centro de ayuda",
    );
    expect(index).toBeDefined();

    const links = walkElements(index).filter(
      (element) => element.type === "a" && typeof element.props.href === "string",
    );
    const hrefs = links.map((link) => link.props.href);

    expect(hrefs).toEqual(expectedSectionIds.map((id) => `#${id}`));
    for (const href of hrefs) {
      expect(pageElements.some((element) => element.props.id === String(href).slice(1))).toBe(true);
    }
  });

  it("T76-04 conserva las preguntas aprobadas y añade las cuatro de apariencia", () => {
    const details = pageElements.filter((element) => element.type === "details");
    const questions = details.map((detail) => {
      const summary = walkElements(detail).find((element) => element.type === "summary");
      return summary ? textContent(summary) : "";
    });

    expect(questions).toEqual(expectedFaqs);
  });

  it("T76-05 usa disclosures nativos cerrados inicialmente", () => {
    const details = pageElements.filter((element) => element.type === "details");

    expect(details).toHaveLength(13);
    for (const detail of details) {
      expect(detail.props.open).toBeUndefined();
      expect(walkElements(detail).some((element) => element.type === "summary")).toBe(true);
    }
  });

  it("T76-06 presenta exclusivamente los siete estados oficiales", () => {
    const stateList = pageElements.find(
      (element) => element.props.className === "help-page__state-list",
    );
    expect(stateList).toBeDefined();

    const stateCodes = walkElements(stateList)
      .filter((element) => element.type === "code")
      .map((element) => textContent(element));

    expect(stateCodes).toEqual(expectedStates);
  });

  it("T76-07 mantiene ROUTINE y URGENT agrupadas como prioridades", () => {
    const priorityGroup = pageElements.find(
      (element) => element.props["aria-labelledby"] === "priority-title",
    );
    expect(priorityGroup).toBeDefined();

    const priorities = walkElements(priorityGroup)
      .filter((element) => element.type === "code")
      .map((element) => textContent(element));

    expect(priorities).toEqual(["ROUTINE", "URGENT"]);
  });

  it("T76-08 integra las dos visitas guiadas con seis pasos seleccionables", () => {
    const guides = pageElements.filter((element) => element.type === HelpGuide);
    expect(guides.map((guide) => guide.props.mode)).toEqual(["file", "text"]);

    const expectedGuides = [
      { mode: "file" as const, heading: "Procesar un archivo", steps: expectedFileSteps, image: "procedimiento-archivo.png" },
      { mode: "text" as const, heading: "Procesar texto", steps: expectedTextSteps, image: "procedimiento-texto.png" },
    ];

    for (const guide of expectedGuides) {
      const markup = guideMarkup(guide.mode);
      expect(markup).toContain(`<h3>${guide.heading}</h3>`);
      expect(markup).toContain(guide.image);
      expect(markup.match(/<li>/g)).toHaveLength(6);
      expect(markup.match(/class="help-guide__step"/g)).toHaveLength(6);
      for (const step of guide.steps) expect(markup).toContain(`<strong>${step}</strong>`);
      expect(markup).toContain("Ampliar guía");
      expect(markup).not.toContain('role="dialog"');
    }
  });

  it("marca el paso activo y actualiza el resaltado según la modalidad", () => {
    const fileStepThree = guideMarkup("file", 2);
    const textStepThree = guideMarkup("text", 2);

    expect(fileStepThree.match(/aria-current="step"/g)).toHaveLength(1);
    expect(fileStepThree).toContain("help-guide__highlight");
    expect(fileStepThree).toContain("help-guide__arrow");
    expect(textStepThree).toContain("help-guide__highlight");
    expect(textStepThree).not.toContain("help-guide__arrow");
  });

  it("permite seleccionar individualmente un paso", () => {
    const onStepChange = vi.fn();
    const steps = HelpGuideSteps({ mode: "file", activeStep: 0, onStepChange });
    const buttons = walkElements(steps).filter((element) => element.type === "button");

    expect(buttons).toHaveLength(6);
    expect(buttons[0].props["aria-current"]).toBe("step");
    expect(buttons[1].props["aria-current"]).toBeUndefined();
    (buttons[2].props.onClick as () => void)();
    expect(onStepChange).toHaveBeenCalledWith(2);
  });

  it("usa el texto aprobado del paso final sin un resaltado falso", () => {
    const markup = guideMarkup("file", 5);

    expect(markup).toContain("Consulta el resultado");
    expect(markup).toContain("Al finalizar el procesamiento, MediFlow te llevará automáticamente a «Resultado».");
    expect(markup).not.toContain("help-guide__highlight");
    expect(markup).not.toContain("help-guide__arrow");
  });

  it("expone un modal accesible con cierre y controles de recorrido", () => {
    const intermediate = guideMarkup("file", 2, true);
    const finalStep = guideMarkup("text", 5, true);

    expect(intermediate).toContain('role="dialog"');
    expect(intermediate).toContain('aria-modal="true"');
    expect(intermediate).toContain(">Cerrar</button>");
    expect(intermediate).toContain(">Anterior</button>");
    expect(intermediate).toContain(">Siguiente</button>");
    expect(intermediate).toContain("Ampliar detalle");
    expect(finalStep).toContain(">Reiniciar</button>");
  });

  it("conecta apertura, cierre y controles del diálogo con sus acciones", () => {
    const actions = {
      onStepChange: vi.fn(),
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onRestart: vi.fn(),
      onToggleDetail: vi.fn(),
    };
    const closedView = HelpGuideView({ mode: "file", activeStep: 0, expanded: false, detailExpanded: false, ...actions });
    const openButton = walkElements(closedView).find((element) => textContent(element) === "Ampliar guía" && element.type === "button");
    (openButton?.props.onClick as () => void)();
    expect(actions.onOpen).toHaveBeenCalledOnce();

    const openView = HelpGuideView({ mode: "file", activeStep: 2, expanded: true, detailExpanded: false, ...actions });
    const buttons = walkElements(openView).filter((element) => element.type === "button");
    for (const [label, action] of [
      ["Cerrar", actions.onClose],
      ["Anterior", actions.onPrevious],
      ["Siguiente", actions.onNext],
      ["Ampliar detalle", actions.onToggleDetail],
    ] as const) {
      const button = buttons.find((candidate) => textContent(candidate) === label);
      (button?.props.onClick as () => void)();
      expect(action).toHaveBeenCalledOnce();
    }

    const finalView = HelpGuideView({ mode: "file", activeStep: 5, expanded: true, detailExpanded: false, ...actions });
    const restart = walkElements(finalView).find((element) => element.type === "button" && textContent(element) === "Reiniciar");
    (restart?.props.onClick as () => void)();
    expect(actions.onRestart).toHaveBeenCalledOnce();
  });

  it("T76-09 registra /help dentro de AppLayout con HelpPage", () => {
    type RouteConfig = { path?: string; element?: ReactNode; children?: RouteConfig[] };
    const provider = AppRoutes() as ReactElement<{ router: { routes: RouteConfig[] } }>;
    const routes = provider.props.router.routes;
    const layoutRoute = routes.find(
      (route) => isValidElement(route.element) && route.element.type === AppLayout,
    );
    const helpRoute = layoutRoute?.children?.find((route) => route.path === "help");

    expect(layoutRoute).toBeDefined();
    expect(helpRoute).toBeDefined();
    expect(isValidElement(helpRoute?.element)).toBe(true);
    expect((helpRoute?.element as ReactElement).type).toBe(HelpPage);
  });

  it("enlaza las preguntas de apariencia con Configuración cuando corresponde", () => {
    const appearanceQuestions = expectedFaqs.slice(-4);
    const details = pageElements.filter((element) => element.type === "details");

    for (const question of appearanceQuestions) {
      const detail = details.find((candidate) => {
        const summary = walkElements(candidate).find((element) => element.type === "summary");
        return summary ? textContent(summary) === question : false;
      });
      expect(detail).toBeDefined();
    }

    const settingsLinks = details
      .flatMap((detail) => walkElements(detail))
      .filter((element) => element.type === Link && element.props.to === "/settings");
    expect(settingsLinks).toHaveLength(3);
    expect(settingsLinks.every((link) => textContent(link) === "Configuración")).toBe(true);
  });

  it("T76-10 habilita Centro de ayuda y Configuración, y conecta el cierre móvil", () => {
    const onNavigate = vi.fn();
    const sidebar = AppSidebar({
      id: "test-sidebar",
      collapsed: false,
      mobile: true,
      onNavigate,
    });
    const items = walkElements(sidebar).filter(
      (element) => element.type === SidebarNavItem,
    );
    const helpItem = items.find((element) => element.props.label === "Centro de ayuda");
    const settingsItem = items.find((element) => element.props.label === "Configuración");

    expect(helpItem?.props.to).toBe("/help");
    expect(helpItem?.props.disabled).not.toBe(true);
    expect(helpItem?.props.onClick).toBe(onNavigate);
    expect(settingsItem?.props.to).toBe("/settings");
    expect(settingsItem?.props.disabled).not.toBe(true);

    const renderedHelpItem = SidebarNavItem(helpItem?.props as never);
    const clickableNode = walkElements(renderedHelpItem).find(
      (element) => element.props.onClick === onNavigate,
    );
    expect(clickableNode).toBeDefined();
  });

  it("explica las limitaciones del MVP sin afirmar una integración hospitalaria efectiva", () => {
    const aboutSection = pageElements.find((element) => element.props.id === "about");
    const aboutText = textContent(aboutSection);

    expect(aboutText).toContain("datos clínicos sintéticos");
    expect(aboutText).toContain("simula el envío de documentos a distintas áreas hospitalarias");
    expect(aboutText).toContain("no los envía realmente ni está conectado con sistemas hospitalarios externos");
    expect(aboutText).toContain("no sustituyen la evaluación de profesionales de salud");
    expect(aboutText).not.toContain("envía documentos a hospitales");
    expect(aboutText).not.toContain("atiende pacientes reales");
  });

  it("presenta exactamente los ocho problemas aprobados en el orden indicado", () => {
    const problemsSection = pageElements.find((element) => element.props.id === "problems");
    const problemList = walkElements(problemsSection).find(
      (element) => element.props.className === "help-page__problem-list",
    );
    const problems = walkElements(problemList)
      .filter((element) => element.type === "li")
      .map((problem) => {
        const elements = walkElements(problem);
        const title = elements.find((element) => element.type === "h3");
        const description = elements.find((element) => element.type === "p");
        return [textContent(title), textContent(description)];
      });

    expect(problems).toEqual(expectedProblems);
    expect(textContent(problemsSection)).not.toContain("Problemas que puedes corregir");
    expect(textContent(problemsSection)).not.toContain("Problemas técnicos o internos");
    expect(textContent(problemsSection)).not.toContain("Estados que requieren atención o revisión");

    const problemLinks = walkElements(problemsSection)
      .filter((element) => element.type === Link)
      .map((element) => ({ to: element.props.to, label: textContent(element) }));
    expect(problemLinks).toEqual([
      { to: "/audit", label: "Auditoría" },
      { to: "/audit", label: "Auditoría" },
      { to: "/audit", label: "Auditoría" },
      { to: "/history", label: "Historial" },
    ]);
  });

  it("define navegación interna hacia Procesamiento, Auditoría, Historial y Configuración", () => {
    const routeLinks = pageElements
      .filter((element) => element.type === Link)
      .map((element) => ({ to: element.props.to, label: textContent(element) }));

    expect(routeLinks).toEqual([
      { to: "/processing", label: "Procesamiento" },
      { to: "/audit", label: "Auditoría" },
      { to: "/audit", label: "Auditoría" },
      { to: "/audit", label: "Auditoría" },
      { to: "/audit", label: "Auditoría" },
      { to: "/history", label: "Historial" },
      { to: "/history", label: "Historial" },
      { to: "/settings", label: "Configuración" },
      { to: "/settings", label: "Configuración" },
      { to: "/settings", label: "Configuración" },
    ]);

    const processingAction = pageElements.find(
      (element) => element.props.className === "help-page__section-action",
    );
    expect(textContent(processingAction)).toBe(
      "Utiliza las siguientes guías o ve a Procesamiento para comenzar.",
    );

    const auditSection = pageElements.find((element) => element.props.id === "audit");
    expect(textContent(auditSection)).toContain("acceder a Revisión Clínica");
    expect(textContent(auditSection)).toContain("consultar el documento original");
    expect(textContent(auditSection)).toContain("corregir los campos permitidos");
    expect(textContent(auditSection)).toContain("aprobar o rechazar el documento");
  });
});

describe("Ticket #76 - Volver arriba", () => {
  it("permanece oculto al inicio de la página", () => {
    const page = HelpPageContent({ showBackToTop: false });
    const buttons = walkElements(page).filter((element) => element.type === "button");

    expect(buttons.some((button) => button.props["aria-label"] === "Volver al inicio")).toBe(false);
    expect(shouldShowBackToTop(0)).toBe(false);
    expect(shouldShowBackToTop(BACK_TO_TOP_SCROLL_THRESHOLD)).toBe(false);
  });

  it("aparece al superar el umbral con nombre accesible", () => {
    const onBackToTop = vi.fn();
    const page = HelpPageContent({ showBackToTop: true, onBackToTop });
    const button = walkElements(page).find(
      (element) => element.type === "button" && element.props["aria-label"] === "Volver al inicio",
    );

    expect(shouldShowBackToTop(BACK_TO_TOP_SCROLL_THRESHOLD + 1)).toBe(true);
    expect(button).toBeDefined();
    expect(button?.props.type).toBe("button");
    expect(button?.props.onClick).toBe(onBackToTop);
  });

  it("vuelve a top 0 con movimiento suave por defecto", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("window", { scrollTo });

    scrollHelpPageToTop(false);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    vi.unstubAllGlobals();
  });

  it("evita el movimiento suave cuando el usuario prefiere movimiento reducido", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("window", { scrollTo });

    scrollHelpPageToTop(true);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    vi.unstubAllGlobals();
  });
});
