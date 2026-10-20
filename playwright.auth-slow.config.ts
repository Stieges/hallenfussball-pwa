import { defineConfig } from '@playwright/test';

/**
 * C-SITZUNG-STILL (Anmelden Ü1.2/Ü1.3, @AN-019, @AN-021, @AN-032): eigener Lauf für die Auth-Hinweise.
 *
 * Der Dev-Server bekommt eine ERFUNDENE Supabase-Adresse (127.0.0.1:59999, dort lauscht nichts);
 * jede Antwort liefert der Test selbst per `page.route`. Weder die Produktion noch der lokale
 * Supabase-Stack werden berührt. Prozess-Variablen schlagen `.env*` (Vite), die Dateien werden nicht gelesen.
 *
 * Lauf: npx playwright test -c playwright.auth-slow.config.ts
 */
const PORT = '3200';

export default defineConfig({
  testDir: './tests/e2e/auth-slow',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'handy-360x640', use: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true } },
    { name: 'laptop-1280x720', use: { viewport: { width: 1280, height: 720 } } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:59999',
      VITE_SUPABASE_ANON_KEY: 'e2e-fake-anon-key',
    },
  },
});
