// Regression: rAF-Ersatz in setup.dom.ts darf nach Testende keine Rueckrufe mehr ausfuehren
// (CI-Fehler "requestAnimationFrame is not defined" nach Umgebungsabbau).
import { describe, it, expect } from 'vitest'

const aufgerufen: string[] = []

describe('rAF-Ersatz (setup.dom.ts)', () => {
  it('Test A: startet eine rAF-Schleife und endet ohne sie zu stoppen', () => {
    const schleife = () => {
      aufgerufen.push('A')
      window.requestAnimationFrame(schleife)
    }
    window.requestAnimationFrame(schleife)
    expect(aufgerufen).toEqual([])
  })

  it('Test B: Rueckrufe aus Test A laufen nach dem Testende nicht mehr', async () => {
    await new Promise((r) => setTimeout(r, 80))
    expect(aufgerufen).toEqual([])
  })

  it('cancelAnimationFrame verhindert den Rueckruf', async () => {
    let n = 0
    const id = window.requestAnimationFrame(() => { n++ })
    window.cancelAnimationFrame(id)
    await new Promise((r) => setTimeout(r, 50))
    expect(n).toBe(0)
  })
})
