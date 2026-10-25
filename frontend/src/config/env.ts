const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const useMocks = import.meta.env.VITE_USE_MOCKS === "true";

if (!configuredApiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not defined");
}

const localApi = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(configuredApiBaseUrl);
const apiBaseUrl = import.meta.env.DEV && !useMocks && localApi ? "" : configuredApiBaseUrl;

export const env = {
  apiBaseUrl,
  useMocks,
} as const;
