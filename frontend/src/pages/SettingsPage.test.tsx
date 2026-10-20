import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { SECONDARY_NAVIGATION } from "../config/navigation";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE } from "../theme/appearance";
import { appearanceStorageManager } from "../theme/appearanceStorage";
import { theme } from "../theme/theme";
import SettingsPage from "./SettingsPage";

describe("appearance settings integration", () => {
  it("enables only Settings in secondary navigation", () => {
    const settings = SECONDARY_NAVIGATION.find((item) => item.label === "Configuración");
    const help = SECONDARY_NAVIGATION.find((item) => item.label === "Centro de ayuda");
    expect(settings?.to).toBe("/settings");
    expect(settings?.disabled).not.toBe(true);
    expect(help?.disabled).toBe(true);
    expect(help?.to).toBeUndefined();
  });

  it("renders one native radio group with three uniquely labelled options", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={theme} defaultMode={DEFAULT_APPEARANCE}
        modeStorageKey={APPEARANCE_STORAGE_KEY} storageManager={appearanceStorageManager} noSsr forceThemeRerender>
        <SettingsPage />
      </ThemeProvider>,
    );
    expect(markup.match(/role="radiogroup"/g)).toHaveLength(1);
    expect(markup.match(/type="radio"/g)).toHaveLength(3);
    for (const option of ["light", "dark", "system"]) {
      expect(markup).toContain(`value="${option}"`);
      expect(markup).toContain(`-${option}-label`);
      expect(markup).toContain(`-${option}-description`);
    }
    expect(markup.match(/class="settings-page__preview"/g)).toHaveLength(3);
    expect(markup).toContain('aria-live="polite"');
  });
});
