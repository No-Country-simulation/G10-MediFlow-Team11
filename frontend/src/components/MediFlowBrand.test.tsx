import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
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
    expect(markup).toContain(`mediflow-horizontal-compact-${mode}.png`);
    expect(markup).toContain('alt="MediFlow"');
    expect(markup).toContain('width="578" height="140"');
    expect(markup).not.toContain(".svg");
  });

  it.each(["light", "dark"] as const)("loads an official %s PNG with matching intrinsic proportions", (mode) => {
    const asset = readFileSync(new URL(`../../public/brand/mediflow-horizontal-compact-${mode}.png`, import.meta.url));
    expect(asset.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect([asset.readUInt32BE(16), asset.readUInt32BE(20)]).toEqual([578, 140]);
  });
});
