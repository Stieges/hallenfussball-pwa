// Haertetest des Messskripts scripts/visual-metrics/messen.mjs (Skill visuelle-pruefung, Plattform).
// Die drei Fehler, die am 2026-10-16 durchgerutscht sind, liegen als Fixtures vor; das Skript muss
// jeden finden, und die korrigierten Fassungen muessen gruen sein (Daniel 2026-10-16).
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
// @ts-expect-error -- ESM-Hilfsmodul ohne Typen
import { sehwinkelAnteil } from '../visual-metrics/profile.mjs'

const ORDNER = resolve(__dirname, '..', 'visual-metrics')
const FIX = (name: string) => join(ORDNER, 'fixtures', name)
const AUS = resolve(__dirname, '..', '..', 'test-results', 'visual-metrics-test')
mkdirSync(AUS, { recursive: true })
afterAll(() => rmSync(AUS, { recursive: true, force: true }))

interface Befund { metrik: string; typ: string; profil: string }
interface Lauf { profil: string; hart: number; befunde: Befund[] }
interface Bericht { status: string; gate: { gruende?: string[] }; laeufe: Lauf[]; zusammenfassung: { hart: number } }

let nr = 0
function messe(ziel: string, ...args: string[]): { code: number | null; bericht: Bericht; out: string } {
  const bericht = join(AUS, `b${String(++nr)}.json`)
  const r = spawnSync('node', [join(ORDNER, 'messen.mjs'), '--ziel', ziel, '--aus', AUS, '--bericht', bericht, ...args], { encoding: 'utf8' })
  return { code: r.status, bericht: JSON.parse(readFileSync(bericht, 'utf8')) as Bericht, out: r.stdout + r.stderr }
}
const hartMetriken = (b: Bericht) => new Set(b.laeufe.flatMap((l) => l.befunde.filter((x) => x.typ === 'HART').map((x) => x.metrik)))

describe('visual-metrics Haertetest', { timeout: 240_000 }, () => {
  it('Fehler 1 "Turnierver-/waltung": Wortbruch und hyphens:auto im Titel sind HART (Exit 1)', () => {
    const r = messe(FIX('titel-silbentrennung.html'), '--profil', 'handy-360', '--ohne-axe')
    expect(r.code).toBe(1)
    expect(r.bericht.status).toBe('ROT')
    const m = hartMetriken(r.bericht)
    expect(m.has('titel.wortbruch')).toBe(true)
    expect(m.has('titel.hyphens')).toBe(true)
  })

  it('Gegenbeispiel 1: korrigierter Titel ist in der ganzen App-Matrix gruen (hell/dunkel, de/en, normal/Langtext)', () => {
    const r = messe(FIX('titel-silbentrennung-korrigiert.html'), '--profil', 'app')
    expect(r.out).toContain('GRUEN')
    expect(r.code).toBe(0)
    expect(r.bericht.zusammenfassung.hart).toBe(0)
    expect(r.bericht.laeufe).toHaveLength(5 * 2 * 2 * 2)
  })

  it('Fehler 2 abgeschnittener Kopf: nur mit Standard-Rand rot, mit Rand 0 unsichtbar (Exit 1)', () => {
    const r = messe(FIX('monitor-kopf.html'), '--profil', 'monitor', '--varianten', 'normal', '--ohne-axe')
    expect(r.code).toBe(1)
    const rand0 = r.bericht.laeufe.filter((l) => l.profil.endsWith('rand0'))
    const standard = r.bericht.laeufe.filter((l) => l.profil.endsWith('standard'))
    expect(rand0.every((l) => l.hart === 0)).toBe(true)
    expect(standard.every((l) => l.befunde.some((b) => b.typ === 'HART' && b.metrik === 'overscan.app-rand'))).toBe(true)
  })

  it('Gegenbeispiel 2 und 3: korrigierte Monitor-Folie (echter Stand) ist mit Rand 0 und Standard-Rand gruen', () => {
    const r = messe(FIX('monitor-kopf-korrigiert.html'), '--profil', 'monitor', '--varianten', 'normal')
    expect(r.code).toBe(0)
    expect(r.bericht.status).toBe('GRUEN')
    expect(r.bericht.laeufe).toHaveLength(4 * 2 * 2)
  })

  it('Fehler 3 Attrappe statt echtem Stand: Gate sperrt (BLOCKED, Exit 3), obwohl der Inhalt gruen waere', () => {
    const r = messe(FIX('monitor-attrappe.html'), '--profil', 'monitor', '--varianten', 'normal', '--ohne-axe')
    expect(r.code).toBe(3)
    expect(r.bericht.status).toBe('BLOCKED')
    expect(r.bericht.gate.gruende?.join(' ')).toMatch(/Attrappe/)
    expect(r.bericht.laeufe).toHaveLength(0)
  })

  it('Gate: Vite-Dev-Server statt gebautem Preview ist BLOCKED (Exit 3)', () => {
    const r = messe(FIX('dev-server.html'), '--profil', 'monitor-720-standard', '--ohne-axe')
    expect(r.code).toBe(3)
    expect(r.bericht.gate.gruende?.join(' ')).toMatch(/Vite-Dev-Server/)
  })

  it('Sehwinkel parametrisiert: dieselbe Folie aus 20 m statt 10 m verletzt die Monitor-Mindestschrift (Exit 1)', () => {
    const r = messe(FIX('monitor-kopf-korrigiert.html'), '--profil', 'monitor-1080-standard', '--themen', 'hell', '--sprachen', 'de', '--varianten', 'normal', '--ohne-axe', '--abstand-m', '20')
    expect(r.code).toBe(1)
    expect(hartMetriken(r.bericht).has('monitor.schrift.lesetext')).toBe(true)
  })

  it('Unbekanntes Profil ist ein Aufruffehler (Exit 2)', () => {
    const r = spawnSync('node', [join(ORDNER, 'messen.mjs'), '--ziel', FIX('dev-server.html'), '--profil', 'fernseher'], { encoding: 'utf8' })
    expect(r.status).toBe(2)
  })
})

describe('Sehwinkel-Formel (Entscheidung Daniel 2026-10-16: 55 Zoll aus 10 m)', () => {
  const basis = { abstandM: 10, diagonaleZoll: 55, versalAnteil: 0.72 }
  it.each([
    [20, 0.118, 128],
    [16, 0.0944, 102],
    [12, 0.0708, 77],
  ])('%i Bogenminuten ergeben %f der Bildhoehe (%i px bei 1080)', (winkel, anteil, px) => {
    const a = sehwinkelAnteil(basis, winkel) as number
    expect(a).toBeCloseTo(anteil, 3)
    expect(Math.ceil(a * 1080)).toBe(px)
  })
  it('halber Abstand halbiert die Mindestschrift', () => {
    expect(sehwinkelAnteil({ ...basis, abstandM: 5 }, 16) as number).toBeCloseTo((sehwinkelAnteil(basis, 16) as number) / 2, 6)
  })
})
