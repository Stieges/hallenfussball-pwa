import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: 'tests/e2e', timeout: 60000, workers: 2, reporter: 'list', use: { baseURL: 'http://127.0.0.1:56058', trace: 'off' }, projects: [{ name: 'lokal', use: { browserName: 'chromium' } }] })
