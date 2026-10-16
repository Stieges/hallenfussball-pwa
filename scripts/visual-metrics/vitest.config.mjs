// Haertetest der visuellen Messung: braucht Chromium (Playwright) und baut die App.
// Laeuft deshalb NICHT im Unit-Job (`npm test`), sondern als `npm run test:visual-metrics`
// im E2E-Job der CI, wo die Browser installiert sind (Review B-17).
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    name: 'visual-metrics',
    environment: 'node',
    include: ['scripts/visual-metrics/**/*.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
})
