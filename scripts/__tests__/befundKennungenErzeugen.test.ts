// TM-1 (@TA-016): befund-kennungen-erzeugen.mjs erzeugt die Liste bekannter Kennungen aus der Befundliste
// und nennt nur, was ein Test nennt. Verweis-Beispiele stehen nur in String-Literalen, nie in Testtiteln.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ERZEUGER_SKRIPT, sauberEnv, schreibe as schreibeIn } from './skriptHilfen'

let ordner: string
const schreibe = (name: string, inhalt: string) => schreibeIn(ordner, name, inhalt)
const KOPF = '| ID | Befund | Fundstelle | Schwere | Wird gelöst durch | Status |\n|---|---|---|---|---|---|\n'
const zeile = (id: string) => `| ${id} | Langer Befundtext zu ${id} mit Details | \`x.ts:1\` | wichtig | Record | offen |\n`
const befundliste = (...ids: string[]) => schreibe('befunde.md', `# Befunde\n\n${KOPF}${ids.map(zeile).join('')}`)
const erzeuge = (...args: string[]) =>
  spawnSync('node', [ERZEUGER_SKRIPT, '--root', ordner, '--befunde', join(ordner, 'befunde.md'), '--out', join(ordner, 'out.json'), ...args], { encoding: 'utf8', env: sauberEnv(ordner) })
const ausgabe = () => join(ordner, 'out.json')

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'befund-kennungen-'))
})
afterEach(() => rmSync(ordner, { recursive: true, force: true }))

describe('befund-kennungen-erzeugen.mjs', () => {
  it('@TA-016 die Liste enthaelt genau die von Tests genannten Kennungen, ohne Befundtext', () => {
    befundliste('C-SIGNOUT', 'C-COCKPIT-TABLET-OHNE-PROTOKOLL', 'DF-001')
    schreibe('src/a.test.ts', "it.fails('@DF-001 Fall', () => {})\ntest('x', () => { test.fail(c, 'Befund C-COCKPIT-TABLET-OHNE-PROTOKOLL') })\n")
    const r = erzeuge()
    expect(r.status, r.stderr).toBe(0)
    const text = readFileSync(ausgabe(), 'utf8')
    expect(JSON.parse(text).kennungen).toEqual(['C-COCKPIT-TABLET-OHNE-PROTOKOLL', 'DF-001'])
    expect(text).not.toMatch(/Befundtext|Details|x\.ts/)
  })

  it('@TA-016 Gegenbeispiel: eine Kennung der Befundliste, die kein Test nennt, steht nicht in der Ausgabe', () => {
    befundliste('C-SIGNOUT', 'DF-001')
    schreibe('src/a.test.ts', "it('@DF-001 Fall', () => {})\n")
    expect(erzeuge().status).toBe(0)
    expect(readFileSync(ausgabe(), 'utf8')).not.toMatch(/C-SIGNOUT/)
  })

  it('@TA-016 steht eine Kennung zweimal in der Befundliste, bricht die Erzeugung ab und nennt sie', () => {
    befundliste('DF-001', 'C-SIGNOUT', 'DF-001')
    schreibe('src/a.test.ts', "it('@DF-001 Fall', () => {})\n")
    const r = erzeuge()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/DF-001/)
    expect(existsSync(ausgabe())).toBe(false)
  })

  it('@TA-016 nennt ein Test eine Kennung, die die Befundliste nicht hat, bricht die Erzeugung ab und nennt sie', () => {
    befundliste('C-SIGNOUT', 'DF-001')
    schreibe('src/a.test.ts', "it('C-GIBT-ES-NICHT Fall', () => {})\n")
    const r = erzeuge()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/C-GIBT-ES-NICHT/)
    expect(r.stderr).toMatch(/src\/a\.test\.ts:1/)
    expect(existsSync(ausgabe())).toBe(false)
  })

  it('@TA-016 fehlt die Befundliste, bricht die Erzeugung ab und nennt alle versuchten Pfade', () => {
    const r = spawnSync('node', [ERZEUGER_SKRIPT, '--root', ordner, '--befunde', join(ordner, 'gibt-es-nicht.md'), '--out', ausgabe()], {
      encoding: 'utf8',
      env: { ...sauberEnv(ordner), BEFUNDE_PFAD: join(ordner, 'auch-nicht.md') },
    })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/gibt-es-nicht\.md/)
    expect(r.stderr).toMatch(/auch-nicht\.md/)
    expect(r.stderr).toMatch(/BEFUNDE-HEUTIGER-CODE\.md/)
  })

  it('@TA-016 die Befundliste kann ueber die Umgebungsvariable gefunden werden; ohne Test-Verweise ist die Liste leer', () => {
    befundliste('C-SIGNOUT')
    schreibe('src/a.test.ts', "it('ohne jeden Verweis', () => {})\n")
    const r = spawnSync('node', [ERZEUGER_SKRIPT, '--root', ordner, '--out', ausgabe()], { encoding: 'utf8', env: { ...sauberEnv(ordner), BEFUNDE_PFAD: join(ordner, 'befunde.md') } })
    expect(r.status, r.stderr).toBe(0)
    expect(JSON.parse(readFileSync(ausgabe(), 'utf8')).kennungen).toEqual([])
  })
})
