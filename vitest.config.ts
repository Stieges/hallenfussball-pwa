import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register': new URL('./src/test/mocks/virtual-pwa-register.ts', import.meta.url)
        .pathname,
    },
  },
  // Match vite.config.ts: same compile-time identifier referenced by Sentry
  // release tag and boot-context telemetry. Tests get a fixed sentinel value
  // so assertions don't depend on environment state.
  define: {
    __BUILD_HASH__: JSON.stringify('test-build'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      // Thresholds bewusst NICHT gesetzt (M0, 2026-09-17): Es gibt noch keine Baseline.
      // Erst messen, dann Schwellen — sonst blockiert ein Wert, den nie jemand gemessen hat.
      // Wiedereinführen, sobald docs/TODO.md eine gemessene Baseline nennt.
    },
  },
})
