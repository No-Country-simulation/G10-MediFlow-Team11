import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import HomePage from "./HomePage";

describe("HomePage", () => {
  it.each(["light", "dark"] as const)("exposes the Home actions and informative cards in %s mode", (mode) => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <MemoryRouter><HomePage /></MemoryRouter>
      </ThemeProvider>,
    );
    expect(markup).toContain(`data-color-mode="${mode}"`);
    expect(markup).toMatch(/<h1[^>]*>MediFlow clasifica documentos clínicos <span>con IA\.<\/span><\/h1>/);
    expect(markup).toMatch(/<a[^>]*href="\/processing"[^>]*>Cargar documento /);
    expect(markup).toMatch(/<a[^>]*href="\/audit"[^>]*>.*?Revisar casos pendientes/);
    expect(markup.match(/<article\b/g)).toHaveLength(3);
    expect(markup).toContain("Los documentos dudosos o incompletos esperan en Auditoría.");
    expect(markup).toContain("Consulte el resultado de cada documento y las decisiones de revisión registradas.");
  });
});
