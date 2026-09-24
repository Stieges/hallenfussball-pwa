import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// *.test.ts-Dateien (keine .tsx), die trotz der .ts-Endung window/document
// brauchen (Hooks/Services, die direkt auf window.addEventListener,
// matchMedia o.ä. zugreifen) und deshalb ins `dom`-Projekt gehören statt ins
// schnellere `unit-node`. Ermittelt durch Probelauf aller *.test.ts unter
// environment: 'node' (T7b, 2026-09-24) — keine Vermutung, sondern Messung.
const DOM_ONLY_TS_TESTS = [
  'src/core/realtime/__tests__/RealtimeService.test.ts',
  'src/core/services/TournamentCreationService.release.test.ts',
  'src/core/services/TournamentCreationService.test.ts',
  'src/core/services/__tests__/GenericMutationQueue.test.ts',
  'src/core/services/__tests__/MutationQueue.property.test.ts',
  'src/core/services/__tests__/MutationQueue.test.ts',
  'src/core/storage/__tests__/StorageFactory.test.ts',
  'src/core/storage/__tests__/StorageFallback.test.ts',
  'src/features/auth/context/__tests__/authActions.test.ts',
  'src/features/auth/hooks/__tests__/useMyTournamentRole.test.ts',
  'src/features/auth/hooks/__tests__/useRegisterForm.test.ts',
  'src/features/schedule-editor/hooks/__tests__/useMatchConflicts.test.ts',
  'src/features/schedule-editor/hooks/__tests__/useScheduleEditor.test.ts',
  'src/hooks/__tests__/useMatchExecution.realtime.test.ts',
  'src/hooks/__tests__/useMatchExecution.test.ts',
  'src/hooks/__tests__/useMatchTimer.test.ts',
  'src/hooks/__tests__/useMonitorTheme.test.ts',
  'src/lib/__tests__/lazyWithRetry.test.ts',
  'src/lib/__tests__/themeManager.test.ts',
]

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
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest 5 changed the default to true (auto-clears mock.calls/results
    // before each test). Pinned to the pre-5.0 default so test behaviour
    // does not shift silently with this upgrade (T7, siehe Migration Guide).
    clearMocks: false,
    // Zwei Projekte: node-Tests laufen ohne jsdom-Overhead (siehe T7b-Report für
    // die Messung), DOM-Tests (Komponenten, Hooks mit window/document/
    // localStorage/IndexedDB) bleiben in jsdom mit eigenem, zusätzlichem Setup.
    projects: [
      {
        test: {
          name: 'unit-node',
          environment: 'node',
          include: ['src/**/*.{test,spec}.ts'],
          exclude: [...DOM_ONLY_TS_TESTS],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.dom.ts'],
          include: ['src/**/*.{test,spec}.tsx', ...DOM_ONLY_TS_TESTS],
        },
      },
    ],
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
