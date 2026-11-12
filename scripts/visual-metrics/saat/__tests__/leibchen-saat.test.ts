/**
 * Saat "Leibchen vor dem Anpfiff" (Leibchen 2b, Punkt 8): die eingefrorene Datei entspricht einer frischen Erzeugung mit der ECHTEN App-Erzeugung
 * und trägt die Fälle 7a bis 7e der Bildfreigabe (@ZM-195, @ZM-200, @ZM-201, @ZM-203, @ZM-204). Die Fälle sind Testwerte aus dem Gherkin, nicht aus dem Code.
 * Neu erzeugen: `TZ=Europe/Berlin npx tsx scripts/visual-metrics/saat/erzeuge-leibchen.ts`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TournamentSchema } from '../../../../src/core/models/schemas/TournamentSchema'
import { buildTournamentView } from '../../../../src/core/view/tournamentView'
import { FAELLE, LEIBCHEN_SAAT_NAME, erzeugeFall } from '../erzeuge-leibchen'

const DATEI = join(__dirname, '..', `${LEIBCHEN_SAAT_NAME}.json`)
type Turnier = { id: string; shareCode: string; date: string; teams: { id: string; name: string; colors?: { primary: string } }[]; matches: Record<string, unknown>[]; monitors: { id: string }[] }
const lies = (): { datenbanken: { eintraege: { tournaments: Turnier[] } }[] } => JSON.parse(readFileSync(DATEI, 'utf8')) as ReturnType<typeof lies>
const turniere = (): Turnier[] => lies().datenbanken[0].eintraege.tournaments

let frisch: unknown[]
let zeitzoneAlt: string | undefined
beforeAll(async () => {
  // Der Spielplan rechnet Anpfiffzeiten in Ortszeit: feste Zeitzone, damit die Datei auf jedem Rechner gleich ist (wie saat.test.ts).
  zeitzoneAlt = process.env.TZ
  process.env.TZ = 'Europe/Berlin'
  frisch = JSON.parse(JSON.stringify(await Promise.all(FAELLE.map(erzeugeFall)))) as unknown[]
})
afterAll(() => {
  if (zeitzoneAlt === undefined) { delete process.env.TZ } else { process.env.TZ = zeitzoneAlt }
})

describe('Saat Leibchen vor dem Anpfiff', () => {
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
    const geladen = JSON.parse(JSON.stringify(t).replace(/"@heute"/g, '"2026-12-06"').replace(/"@jetzt\+240s"/g, '"2026-12-06T08:04:00.000Z"')) as unknown
    const r = TournamentSchema.safeParse(geladen)
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true)
  })

  it('Inhalt laut Bildfreigabe: Spiel 2 Aschau 2:1 Seeon beendet, Spiel 3 Waging 1 gegen Petting als nächstes Spiel auf Feld 1 mit Live-Folie', () => {
    for (const t of turniere()) {
      const name = (id: unknown): string | undefined => t.teams.find((x) => x.id === id)?.name
      const spiel2 = t.matches.find((m) => m.matchNumber === 2) as { slotA: { teamId: string }; slotB: { teamId: string }; scoreA: number; scoreB: number; matchStatus: string }
      expect([name(spiel2.slotA.teamId), name(spiel2.slotB.teamId), spiel2.scoreA, spiel2.scoreB, spiel2.matchStatus]).toEqual(['SV Aschau', 'FC Seeon', 2, 1, 'finished'])
      const spiel3 = t.matches.find((m) => m.matchNumber === 3) as { slotA: { teamId: string }; slotB: { teamId: string }; field: number; matchStatus: string; scheduledTime: string }
      expect(spiel3.field).toBe(1)
      expect(spiel3.matchStatus).toBe('scheduled')
      expect(spiel3.scheduledTime).toBe('@jetzt+240s')
      expect(name(spiel3.slotB.teamId)).toBe('TSV Petting')
      expect(t.matches.filter((m) => m.matchStatus !== 'finished')).toHaveLength(1)
      expect(t.date).toBe('@heute')
      expect(t.monitors.map((m) => m.id)).toEqual(['mon-live'])
    }
  })

  it.each([
    ['leibchen-7a', 'solid', false], ['leibchen-7b', 'vest', true], ['leibchen-7c', 'striped', false], ['leibchen-7d', 'vest', true], ['leibchen-7e', 'solid', false], ['leibchen-lang', 'vest', true],
  ] as const)('%s: die gemeinsame Ansicht zeigt für Waging den Kasten %s (Leibchen-Zeichen %s)', (id, art, zeichen) => {
    const t = turniere().find((x) => x.id === id)
    const tournament = JSON.parse(JSON.stringify(t).replace(/"@heute"/g, '"2026-12-06"').replace(/"@jetzt\+240s"/g, '"2026-12-06T08:04:00.000Z"')) as Turnier
    const spiel3 = (tournament.matches.find((m) => m.matchNumber === 3) as { id: string }).id
    const view = buildTournamentView({ teams: tournament.teams, matches: tournament.matches, date: '2026-12-06', hideScoresForPublic: false, hideRankingsForPublic: false, isPublic: true, shareCode: 'X' } as never, { audience: 'screen', medium: 'app', locale: 'de' })
    const boxes = view.byId.get(spiel3)?.boxes
    expect(boxes?.home.fill.kind).toBe(art)
    expect(boxes?.home.bib).toBe(zeichen)
    expect(boxes?.away.bib).toBe(false)
  })
})
