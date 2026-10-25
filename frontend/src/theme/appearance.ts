import { useColorScheme } from "@mui/material/styles";

export type AppearancePreference = "light" | "dark" | "system";
export const APPEARANCE_STORAGE_KEY = "mediflow.appearance.v1";
export const DEFAULT_APPEARANCE: AppearancePreference = "system";

export function useAppearance() {
  const { mode, systemMode, setMode } = useColorScheme();

  return {
    preference: mode,
    resolvedMode: mode === "system" ? systemMode : mode,
    setPreference: (preference: AppearancePreference) => setMode(preference),
  };
}
