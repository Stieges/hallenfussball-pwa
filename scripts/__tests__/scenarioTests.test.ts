// A-09: scenario-tests.mjs (Plattform-Record "Testabdeckung", @TA-006, @TA-007, @TA-008)
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  it('@TA-007 ein auskommentierter Test mit Kennung zaehlt nicht', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/e.test.ts', "// it('ZM-096 war mal ein Test', () => {})\n/* test('HE-001 auch', () => {}) */\n")
    expect(lauf().stdout).toMatch(/mit Test: 0/)
  })

  it('@TA-007 `.test(...)` einer Regex und it(...) im String sind keine Tests', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe(
      'src/f.test.ts',
      ["expect(/x/.test('ZM-096 hier'))", 'const s = "it(\'HE-001 im String\')"', "it('echt ohne Kennung', () => {})"].join('\n'),
    )
    expect(lauf().stdout).toMatch(/mit Test: 0/)
    schreibe('src/g.test.ts', "test.describe('ZM-096 echt', () => {})\n")
    expect(lauf().stdout).toMatch(/mit Test: 1/)
  })

  it('@TA-007 --task findet den Bauplan ueber --plan und meldet nur dessen Kennungen', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('plan.md', '**A-99 Beispiel**\n- **Szenarien:** @ZM-096.\n\n**A-98 Anderes**\n- **Szenarien:** @HE-001.\n')
    const r = lauf('--task', 'A-99', '--plan', join(ordner, 'plan.md'))
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/MVP-Kennungen: 1 \(Aufgabe A-99\)/)
  })
})

describe('scenario-tests.mjs: reguläre Tests und Ratchet (TA-CI)', () => {
  const floor = (pfad: string, mitTest: number, kennungen: string[] = []) => schreibe(pfad, JSON.stringify({ mitTest, kennungen }))

  it('@TA-007 ein regulärer Test zählt als mit Test', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/a.test.ts', "it('ZM-096 zeigt den Stand', () => {})\nit.only('HE-001 x', () => {})\n")
    expect(lauf().stdout).toMatch(/mit Test: 2, teilweise: 0/)
  })

  it('@TA-007 it.fails, test.fail, it.todo, skip und describe.skip zählen nicht, ein regulärer Test daneben schon', () => {
    liste(['ZM-096', 'HE-001', 'FU-081', 'AN-010', 'BM-001', 'ME-063'], 6)
    schreibe(
      'src/b.test.ts',
      [
        "it.fails('ZM-096 erwartet rot', () => {})",
        "test.fail('HE-001 erwartet rot', () => {})",
        "it.todo('FU-081 offen')",
        "it.skip('AN-010 uebersprungen', () => {})",
        "describe.skip('Gruppe', () => { it('BM-001 im uebersprungenen describe', () => {}) })",
        "it('ME-063 regulaer', () => {})",
      ].join('\n'),
    )
    const r = lauf()
    expect(r.stdout).toMatch(/mit Test: 1, teilweise: 0, mit Nachweis Generalprobe: 0, ohne Test: 5/)
    schreibe('src/c.test.ts', "it('ZM-096 jetzt auch regulaer', () => {})\n")
    expect(lauf().stdout).toMatch(/mit Test: 2,/)
  })

  it('@TA-007 :teil zählt als teilweise, nicht als mit Test; ein voller Test daneben macht daraus mit Test', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/d.test.ts', "it('ZM-096:teil nur der Hauptpfad', () => {})\nit('HE-001 voll', () => {})\n")
    expect(lauf().stdout).toMatch(/mit Test: 1, teilweise: 1, mit Nachweis Generalprobe: 0, ohne Test: 0/)
    expect(lauf('--strict').status).toBe(1)
    schreibe('src/e.test.ts', "it('ZM-096 der Rest', () => {})\n")
    expect(lauf('--strict').status).toBe(0)
  })

  it('@TA-003 die Zahl fällt um 1 unter den Stand des Hauptzweigs: rot, mit Nennung der verlorenen Kennung', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/a.test.ts', "it('ZM-096 x', () => {})\n")
    floor('floor-main.json', 2, ['HE-001', 'ZM-096'])
    const r = lauf('--base-floor', join(ordner, 'floor-main.json'))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/1 Kennungen mit regulaerem Test < Hauptzweig 2/)
    expect(r.stdout).toMatch(/ohne regulaeren Test: HE-001/)
  })

  it('@TA-003 Gegenbeispiel: gleiche Zahl bleibt grün, +1 ebenfalls, die Datei darf dann angehoben werden', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/a.test.ts', "it('ZM-096 x', () => {})\nit('HE-001 y', () => {})\n")
    floor('floor-main.json', 1, ['ZM-096'])
    floor('tests/meta/szenario-floor.json', 1, ['ZM-096'])
    const plus = lauf('--base-floor', join(ordner, 'floor-main.json'))
    expect(plus.status).toBe(0)
    expect(plus.stdout).toMatch(/angehoben werden: 2 > 1/)
    floor('floor-main.json', 2, ['HE-001', 'ZM-096'])
    floor('tests/meta/szenario-floor.json', 2, ['HE-001', 'ZM-096'])
    expect(lauf('--base-floor', join(ordner, 'floor-main.json')).status).toBe(0)
  })

  it('@TA-003 eine gesenkte Untergrenze in der Datei und eine Zahl unter der eigenen Untergrenze sind rot', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/a.test.ts', "it('ZM-096 x', () => {})\nit('HE-001 y', () => {})\n")
    floor('floor-main.json', 2)
    floor('tests/meta/szenario-floor.json', 1)
    const gesenkt = lauf('--base-floor', join(ordner, 'floor-main.json'))
    expect(gesenkt.status).toBe(1)
    expect(gesenkt.stderr).toMatch(/Untergrenze 1 < Hauptzweig 2/)
    floor('tests/meta/szenario-floor.json', 3)
    const darunter = lauf()
    expect(darunter.status).toBe(1)
    expect(darunter.stderr).toMatch(/< Untergrenze 3 in der Datei/)
  })

  it('@TA-003 --base mit unbekannter Ref ist rot (fail-closed), --floor-schreiben und die Job-Summary funktionieren', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/a.test.ts', "it('ZM-096 x', () => {})\n")
    const schreiben = lauf('--floor-schreiben')
    expect(schreiben.status).toBe(0)
    expect(JSON.parse(readFileSync(join(ordner, 'tests/meta/szenario-floor.json'), 'utf8')).mitTest).toBe(1)
    const r = lauf('--base', 'gibt-es-nicht')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Base-Ref "gibt-es-nicht" existiert nicht/)
    floor('floor-main.json', 1, ['HE-001', 'ZM-096'])
    const summary = join(ordner, 'summary.md')
    lauf('--base-floor', join(ordner, 'floor-main.json'), '--summary', summary)
    expect(readFileSync(summary, 'utf8')).toMatch(/Neu ohne regulaeren Test: `HE-001`/)
  })
})

