import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import lightBrand from "../../public/brand/mediflow-horizontal-compact.svg?raw";
import darkBrand from "../../public/brand/mediflow-horizontal-compact-dark.svg?raw";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../theme/theme";
import MediFlowBrand from "./MediFlowBrand";

describe("MediFlow brand appearance", () => {
  it.each(["light", "dark"] as const)("selects the %s asset through MUI", (mode) => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={theme} defaultMode={mode} storageManager={null} noSsr forceThemeRerender>
        <MediFlowBrand />
      </ThemeProvider>,
    );
    expect(markup).toContain(`mediflow-horizontal-compact${mode === "dark" ? "-dark" : ""}.svg`);
    expect(markup).toContain('alt="MediFlow"');
  });

  it("changes only the wordmark fill, preserving the official symbol and geometry", () => {
    expect(darkBrand.replace('fill="#f3f6fc"', 'fill="#111827"')).toBe(lightBrand);
  });
});
