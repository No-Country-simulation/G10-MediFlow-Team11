import { describe, expect, it } from "vitest";
import { getContrastRatio } from "@mui/material/styles";
import { DARK_PRIMARY_FOCUS_RIPPLE_OPACITY, theme } from "./theme";

describe("MediFlow theme contract", () => {
  it("preserves the existing light palette and typography", () => {
    const palette = theme.colorSchemes.light?.palette;
    expect(palette?.primary.main).toBe("#1570EF");
    expect(palette?.text.primary).toBe("#0F1A3D");
    expect(palette?.text.secondary).toBe("#4B5576");
    expect(palette?.background).toMatchObject({
      default: "#F1F5FB",
      paper: "#FFFFFF",
      sidebar: "#F5F9FE",
    });
    expect(palette?.divider).toBe("rgba(15, 26, 61, 0.09)");
    expect(theme.typography.fontFamily).toContain('"Inter"');
    expect(theme.typography.button.textTransform).toBe("none");
  });

  describe.each(["light", "dark"] as const)("%s semantic colors", (mode) => {
    const colors = theme.colorSchemes[mode]?.palette.mediflow;
    if (!colors) throw new Error(`Missing MediFlow colors: ${mode}`);

    it.each([
      ["primary text", colors.textPrimary, colors.surface],
      ["secondary text", colors.textSecondary, colors.surface],
      ["text on muted surfaces", colors.textOnMuted, colors.surfaceMuted],
      ["action", colors.onAction, colors.action],
      ["action hover", colors.onAction, colors.actionHover],
      ["information", colors.infoText, colors.infoSurface],
      ["success", colors.successText, colors.successSurface],
      ["warning", colors.warningText, colors.warningSurface],
      ["error", colors.errorText, colors.errorSurface],
      ["tooltip", colors.tooltipText, colors.tooltipSurface],
    ])("keeps %s above AA for normal text", (_label, foreground, background) => {
      expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    });

    it("provides a visible focus indicator against its offset surface", () => {
      expect(getContrastRatio(colors.focus, colors.focusOffset)).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("appearance wiring and semantic roles", () => {
  it("generates explicit light and dark attribute selectors", () => {
    expect(theme.colorSchemeSelector).toBe('[data-mediflow-color-scheme="%s"]');
    expect(theme.getColorSchemeSelector("dark")).toContain('data-mediflow-color-scheme="dark"');
    expect(theme.vars.palette.mediflow.surface).toContain("--mui-palette-mediflow-surface");
  });

  it("keeps dark MUI primary readable both as text and as a contained fill", () => {
    const palette = theme.colorSchemes.dark!.palette;
    for (const surface of [palette.background.default, palette.background.paper, palette.mediflow.surfaceMuted]) {
      expect(getContrastRatio(palette.primary.main, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(getContrastRatio(palette.primary.contrastText, palette.primary.main)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(palette.primary.contrastText, palette.primary.dark)).toBeGreaterThanOrEqual(4.5);
    expect(palette.mediflow.action).toBe("#006cff");
    expect(palette.mediflow.onAction).toBe("#ffffff");
  });

  it.each(["light", "dark"] as const)("uses the on-muted role for %s muted and selected surfaces", (mode) => {
    const colors = theme.colorSchemes[mode]!.palette.mediflow;
    expect(getContrastRatio(colors.textOnMuted, colors.surfaceMuted)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(colors.textOnMuted, colors.actionSurface)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(colors.actionText, colors.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

it("keeps dark primary buttons AA beneath simultaneous hover and persistent focus ripple", () => {
  const colors = theme.colorSchemes.dark!.palette.mediflow;
  const rgb = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const text = rgb(colors.actionText);
  const hover = theme.colorSchemes.dark!.palette.action.hoverOpacity;
  const opacity = hover + (1 - hover) * DARK_PRIMARY_FOCUS_RIPPLE_OPACITY;
  for (const surface of [colors.surface, colors.surfaceMuted, colors.actionSurface]) {
    const background = rgb(surface).map((channel, index) => text[index] * opacity + channel * (1 - opacity));
    expect(getContrastRatio(colors.actionText, `rgb(${background.join(", ")})`)).toBeGreaterThanOrEqual(4.5);
  }
  const primary = theme.colorSchemes.dark!.palette.primary;
  const ink = rgb(primary.contrastText);
  const fill = rgb(primary.dark).map((channel, index) => ink[index] * DARK_PRIMARY_FOCUS_RIPPLE_OPACITY + channel * (1 - DARK_PRIMARY_FOCUS_RIPPLE_OPACITY));
  expect(getContrastRatio(primary.contrastText, `rgb(${fill.join(", ")})`)).toBeGreaterThanOrEqual(4.5);
});

it.each(["light", "dark"] as const)("provides AA shell text on %s navigation states", (mode) => {
  const colors = theme.colorSchemes[mode]!.palette.mediflow;
  const values = colors.navigationSelected.match(/[\d.]+/g)?.map(Number);
  const selected = colors.navigationSelected.startsWith("rgba") && values
    ? `rgb(${values.slice(0, 3).map((channel) => channel * values[3] + 255 * (1 - values[3])).join(", ")})`
    : colors.navigationSelected;
  expect(getContrastRatio(colors.actionText, selected)).toBeGreaterThanOrEqual(4.5);
  expect(getContrastRatio(colors.navigationTextOnSelected, selected)).toBeGreaterThanOrEqual(4.5);
  expect(getContrastRatio(colors.textPrimary, colors.navigationSurface)).toBeGreaterThanOrEqual(4.5);
  if (mode === "light") {
    expect(getContrastRatio(colors.navigationTextOnSelected, "rgb(224.4, 224.4, 224.4)")).toBeGreaterThanOrEqual(4.5);
  }
});

it("preserves inherited clinical canvases until each view is migrated", () => {
  expect(theme.colorSchemes.light!.palette.mediflow.legacyContentSurface).toBe("#fafafa");
  expect(theme.colorSchemes.dark!.palette.mediflow.legacyContentSurface).toBe("#fafafa");
});

it("keeps Processing's dark text, placeholder and control boundaries readable", () => {
  const colors = theme.colorSchemes.dark!.palette.mediflow;
  expect(getContrastRatio(colors.textSecondary, colors.surfaceMuted)).toBeGreaterThanOrEqual(4.5);
  expect(getContrastRatio(colors.actionText, colors.actionSurface)).toBeGreaterThanOrEqual(4.5);
  expect(getContrastRatio(colors.borderStrong, colors.surface)).toBeGreaterThanOrEqual(3);
  expect(theme.colorSchemes.light!.palette.mediflow.illustrationPaper).toBe("#f5f5f5");
  expect(theme.colorSchemes.light!.palette.mediflow.illustrationDetail).toBe("#dce0e6");
});
