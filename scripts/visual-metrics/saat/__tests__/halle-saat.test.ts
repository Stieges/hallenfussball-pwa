/**
 * Saat "Monitor Halle (sehr fern)" (@ZM-212 bis @ZM-214; Regel T2-UI): die eingefrorene Datei entspricht einer frischen Erzeugung mit der ECHTEN
 * App-Erzeugung und der echten Spiel-Engine; jedes Turnier hat die Monitore `mon-halle` (Profil) und `mon-fern` (ohne Profil) mit derselben Live-Folie.
 * Die Fälle sind Testwerte aus dem Gherkin (Stände, Namen, Zustände), nicht aus dem Code.
 * Neu erzeugen: `TZ=Europe/Berlin npx tsx scripts/visual-metrics/saat/erzeuge-halle.ts`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TournamentSchema } from '../../../../src/core/models/schemas/TournamentSchema'
import { FAELLE, HALLE_SAAT_NAME, erzeugeFall } from '../erzeuge-halle'

const DATEI = join(__dirname, '..', `${HALLE_SAAT_NAME}.json`)
type Spiel = { label?: string; matchStatus?: string; scoreA?: number; scoreB?: number; penaltyScoreA?: number; penaltyScoreB?: number; kit?: Record<string, string>; liveState?: { status?: string } }
type Turnier = { id: string; shareCode: string; teams: { name: string }[]; matches: Spiel[]; monitors: { id: string; profile?: string; slides: { type: string }[] }[] }
const lies = (): { datenbanken: { eintraege: { tournaments: Turnier[] } }[] } => JSON.parse(readFileSync(DATEI, 'utf8')) as ReturnType<typeof lies>
const turniere = (): Turnier[] => lies().datenbanken[0].eintraege.tournaments
const spiel = (id: string): Spiel => {
  const hf = turniere().find((t) => t.id === id)?.matches.find((m) => m.label === '1. Halbfinale')
  if (hf === undefined) { throw new Error(`Halbfinale 1 fehlt in ${id}`) }
  return hf
}

let frisch: unknown[]
let zeitzoneAlt: string | undefined
beforeAll(async () => {
  zeitzoneAlt = process.env.TZ
  process.env.TZ = 'Europe/Berlin'
  frisch = JSON.parse(JSON.stringify((await Promise.all(FAELLE.map(erzeugeFall))).map((f) => f.turnier))) as unknown[]
})
afterAll(() => {
  if (zeitzoneAlt === undefined) { delete process.env.TZ } else { process.env.TZ = zeitzoneAlt }
})

describe('Saat Monitor Halle (sehr fern)', () => {
  it('die eingefrorene Datei entspricht einer frischen Erzeugung (sonst neu erzeugen)', () => {
    expect(turniere()).toEqual(frisch)
  })

  it('Gegenbeispiel: ein geänderter Wert in der Datei macht den Vergleich rot', () => {
    const alt = turniere()
    alt[0].teams[0].name = 'Anders'
    expect(alt).not.toEqual(frisch)
  })

  it.each(FAELLE.map((f) => [f.id, f] as const))('%s besteht das Turnier-Schema der App (mit aufgelösten Marken)', (_id, fall) => {
    const t = turniere().find((x) => x.id === fall.id)
    expect(t).toBeDefined()
    const geladen = JSON.parse(JSON.stringify(t).replace(/"@heute"/g, '"2026-12-06"').replace(/"@jetzt[+-]\d+s"/g, '"2026-12-06T08:04:00.000Z"')) as unknown
    const r = TournamentSchema.safeParse(geladen)
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true)
  })

  it('jedes Turnier hat den Monitor mit dem Profil „Halle (sehr fern)“ und den ohne Profil, beide mit der Live-Folie auf Feld 1', () => {
    for (const t of turniere()) {
      const halle = t.monitors.find((m) => m.id === 'mon-halle')
      const fern = t.monitors.find((m) => m.id === 'mon-fern')
      expect(halle?.profile, t.id).toBe('hall-very-far')
      expect(fern, t.id).toBeDefined()
      expect('profile' in (fern ?? {}), t.id).toBe(false)
      expect(halle?.slides.map((s) => s.type)).toEqual(['live'])
      expect(fern?.slides.map((s) => s.type)).toEqual(['live'])
    }
  })

  it('Zustände laut Gherkin: laufend 1:0, 10:12, 2:2; vor dem Anpfiff geplant; angehalten pausiert; Halbzeit; Ende 3:1; Strafstoß 4:3 nach 1:1; Schießen läuft', () => {
    expect([spiel('halle-laeuft').matchStatus, spiel('halle-laeuft').scoreA, spiel('halle-laeuft').scoreB]).toEqual(['running', 1, 0])
    expect([spiel('halle-zweistellig').scoreA, spiel('halle-zweistellig').scoreB]).toEqual([10, 12])
    expect([spiel('halle-lang25').scoreA, spiel('halle-lang25').scoreB]).toEqual([2, 2])
    expect(spiel('halle-vor').matchStatus).toBe('scheduled')
    expect(spiel('halle-angehalten').matchStatus).toBe('paused')
    expect(spiel('halle-halbzeit').liveState?.status).toBe('section_break')
    expect([spiel('halle-ende').matchStatus, spiel('halle-ende').scoreA, spiel('halle-ende').scoreB]).toEqual(['finished', 3, 1])
    const strafstoss = spiel('halle-ende-strafstoss')
    expect([strafstoss.matchStatus, strafstoss.scoreA, strafstoss.scoreB, strafstoss.penaltyScoreA, strafstoss.penaltyScoreB]).toEqual(['finished', 1, 1, 4, 3])
    expect(spiel('halle-schiessen').matchStatus).toBe('running')
  })

  it('Namen laut Gherkin: Team 3 gegen Team 4, TSV Fridolfing gegen SG Taching/Tengling, zwei Namen mit genau 25 Zeichen', () => {
    const namen = (id: string): string[] => (turniere().find((t) => t.id === id)?.teams.map((x) => x.name) ?? [])
    expect(namen('halle-team34')).toEqual(expect.arrayContaining(['Team 3', 'Team 4']))
    expect(namen('halle-laeuft')).toEqual(expect.arrayContaining(['TSV Fridolfing', 'SG Taching/Tengling']))
    const lang = namen('halle-lang25').filter((n) => n.length === 25)
    expect(lang).toEqual(['SG Kirchanschöring/Fridol', 'FC Rotweiss Hinterwald Os'])
  })

  it('getragene Farben: Weiß und Gelb als helle Trikots, Leibchen mit Zeichen, ohne Trikotfarbe fehlt die Farbe der Seite', () => {
    expect(spiel('halle-weiss').kit).toEqual({ a: '#FFFFFF', b: '#C62828' })
    expect(spiel('halle-gelb').kit).toEqual({ a: '#1565C0', b: '#FFCC00' })
    expect(spiel('halle-leibchen').kit).toMatchObject({ a: '#FF6600', bibSide: 'a' })
    expect(spiel('halle-ohne-farbe').kit).toEqual({ a: '#1565C0' })
  })
})
