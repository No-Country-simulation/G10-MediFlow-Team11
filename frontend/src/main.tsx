import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import "./index.css";
import App from "./App.tsx";
import { theme } from "./theme/theme";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE } from "./theme/appearance";
import { appearanceStorageManager } from "./theme/appearanceStorage";
import NotificationProvider from "./notifications/NotificationProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Keep existing theme.palette.mode consumers in sync without remounting. */}
    <ThemeProvider
      theme={theme}
      defaultMode={DEFAULT_APPEARANCE}
      modeStorageKey={APPEARANCE_STORAGE_KEY}
      storageManager={appearanceStorageManager}
      noSsr
      forceThemeRerender
    >
      <CssBaseline enableColorScheme />
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ThemeProvider>
  </StrictMode>,
);
