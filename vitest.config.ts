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
  'src/features/tournament-management/hooks/__tests__/useScheduleTabActions.test.ts',
  'src/hooks/__tests__/useMatchExecution.realtime.test.ts',
  'src/hooks/__tests__/useMatchExecution.test.ts',
  'src/hooks/__tests__/useMatchTimer.test.ts',
  'src/hooks/__tests__/useTournamentManager.applyRemote.test.ts',
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
    // Vitest 5 Default (true): Mock-Aufrufe/-Ergebnisse werden vor jedem Test
    // automatisch geleert (mock.calls/results), nicht aber Implementierungen
    // (mockRestore bleibt aus). Verhindert Mock-Leck zwischen Tests innerhalb
    // derselben Datei. Alle 1406 Tests liefen bereits vorher unabhängig vom
    // Wert dieser Einstellung grün — keine Datei war auf übrig gebliebenen
    // Mock-Zustand angewiesen (T7b, 2026-09-24, dreifach verifiziert).
    clearMocks: true,
    // Zwei Projekte: node-Tests laufen ohne jsdom-Overhead (siehe T7b-Report für
    // die Messung), DOM-Tests (Komponenten, Hooks mit window/document/
    // localStorage/IndexedDB) bleiben in jsdom mit eigenem, zusätzlichem Setup.
    projects: [
      {
        test: {
          name: 'unit-node',
          environment: 'node',
          // scripts/** und tests/e2e/cloud/__tests__/**: Task T2 (Testumgebung) — Produktions-
          // Sperre (scripts/lib/assertLocalSupabaseTarget.ts) und Registrierungscode-Gleichlauf
          // (tests/e2e/cloud/testData.ts) brauchen einen echten Vitest-Lauf, kein Playwright.
          // NUR __tests__/ (nicht tests/e2e/cloud/**), weil Task T3 unter tests/e2e/cloud/
          // echte PLAYWRIGHT-Specs hinzugefügt hat (smoke.spec.ts, auth.setup.ts) — die breitere
          // Variante ließ Vitest smoke.spec.ts laden und mit "Playwright Test did not expect
          // test.describe() to be called here" abstürzen (reproduziert vor dieser Änderung).
          include: [
            'src/**/*.{test,spec}.ts',
            'scripts/**/*.{test,spec}.ts',
            'tests/e2e/cloud/__tests__/**/*.{test,spec}.ts',
          ],
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
      // Untergrenze aus gemessener Baseline (T7b, 2026-09-24, `npm run test:coverage`):
      // Statements 42.89 %, Branches 35.36 %, Functions 35.53 %, Lines 43.79 %.
      // Je Wert auf ganze Prozent abgerundet und 1 Punkt darunter, damit normales
      // Messrauschen die CI nicht bricht. Absichtlich niedrig (keine Zielmarke) —
      // schützt nur vor Regression unter das heute gemessene Niveau.
      thresholds: {
        statements: 41,
        branches: 34,
        functions: 34,
        lines: 42,
      },
    },
  },
})
