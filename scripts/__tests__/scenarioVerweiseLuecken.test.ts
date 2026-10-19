// TM-1 Fixrunde 1 (Review-Auflagen A1 bis A5): Luecken der Verweis-Pflicht (@TA-013, @TA-014, @TA-015, @TA-016).
// Verweis-Beispiele stehen nur in String-Literalen, nie in Testtiteln (das Skript scannt die eigenen Tests).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { befundKennungen, git, mvpListe, schreibe as schreibeIn, szenarioLauf } from './skriptHilfen'

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
    befundKennungen(ordner, ['DF-001'])
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
