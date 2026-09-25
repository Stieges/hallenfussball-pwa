import { defineConfig, devices } from '@playwright/test';
import { getLocalSupabaseStatus } from './scripts/lib/localSupabaseStatus';

// In CI with preview mode, Vite uses port 4173; otherwise dev server uses 3000
const usePreview = !!process.env.CI_E2E_USE_PREVIEW;
// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty PORT env var should use default
const PORT = process.env.PORT || (usePreview ? '4173' : '3000');
const baseURL = `http://localhost:${PORT}`;

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD-WEBSERVER (Task T3, .superpowers/sdd/2026-09-24-testumgebung/task-T3-brief.md)
// ═══════════════════════════════════════════════════════════════════════════
//
// Zweiter, unabhängiger Vite-Server auf Port 3100 GEGEN DEN LOKALEN SUPABASE-STACK (niemals
// gegen die Produktion — es gibt hier keinen Pfad zu einer Cloud-URL, nur `supabase status`
// gegen den lokalen Docker-Container dieses Repos, siehe scripts/lib/localSupabaseStatus.ts).
const CLOUD_PORT = '3100';
const cloudBaseURL = `http://localhost:${CLOUD_PORT}`;

/**
 * URL/Anon-Key des lokalen Supabase-Stacks für den `cloud`-Webserver — dieselbe Quelle wie
 * `scripts/e2e-seed.ts` (Brief: "Dieselbe Quelle wie das Seed-Skript"), keine hartkodierten
 * Werte.
 *
 * Playwright startet ALLE `webServer`-Einträge bei JEDEM Lauf, unabhängig von `--project`
 * (belegt: microsoft/playwright.dev, "Multiple web servers" — ein Array hat kein Konzept von
 * "gehört zu Projekt X"). Deshalb darf dieser Aufruf NIEMALS werfen, auch nicht wenn
 * `npm run test:e2e` (offline, von der CI erwartet) ohne laufenden lokalen Stack ausgeführt
 * wird — sonst bräche der komplette offline-Lauf. Fallback bei fehlendem Stack: leere Strings
 * (= identisch zum "kein Supabase konfiguriert"-Zustand, siehe src/lib/supabase.ts). Bewusst
 * KEIN hartkodierter "öffentlicher Standard-JWT" als Fallback (die zweite, im Brief genannte
 * Option) — der Supabase-CLI-Quellcode (Context7 /supabase/cli) zeigt, dass dieser JWT aus
 * `jwt_secret`+Claims neu signiert wird; ein von uns nachgebauter, ungeprüfter Wert wäre genau
 * die Art Annahme, die dieses Projekt explizit verbietet ("belegen, nicht annehmen"). Für echte
 * cloud-Läufe (`npm run test:e2e:cloud`) prüft `scripts/require-local-stack.sh` VOR diesem
 * Config-Load, dass ein Stack läuft — dann liefert der try-Zweig unten echte Werte.
 */
