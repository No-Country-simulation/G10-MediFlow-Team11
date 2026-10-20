import type { StorageManager } from "@mui/material/styles";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE } from "./appearance";

export function normalizeAppearance(value: unknown) {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : DEFAULT_APPEARANCE;
}

export const appearanceStorageManager: StorageManager = ({
  key,
  storageWindow = typeof window === "undefined" ? undefined : window,
}) => {
  const isPreference = key === APPEARANCE_STORAGE_KEY;
  function persist(value: string) {
    try {
      storageWindow?.localStorage.setItem(key, value);
    } catch {
      // MUI keeps the current selection in memory when storage is unavailable.
    }
  }
  return {
    get(defaultValue: unknown) {
      try {
        const value = storageWindow?.localStorage.getItem(key);
        if (value == null) return defaultValue;
        if (!isPreference) return value || defaultValue;
        const preference = normalizeAppearance(value);
        if (preference !== value) persist(preference);
        return preference;
      } catch {
        return defaultValue;
      }
    },
    set(value: unknown) {
      if (typeof value === "string") {
        persist(isPreference ? normalizeAppearance(value) : value);
      }
    },
    subscribe(handler: (value: string | null) => void) {
      if (!storageWindow) return () => {};
      const listener = (event: StorageEvent) => {
        if (event.key !== key && event.key !== null) return;
        if (!isPreference) {
          handler(event.newValue);
          return;
        }
        const preference = normalizeAppearance(event.newValue);
        if (event.newValue !== preference) persist(preference);
        handler(preference);
      };
      storageWindow.addEventListener("storage", listener);
      return () => storageWindow.removeEventListener("storage", listener);
    },
  };
};
