import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = environment.VITE_API_BASE_URL
  const localApi = apiUrl && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(apiUrl)
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      proxy: localApi && environment.VITE_USE_MOCKS !== 'true'
        ? { '/api/v1': { target: apiUrl, changeOrigin: false } }
        : undefined,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      isolate: true,
      server: {
        deps: {
          inline: ['vitest'],
        },
      },
    },
  }
})
