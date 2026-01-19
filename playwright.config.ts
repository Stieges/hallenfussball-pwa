import { defineConfig, devices } from '@playwright/test';

// In CI with preview mode, Vite uses port 4173; otherwise dev server uses 3000
const usePreview = !!process.env.CI_E2E_USE_PREVIEW;
// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty PORT env var should use default
const PORT = process.env.PORT || (usePreview ? '4173' : '3000');
const baseURL = `http://localhost:${PORT}`;

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

export default defineConfig({
  testDir: './tests/e2e',
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
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Action and navigation timeouts
    actionTimeout: process.env.CI ? 15000 : 10000,
    navigationTimeout: process.env.CI ? 30000 : 15000,
  },

  expect: {
    // Expect timeout: 10s in CI, 5s locally
    timeout: process.env.CI ? 10000 : 5000,
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
  ],

  webServer: {
    // In CI with CI_E2E_USE_PREVIEW, use production build (faster, no Vite cold-start)
    // Locally, use dev server for hot reload
    command: process.env.CI_E2E_USE_PREVIEW ? 'npm run preview' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
