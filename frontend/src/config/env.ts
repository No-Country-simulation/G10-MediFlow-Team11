const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const useMocks = import.meta.env.VITE_USE_MOCKS === "true";

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

export const env = {
  apiBaseUrl,
  useMocks,
} as const;
