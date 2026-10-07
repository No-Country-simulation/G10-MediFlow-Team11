/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    env: {
      VITE_API_BASE_URL: "http://localhost:8080",
      VITE_USE_MOCKS: "false",
    },
  },
});
