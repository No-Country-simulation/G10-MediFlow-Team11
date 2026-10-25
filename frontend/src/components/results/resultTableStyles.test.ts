import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getContrastRatio } from "@mui/material/styles";
import { theme } from "../../theme/theme";

const resultPageCss = readFileSync(
  new URL("../../styles/result-page.css", import.meta.url),
  "utf8",
);
const resultCardsCss = readFileSync(
  new URL("../../styles/result-cards.css", import.meta.url),
  "utf8",
);

const MIN_HEADER_CONTRAST = 5;

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`Falta la regla ${selector}`);
  return match[1];
}

function lightToken(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`).exec(resultPageCss);
  if (!match) throw new Error(`Falta el token claro --${name}`);
  return match[1];
}

function darkBlock(): string {
  return ruleBody(resultPageCss, '[data-mediflow-color-scheme="dark"] .result-page');
}

describe("encabezado de las tablas de Resultado", () => {
  const header = ruleBody(resultCardsCss, ".result-table__table thead th");

  it("usa los tokens de texto neutro y de superficie atenuada de la página", () => {
    expect(header).toContain("color: var(--res-neutral-text);");
    expect(header).toContain("background: var(--res-surface-muted);");
  });

  it("alcanza al menos 5:1 de contraste en el tema claro", () => {
    const ratio = getContrastRatio(
      lightToken("res-neutral-text"),
      lightToken("res-surface-muted"),
    );

    expect(ratio).toBeGreaterThanOrEqual(MIN_HEADER_CONTRAST);
  });

  it("alcanza al menos 5:1 de contraste en el tema oscuro", () => {
    const dark = darkBlock();
    const colors = theme.colorSchemes.dark?.palette.mediflow;
    if (!colors) throw new Error("Faltan los colores del tema oscuro");

    expect(dark).toContain("--res-neutral-text: var(--mui-palette-mediflow-textSecondary);");
    expect(dark).toContain("--res-surface-muted: var(--mui-palette-mediflow-surfaceMuted);");
    expect(getContrastRatio(colors.textSecondary, colors.surfaceMuted)).toBeGreaterThanOrEqual(
      MIN_HEADER_CONTRAST,
    );
  });
});
