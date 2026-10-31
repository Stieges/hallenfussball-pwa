// TM-1 Fixrunde 1 (Review-Auflagen A1 bis A5): Luecken der Verweis-Pflicht (@TA-013, @TA-014, @TA-024; die Rueckrichtung @TA-016 entfaellt mit der Liste im Repo).
// Verweis-Beispiele stehen nur in String-Literalen, nie in Testtiteln (das Skript scannt die eigenen Tests).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { befundliste, git, mvpListe, schreibe as schreibeIn, szenarioLauf } from './skriptHilfen'

let ordner: string
const schreibe = (name: string, inhalt: string) => schreibeIn(ordner, name, inhalt)
const lauf = (...args: string[]) => szenarioLauf(ordner, ...args)
const ZEITLIMIT = 20_000
const gemeldet = (stdout: string) => [...stdout.matchAll(/erwartet rot ohne Verweis: (\S+):(\d+)/g)].map((m) => `${m[1]}:${m[2]}`)

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'scenario-luecken-'))
  mvpListe(ordner, ['ZM-096', 'HE-001'])
})
afterEach(() => rmSync(ordner, { recursive: true, force: true }))

describe('@TA-014 Ratsche (A1): der Hauptzweig zaehlt nur Markierungen ohne Verweis', () => {
  it('@TA-014 Hauptzweig mit 21 Markierungen, eine mit Verweis: eine weitere ohne Verweis ist rot (21 > Hauptzweig 20)', () => {
    befundliste(ordner, ['DF-001'])
    const fall = (n: number) => `it.fails('Fall ${String(n).padStart(2, '0')}', () => {})`
    const haupt = ["it.fails('@DF-001 Fall 00', () => {})", ...Array.from({ length: 20 }, (_, i) => fall(i + 1))]
    schreibe('src/alt.test.ts', haupt.join('\n') + '\n')
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 0, kennungen: [] }))
    git(ordner, 'init', '-q', '-b', 'main')
    git(ordner, 'add', '-A')
    git(ordner, 'commit', '-q', '-m', 'main')
    expect(lauf('--base', 'HEAD').status).toBe(0)
    schreibe('src/alt.test.ts', haupt.join('\n') + "\nit.fails('Neuer Fall', () => {})\n")
    const r = lauf('--base', 'HEAD')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/21 > Hauptzweig 20/)
    expect(r.stderr).toMatch(/Neuer Fall/)
  }, ZEITLIMIT)
})

describe('@TA-013 Rumpf-Markierung erbt den Verweis aus dem Titel des umgebenden Tests (A2)', () => {
  it('@TA-013 test.fail ohne Begruendung in einem Test mit Verweis im Titel wird nicht gemeldet', () => {
    befundliste(ordner, ['C-KONTRAST-TEXTPAARE'])
    schreibe('src/h.test.ts', "test('C-KONTRAST-TEXTPAARE Fall', () => {\n  test.fail()\n})\n")
    const r = lauf()
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/Erwartet rot \(it\.fails, test\.fail\): 1, davon ohne Verweis auf Befund oder Defekt: 0/)
  })

  it('@TA-013 Gegenbeispiel: derselbe Test ohne Verweis im Titel wird gemeldet', () => {
    schreibe('src/h.test.ts', "test('Fall', () => {\n  test.fail()\n})\n")
    expect(gemeldet(lauf().stdout)).toEqual(['src/h.test.ts:2'])
  })
})

describe('@TA-024 unbekannter Verweis im describe-Titel (A3)', () => {
  it('@TA-024 ein Tippfehler im Block-Titel ist rot und nennt Datei und Zeile des Blocks', () => {
    befundliste(ordner, ['C-KONTRAST-TEXTPAARE'])
    schreibe('src/d.test.ts', "// Kopf\ndescribe('Offen C-KONTRAST-TEXTPAARRE: Text-Paare', () => {\n  it.fails('hell: Schrift', () => {})\n})\n")
    const r = lauf()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Unbekannter Verweis C-KONTRAST-TEXTPAARRE in src\/d\.test\.ts:2/)
  })

  it('@TA-024 gleicher Block mit richtig geschriebenem Verweis ist gruen', () => {
    befundliste(ordner, ['C-KONTRAST-TEXTPAARE'])
    schreibe('src/d.test.ts', "describe('Offen C-KONTRAST-TEXTPAARE: Text-Paare', () => {\n  it.fails('hell: Schrift', () => {})\n})\n")
    expect(lauf().status).toBe(0)
  })
})

describe('@TA-013 test.info().fail() ist eine Markierung (A4)', () => {
  it('@TA-013 test.info().fail() im Rumpf wird erkannt und ohne Verweis gemeldet', () => {
    schreibe('src/i.test.ts', "test('Fall', async () => {\n  test.info().fail()\n})\n")
    expect(gemeldet(lauf().stdout)).toEqual(['src/i.test.ts:2'])
  })

  it('@TA-013 Gegenbeispiel: expect.fail(..) ist keine Markierung', () => {
    schreibe('src/i.test.ts', "test('Fall', async () => {\n  expect.fail('absichtlich')\n})\n")
    const r = lauf()
    expect(r.stdout).toMatch(/Erwartet rot \(it\.fails, test\.fail\): 0,/)
  })
})

