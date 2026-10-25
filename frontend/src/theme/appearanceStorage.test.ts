import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE } from "./appearance";
import { appearanceStorageManager, normalizeAppearance } from "./appearanceStorage";

const values = new Map<string, string>();
let events: EventTarget;

beforeEach(() => {
  values.clear();
  events = new EventTarget();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  });
});
afterEach(() => vi.unstubAllGlobals());

function storageEvent(value: string | null, key: string | null = APPEARANCE_STORAGE_KEY) {
  events.dispatchEvent(Object.assign(new Event("storage"), { key, newValue: value }));
}

describe("appearance storage boundary", () => {
  it("keeps the project's key and system default stable", () => {
    expect(APPEARANCE_STORAGE_KEY).toBe("mediflow.appearance.v1");
    expect(DEFAULT_APPEARANCE).toBe("system");
    expect(appearanceStorageManager({ key: APPEARANCE_STORAGE_KEY }).get(DEFAULT_APPEARANCE)).toBe("system");
    expect(values.has(APPEARANCE_STORAGE_KEY)).toBe(false);
  });

  it.each(["light", "dark", "system"])("preserves valid %s preferences", (value) => {
    values.set(APPEARANCE_STORAGE_KEY, value);
    expect(normalizeAppearance(value)).toBe(value);
    expect(appearanceStorageManager({ key: APPEARANCE_STORAGE_KEY }).get(DEFAULT_APPEARANCE)).toBe(value);
  });

  it.each(["", "invalid", "DARK", "null", null, undefined, 5])("normalizes %s to system", (value) => {
    expect(normalizeAppearance(value)).toBe("system");
    if (typeof value === "string") values.set(APPEARANCE_STORAGE_KEY, value);
    const storage = appearanceStorageManager({ key: APPEARANCE_STORAGE_KEY });
    expect(storage.get(DEFAULT_APPEARANCE)).toBe("system");
    if (typeof value === "string") expect(values.get(APPEARANCE_STORAGE_KEY)).toBe("system");
  });

  it("writes valid preferences and validates writes before MUI reloads", () => {
    const storage = appearanceStorageManager({ key: APPEARANCE_STORAGE_KEY });
    storage.set("dark");
    expect(values.get(APPEARANCE_STORAGE_KEY)).toBe("dark");
    storage.set("invalid");
    expect(values.get(APPEARANCE_STORAGE_KEY)).toBe("system");
  });

  it("normalizes external values, handles clearing and unsubscribes", () => {
    const handler = vi.fn();
    const unsubscribe = appearanceStorageManager({ key: APPEARANCE_STORAGE_KEY }).subscribe(handler);
    storageEvent("invalid");
    expect(handler).toHaveBeenLastCalledWith("system");
    expect(values.get(APPEARANCE_STORAGE_KEY)).toBe("system");
    storageEvent("dark");
    expect(handler).toHaveBeenLastCalledWith("dark");
    storageEvent(null, null);
    expect(handler).toHaveBeenLastCalledWith("system");
    storageEvent("ignored", "other-key");
    expect(handler).toHaveBeenCalledTimes(3);
    unsubscribe();
    storageEvent("light");
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("does not reinterpret MUI's color scheme storage keys", () => {
    const storage = appearanceStorageManager({ key: "mui-color-scheme-light" });
    storage.set("light");
    expect(storage.get("fallback")).toBe("light");
  });

  it("tolerates blocked reads and writes", () => {
    vi.stubGlobal("window", {
      get localStorage() { throw new Error("blocked"); },
    });
    const storage = appearanceStorageManager({ key: APPEARANCE_STORAGE_KEY });
    expect(storage.get(DEFAULT_APPEARANCE)).toBe("system");
    expect(() => storage.set("dark")).not.toThrow();
  });
});
