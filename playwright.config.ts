import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ==========================================================================
    // iOS Safari (WebKit) - Kritisch für PWA!
    // ==========================================================================
    {
      name: 'iPhone SE Safari',
      use: { ...devices['iPhone SE'], browserName: 'webkit' },
    },
    {
      name: 'iPhone 13 Safari',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
    },
    {
      name: 'iPhone 15 Pro Safari',
      use: { ...devices['iPhone 15 Pro'], browserName: 'webkit' },
    },

    // ==========================================================================
    // Android Chrome
    // ==========================================================================
    {
      name: 'Pixel 5',
      use: { ...devices['Pixel 5'], hasTouch: true },
    },

    // ==========================================================================
    // Desktop
    // ==========================================================================
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