function getCloudSupabaseEnv(): { VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string } {
  try {
    const status = getLocalSupabaseStatus();
    return { VITE_SUPABASE_URL: status.url, VITE_SUPABASE_ANON_KEY: status.anonKey };
  } catch {
    return { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' };
  }
}

// Network Throttling Presets for performance testing
export const networkProfiles = {
  'fast-4g': {
    offline: false,
    downloadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps
    uploadThroughput: (750 * 1024) / 8, // 750 Kbps
    latency: 40,
  },
  'slow-3g': {
    offline: false,
    downloadThroughput: (500 * 1024) / 8, // 500 Kbps
    uploadThroughput: (250 * 1024) / 8, // 250 Kbps
    latency: 300,
  },
  offline: {
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL REGRESSION (Task T5, .superpowers/sdd/2026-09-24-testumgebung/task-T5-brief.md)
// ═══════════════════════════════════════════════════════════════════════════
//
// Basisverzeichnis für die eingecheckten Referenzbilder. Per Umgebungsvariable
// überschreibbar -- so kann lokal (ohne den offiziellen Playwright-Container, siehe Ruling Y der
// Task-T5-Vorgabe) gegen ein TEMPORÄRES Verzeichnis geprüft werden, ob Selektoren/Masken/
// page.clock greifen, ohne die eingecheckten, im Container erzeugten Vorlagen mit
// Mac-gerenderten Bildern zu überschreiben. Ohne die Variable (CI, `npm run test:visual[:update]`
// im Docker-Container) zeigt es auf den eingecheckten Ordner.
const VISUAL_SNAPSHOT_ROOT = process.env.VISUAL_SNAPSHOT_DIR ?? 'tests/e2e/visual/__screenshots__';

export default defineConfig({
  testDir: './tests/e2e',
  // Die cloud-Projekte (testDir: './tests/e2e/cloud', s.u.) haben ihre eigenen relativen Pfade
  // ohne "cloud"-Segment -- dieses testIgnore trifft deshalb nur die offline-Projekte (testDir
  // bleibt hier './tests/e2e', relative Pfade wie "cloud/smoke.spec.ts" matchen das Muster).
  // Ohne das würde Playwright hier auch tests/e2e/cloud/__tests__/*.test.ts (Vitest-Syntax,
  // Task T2) als Playwright-Test laden und mit "Cannot read properties of undefined (reading
  // 'config')" abstürzen (reproduziert vor dieser Änderung).
  //
  // "visual" ist hier bewusst NICHT mitausgeschlossen: die visual-*-Projekte unten setzen ihr
  // eigenes testDir/testMatch (wie die cloud-Projekte), und die bestehenden Breakpoint-/
  // Device-Projekte (mobile-sm, desktop, ...) laufen weiterhin nur gegen ihr eigenes,
  // unverändertes testDir -- ihr `testMatch` ist implizit "alles außer cloud", das schließt
  // tests/e2e/visual/**/*.visual.spec.ts nicht aus. Deshalb bekommen die Breakpoint-Projekte
  // unten zusätzlich ein explizites testIgnore für den visual-Ordner (Ruling Y, Punkt 1: die
  // Visual-Specs dürfen NICHT in den bestehenden E2E-Jobs mitlaufen -- andere Fonts/kein
  // Container dort liefern andere Pixel).
  testIgnore: ['**/cloud/**', '**/visual/**'],
  // Kein {platform}-Token (Ruling Y, Punkt 6): CI-Runner und der lokale Docker-Lauf sind BEIDE
  // derselbe Linux-Container (mcr.microsoft.com/playwright:v1.63.0-noble) -- ein
  // Plattform-Suffix würde hier nie zwischen zwei legitimen Quellen unterscheiden, nur
  // versehentlich verhindern, dass ein lokaler Mac-Lauf (siehe VISUAL_SNAPSHOT_ROOT oben) sich
  // als "gleich" ausgeben könnte. {projectName} bleibt nötig, weil visual-mobile/-tablet/-desktop
  // sonst denselben Dateinamen (z.B. "dashboard.png") träfen.
  snapshotPathTemplate: `${VISUAL_SNAPSHOT_ROOT}/{projectName}/{testFilePath}/{arg}{ext}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use 4 parallel workers in CI for faster execution (was 1)
  workers: process.env.CI ? 4 : undefined,

  // Global timeout: 60s in CI (cold-start variance), 30s locally
  timeout: process.env.CI ? 60000 : 30000,

  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL,
    // Force German locale so i18n's navigator.language detection picks 'de'.
    // Without this, CI runners report en-US and the app renders English while
    // most E2E selectors still target the German UI strings.
    locale: 'de-DE',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Action and navigation timeouts
    actionTimeout: process.env.CI ? 15000 : 10000,
    navigationTimeout: process.env.CI ? 30000 : 15000,
    // Disable Service Worker to prevent PWA cache conflicts in E2E tests
    // This avoids "Importing a module script failed" errors from stale chunks
    serviceWorkers: 'block',
  },

  expect: {
    // Expect timeout: 10s in CI, 5s locally
    timeout: process.env.CI ? 10000 : 5000,
    // Task T5 (Visual Regression): Animationen/Caret aus (sonst flackert jeder Lauf anders),
    // siehe Ruling im Brief ("Animationen aus (animations: 'disabled')"). Kleine Toleranz gegen
    // Sub-Pixel-Antialiasing-Rauschen, das selbst im selben Container zwischen zwei Läufen
    // auftreten kann (pragmatische Ingenieurs-Entscheidung, keine Brief-Vorgabe) -- 1% der
    // Pixel einer Seite, nicht mehr. Gilt global (auch für die bestehenden Projekte), betrifft
    // aber nur `toHaveScreenshot`-Aufrufe -- bislang ausschließlich in tests/e2e/visual/*.
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    },
  },

  projects: [
    // ═══════════════════════════════════════════════════════════════
    // BREAKPOINT-BASIERT (Primary) - Zeitlos, unabhängig von Geräten
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'mobile-sm',
      use: {
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    },
    {
      name: 'mobile-md',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'mobile-lg',
      use: {
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'tablet-portrait',
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'tablet-landscape',
      use: {
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 720 },
        isMobile: false,
        hasTouch: false,
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // NETWORK THROTTLING (für Performance-Tests)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'mobile-slow-3g',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        // Network Throttling via CDP in Tests
        launchOptions: {
          args: ['--enable-features=NetworkService'],
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // DEVICE-PRESETS (Secondary, für spezifische Regressionstests)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'iPhone-16',
      use: {
        ...devices['iPhone 15'], // Closest available in Playwright
        hasTouch: true,
      },
    },
    {
      name: 'Pixel-9',
      use: {
        ...devices['Pixel 7'], // Closest available in Playwright
        hasTouch: true,
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // CLOUD (Task T3) — gegen den LOKALEN Supabase-Stack, Port 3100.
    // testDir zeigt exklusiv auf tests/e2e/cloud; die offline-Projekte oben ignorieren
    // diesen Ordner (siehe testIgnore auf Config-Ebene).
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'cloud-setup',
      testDir: './tests/e2e/cloud',
      testMatch: /auth\.setup\.ts/,
      testIgnore: [],
      use: { baseURL: cloudBaseURL },
    },
    {
      name: 'cloud-desktop',
      testDir: './tests/e2e/cloud',
      // auth.setup.ts läuft nur im cloud-setup-Projekt; __tests__/ enthält Vitest- (nicht
      // Playwright-)Tests (registrationCodeParity.test.ts, Task T2) — ohne diesen Ausschluss
      // versucht Playwright, sie zu laden, und stürzt mit "Cannot read properties of undefined
      // (reading 'config')" ab (reproduziert).
      testIgnore: [/auth\.setup\.ts/, /__tests__\//],
      dependencies: ['cloud-setup'],
      use: {
        baseURL: cloudBaseURL,
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      name: 'cloud-mobile',
      testDir: './tests/e2e/cloud',
      testIgnore: [/auth\.setup\.ts/, /__tests__\//],
      dependencies: ['cloud-setup'],
      use: {
        baseURL: cloudBaseURL,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // VISUAL REGRESSION (Task T5) — Bildvergleiche, NUR im offiziellen Playwright-Container
    // (Ruling Y). testDir zeigt exklusiv auf tests/e2e/visual; die Breakpoint-/Device-/Cloud-
    // Projekte oben schließen diesen Ordner per testIgnore aus, laufen hier also nicht mit.
    //
    // deviceScaleFactor bewusst 1 (nicht wie mobile-md/tablet-portrait 2-3): für Visual-Diffs
    // zählt Bild-zu-Bild-Stabilität zwischen zwei Container-Läufen, nicht Geräte-Realismus —
    // ein DSF>1 vervielfacht nur Pixelzahl (und damit Diff-Fläche bei Sub-Pixel-Rauschen), ohne
    // zusätzliche Aussagekraft für Layout-Regressionen. Viewport-Maße exakt wie im Brief
    // (Handy 390, Tablet 768, Desktop 1280); Höhen an die bestehenden mobile-md/tablet-portrait/
    // desktop-Projekte angelehnt.
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'visual-mobile',
      testDir: './tests/e2e/visual',
      testIgnore: [],
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'visual-tablet',
      testDir: './tests/e2e/visual',
      testIgnore: [],
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'visual-desktop',
      testDir: './tests/e2e/visual',
      testIgnore: [],
      use: {
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],

  webServer: [
    {
      // offline — Port 3000 (bzw. 4173 mit CI_E2E_USE_PREVIEW), NIEMALS gegen Supabase
      // konfiguriert. In CI with CI_E2E_USE_PREVIEW, use production build (faster, no Vite
      // cold-start). Locally, use dev server for hot reload.
      name: 'offline',
      command: process.env.CI_E2E_USE_PREVIEW
        ? `npm run preview -- --port ${PORT}`
        : `npm run dev -- --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      // Explizit leer — auch wenn eine .env.local existiert, gewinnt diese Prozess-Variable
      // (Vite-Doku, Context7 /vitejs/vite: "environment variables that already exist when Vite
      // is executed have the highest priority and will not be overwritten by .env files").
      // Beweis dafür + dass offline dadurch nie *.supabase.co erreicht:
      // tests/e2e/flows/production-lockout.spec.ts (Task T3, Nachweis 2).
      env: {
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
      },
    },
    {
      // cloud (Task T3) — Port 3100, gegen den LOKALEN Supabase-Stack (nie Produktion, siehe
      // getCloudSupabaseEnv() oben).
      name: 'cloud',
      command: `npm run dev -- --port ${CLOUD_PORT}`,
      url: cloudBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: getCloudSupabaseEnv(),
    },
  ],
});