describe('mvp-kennungen-erzeugen.mjs', () => {
  it('@TA-006 die Erzeugung aus einer Beispiel-JSON ergibt dieselbe Liste samt soll', () => {
    const quelle = join(ordner, 'anf.json')
    writeFileSync(
      quelle,
      JSON.stringify({ klasse: 'mvp', soll: 3, kennungen: ['HE-001', 'HE-004', 'ZM-096'], je_record: { helfer: 2, zuschauer: 1, leer: 0 }, zahlen: {} }),
    )
    const ziel = join(ordner, 'out.json')
    const r = spawnSync('node', [resolve(__dirname, '..', 'mvp-kennungen-erzeugen.mjs'), '--anf-json', quelle, '--out', ziel], { encoding: 'utf8' })
    expect(r.status).toBe(0)
    const erg = JSON.parse(readFileSync(ziel, 'utf8'))
    expect(erg.soll).toBe(3)
    expect(erg.records).toEqual({ helfer: ['HE-001', 'HE-004'], zuschauer: ['ZM-096'] })
  })

  it('@TA-006 weicht soll von der Kennungszahl ab, bricht die Erzeugung ab', () => {
    const quelle = join(ordner, 'anf.json')
    writeFileSync(quelle, JSON.stringify({ klasse: 'mvp', soll: 4, kennungen: ['HE-001'], je_record: { helfer: 1 } }))
    const r = spawnSync('node', [resolve(__dirname, '..', 'mvp-kennungen-erzeugen.mjs'), '--anf-json', quelle, '--out', join(ordner, 'o.json')], { encoding: 'utf8' })
    expect(r.status).not.toBe(0)
  })
})
