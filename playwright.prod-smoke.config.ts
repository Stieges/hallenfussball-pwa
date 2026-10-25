import { defineConfig } from '@playwright/test';

/**
 * Rauchtest nach dem Deploy GEGEN DIE PRODUKTION (Paket „Testwelle 1 vorbereiten“).
 *
 * Kein Dev-Server, kein lokaler Stack: die Adresse kommt aus PROD_SMOKE_BASE_URL (Vorgabe: die Vercel-Produktion),
 * das Testkonto aus PROD_SMOKE_EMAIL / PROD_SMOKE_PASSWORD (Schlüsselbund bzw. CI-Secrets, nie in Dateien).
 * Erlaubt bis 15.11.2026, nur mit Testkonto und eigenem, eindeutig benanntem Wegwerf-Turnier („ZZ-Rauchtest-…“).
 *
 * Lauf lokal: bash scripts/prod-smoke.sh   (liest das Passwort aus dem Schlüsselbund)
 */
const BASE_URL = process.env.PROD_SMOKE_BASE_URL ?? 'https://hallenfussball-pwa.vercel.app';

export default defineConfig({
  testDir: './tests/e2e/prod-smoke',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  outputDir: 'test-results/prod-smoke',
  use: {
    baseURL: BASE_URL,
    locale: 'de-DE',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'prod-smoke' }],
});
