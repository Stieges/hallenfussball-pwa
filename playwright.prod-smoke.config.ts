import { defineConfig } from '@playwright/test';
import { pruefeAdresse, pruefeFrist } from './scripts/lib/prodSmokeGuards';

/**
 * Rauchtest nach dem Deploy GEGEN DIE PRODUKTION (Anforderung plattform/2026-10-25_rauchtest-nach-deploy.md, @RT-001 bis @RT-008).
 *
 * Kein Dev-Server, kein lokaler Stack: die Adresse kommt aus PROD_SMOKE_BASE_URL (Vorgabe: die Vercel-Produktion, nur
 * hallenfussball-pwa*.vercel.app erlaubt), das Testkonto aus PROD_SMOKE_EMAIL / PROD_SMOKE_PASSWORD (Schlüsselbund bzw.
 * CI-Secrets, nie in Dateien). PROD_SMOKE_MODE: "kurz" (Vorgabe, nur lesen) oder "voll" (Wegwerf-Turnier).
 * Erlaubt bis 15.11.2026; danach bricht schon das Laden dieser Datei ab (@RT-007).
 *
 * Keine Spur, kein Video: ein Trace enthielte Passwort und Sitzungs-Schlüssel im Klartext und das Repository ist öffentlich (@RT-006).
 *
 * Lauf lokal: bash scripts/prod-smoke.sh [kurz|voll]   (liest das Passwort aus dem Schlüsselbund)
 */
pruefeFrist();
const BASE_URL = process.env.PROD_SMOKE_BASE_URL ?? 'https://hallenfussball-pwa.vercel.app';
pruefeAdresse(BASE_URL);

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
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'prod-smoke' }],
});
