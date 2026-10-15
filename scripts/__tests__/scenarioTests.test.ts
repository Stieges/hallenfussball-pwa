// A-09: scenario-tests.mjs (Plattform-Record "Testabdeckung", @TA-006, @TA-007, @TA-008)
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SKRIPT = resolve(__dirname, '..', 'scenario-tests.mjs')

let ordner: string
const schreibe = (name: string, inhalt: string) => {
  const pfad = join(ordner, name)
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, inhalt)
}
const liste = (ids: string[], soll: number) =>
  schreibe('tests/meta/mvp-kennungen.json', JSON.stringify({ soll, records: { zuschauer: ids.slice(0, 1), helfer: ids.slice(1) } }))
const nachweis = (kennungen: string[]) =>
  schreibe('tests/meta/nachweis-generalprobe.json', JSON.stringify({ max: 15, kennungen }))
const lauf = (...args: string[]) => spawnSync('node', [SKRIPT, '--root', ordner, ...args], { encoding: 'utf8' })

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'scenario-tests-'))
  nachweis([])
})
afterEach(() => rmSync(ordner, { recursive: true, force: true }))

describe('scenario-tests.mjs', () => {
  it('@TA-006 eine Liste mit einer Kennung weniger als soll scheitert mit der Abweichung', () => {
    liste(['ZM-096', 'HE-001'], 3)
    const r = lauf()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Liste hat 2 MVP-Kennungen, soll ist 3/)
  })

  it('@TA-006 eine Liste mit genau soll Eintraegen ist nicht rot (fehlende Tests sind im MVP nur Bericht)', () => {
    liste(['ZM-096', 'HE-001'], 2)
    const r = lauf()
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/ohne Test: 2/)
  })

  it('@TA-007 eine MVP-Kennung ohne Test wird gemeldet, mit Testnamen nicht mehr', () => {
    liste(['ZM-096', 'HE-001'], 2)
    const davor = lauf('--strict')
    expect(davor.status).toBe(1)
    expect(davor.stdout).toMatch(/zuschauer\s+1 von 1\s+ZM-096/)
    schreibe('src/a.test.ts', "it('ZM-096 zeigt den Stand', () => {})\n")
    const danach = lauf('--strict')
    expect(danach.stdout).not.toMatch(/ZM-096/)
    expect(danach.stdout).toMatch(/helfer\s+1 von 1\s+HE-001/)
  })

  it('@TA-007 eine Kennung nur im Kommentar oder in einem fremden String zaehlt nicht', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe(
      'src/b.test.ts',
      [
        '// ZM-096 steht nur im Kommentar',
        '/* HE-001 auch im Blockkommentar */',
        "const nebenbei = 'ZM-096 im normalen String'",
        "it('zaehlt ohne Kennung', () => { /* ZM-096 */ })",
      ].join('\n'),
    )
    const r = lauf()
    expect(r.stdout).toMatch(/mit Test: 0/)
    expect(r.stdout).toMatch(/ohne Test: 2/)
  })

  it('@TA-007 Kennungen in each-Tabellen, describe und test.step zaehlen; Teilnummern nicht', () => {
    liste(['ZM-096', 'HE-001', 'FU-081'], 3)
    schreibe(
      'src/c.test.ts',
      [
        "it.each([{ id: 'ZM-096' }])('Fall $id', () => {})",
        "describe('HE-001 Beitritt', () => {})",
        "await test.step('FU-08 ist nicht FU-081', async () => {})",
      ].join('\n'),
    )
    schreibe('tests/e2e/d.spec.ts', "test('x', async () => { await test.step('Schritt FU-081', async () => {}) })\n")
    const r = lauf()
    expect(r.stdout).toMatch(/mit Test: 3/)
  })

  it('@TA-008 mehr als 15 Nachweise aus der Generalprobe sind rot, genau 15 nicht', () => {
    const ids = Array.from({ length: 16 }, (_, i) => `ZM-${String(i + 1).padStart(3, '0')}`)
    liste(ids, 16)
    nachweis(ids)
    const r = lauf()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/16 > Grenze 15/)
    nachweis(ids.slice(0, 15))
    const ok = lauf()
    expect(ok.status).toBe(0)
    expect(ok.stdout).toMatch(/mit Nachweis Generalprobe: 15/)
  })

  it('@TA-008 ein Nachweis fuer eine Kennung ausserhalb der Liste ist rot', () => {
    liste(['ZM-096', 'HE-001'], 2)
    nachweis(['ZM-999'])
    expect(lauf().status).toBe(1)
  })
})
