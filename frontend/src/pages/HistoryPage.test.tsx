import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { HistoryUnavailableState } from "./HistoryPage";

vi.mock("../config/env", () => ({
  env: { apiBaseUrl: "http://localhost:8080", useMocks: true },
}));

describe("HistoryUnavailableState", () => {
  it.each([
    ["El documento DOC-2026-0005 todavía no tiene eventos registrados.", false],
    ["No se encontró el historial del documento missing.", false],
    ["No fue posible cargar el historial.", true],
  ])("offers a way back to the document list for %s", (message, error) => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <HistoryUnavailableState
          message={message}
          error={error}
          onRetry={error ? () => undefined : undefined}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain(message);
    expect(markup).toContain('href="/history"');
    expect(markup).toContain("Volver al listado de documentos");
    expect(markup).toContain(error ? 'role="alert"' : 'role="status"');
    expect(markup.includes("Reintentar")).toBe(error);
  });
});
