// TM-1 (@TA-017): die committete Untergrenze steht auf dem gemessenen Stand, nicht mehr bei 210.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('@TA-017 die Untergrenze in tests/meta/szenario-floor.json ist auf den gemessenen Stand (mindestens 321) nachgezogen', () => {
  const floor = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'tests/meta/szenario-floor.json'), 'utf8')) as { mitTest: number; kennungen: string[] }
  expect(floor.mitTest).toBeGreaterThanOrEqual(321)
  expect(floor.kennungen).toHaveLength(floor.mitTest)
})
