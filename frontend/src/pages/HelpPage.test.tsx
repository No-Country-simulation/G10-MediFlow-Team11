import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
import HelpPage, { HelpPageContent } from "./HelpPage";

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

describe("Ticket #76 - Centro de ayuda", () => {
  const page = HelpPageContent({});
  const pageElements = walkElements(page);

  it("T76-01 renderiza HelpPage con el encabezado oficial", () => {
    const markup = renderToStaticMarkup(page);

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

  it("T76-04 contiene las ocho preguntas frecuentes aprobadas", () => {
    const details = pageElements.filter((element) => element.type === "details");
    const questions = details.map((detail) => {
      const summary = walkElements(detail).find((element) => element.type === "summary");
      return summary ? textContent(summary) : "";
    });

    expect(questions).toEqual(expectedFaqs);
  });

  it("T76-05 usa disclosures nativos cerrados inicialmente", () => {
    const details = pageElements.filter((element) => element.type === "details");

    expect(details).toHaveLength(8);
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

  it("T76-08 muestra ambas guías y permite abrirlas en tamaño completo", () => {
    const images = pageElements.filter((element) => element.type === "img");
    expect(images).toHaveLength(2);

    for (const image of images) {
      expect(image.props.src).toMatch(/guia-(archivo|texto)\.png$/);
      expect(image.props.alt).toEqual(expect.any(String));
      expect(String(image.props.alt).length).toBeGreaterThan(30);

      const matchingLinks = pageElements.filter(
        (element) =>
          element.type === "a" &&
          element.props.href === image.props.src &&
          element.props.target === "_blank" &&
          element.props.rel === "noreferrer",
      );
      expect(matchingLinks).toHaveLength(2);
    }
  });

  it("T76-09 registra /help dentro de AppLayout con HelpPage", () => {
    const routeElements = walkElements(AppRoutes()).filter(
      (element) => element.props.path !== undefined || element.props.element !== undefined,
    );
    const layoutRoute = routeElements.find(
      (element) => isValidElement(element.props.element) && element.props.element.type === AppLayout,
    );
    const helpRoute = routeElements.find((element) => element.props.path === "help");

    expect(layoutRoute).toBeDefined();
    expect(helpRoute).toBeDefined();
    expect(isValidElement(helpRoute?.props.element)).toBe(true);
    expect((helpRoute?.props.element as ReactElement).type).toBe(HelpPage);
    expect(walkElements(layoutRoute).some((element) => element === helpRoute)).toBe(true);
  });

  it("T76-10 habilita Centro de ayuda, mantiene Configuración deshabilitada y conecta el cierre móvil", () => {
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
    expect(helpItem?.props.disabled).toBe(false);
    expect(helpItem?.props.onClick).toBe(onNavigate);
    expect(settingsItem?.props.to).toBeUndefined();
    expect(settingsItem?.props.disabled).toBe(true);

    const renderedHelpItem = SidebarNavItem(helpItem?.props as never);
    const clickableNode = walkElements(renderedHelpItem).find(
      (element) => element.props.onClick === onNavigate,
    );
    expect(clickableNode).toBeDefined();
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
