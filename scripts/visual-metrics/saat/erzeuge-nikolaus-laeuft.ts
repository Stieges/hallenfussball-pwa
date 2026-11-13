/**
 * Erzeuger der Saaten „Nikolaus läuft“, „vor dem Anpfiff“, „Pause“ und „alle beendet“ (G3-N N1a, @ZP-109; Regel T2-UI): das Nikolausturnier mit den
 * Daten des Mockups Runde 4 (`mockups/spielplan-g3-runde4`): 6 Teams, jeder gegen jeden, 1 Feld, 10 Minuten je Spiel ab 09:00, die
 * Paarungen 1, 2, 5, 6 und 15 wie im Mockup, der lange Name „Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921 e. V.“.
 *  - `nikolaus-laeuft`: Spiele 1–4 beendet, Spiel 5 läuft seit 4:12 Minuten (1:0, Restzeit 05:48), Spiele 6–15 geplant
 *  - `nikolaus-vor-anpfiff`: alle 15 Spiele geplant (Nächstes Spiel = Spiel 1)
 *  - `nikolaus-pause`: wie „läuft“, aber die Uhr von Spiel 5 steht (angehalten bei 4:12)
 *  - `nikolaus-alle-beendet`: alle 15 Spiele beendet
 * Das Turnier entsteht über die ECHTE Erzeugung (`erzeugeNikolaus`), danach werden Teamnamen, Paarungen, Anstoßzeiten und Stände gesetzt.
 * Aufruf: `npx tsx scripts/visual-metrics/saat/erzeuge-nikolaus-laeuft.ts`. Wird nie von `src/` importiert.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Match, Tournament } from '../../../src/types/tournament'
import { erzeugeNikolaus, NIKOLAUS_SHARE_CODE } from './erzeuge-nikolaus'

const HIER = dirname(fileURLToPath(import.meta.url))
const ZEIT = '2026-12-06T08:00:00.000Z'

/** Teams in der Reihenfolge der Erzeugung (Index = Position in `teams`) */
const NAMEN = ['DJK Kammer', 'TSV Waging rot', 'TSV Petting', 'DJK Otting', 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921 e. V.', 'TSV Waging blau']
const [KAMMER, ROT, PETTING, OTTING, SG, BLAU] = [0, 1, 2, 3, 4, 5]

/** Spiel 1–15: Heim, Gast (jedes Paar genau einmal; 1, 2, 5, 6, 15 wie im Mockup) */
const PAARUNGEN: [number, number][] = [
  [KAMMER, SG], [PETTING, OTTING], [BLAU, ROT], [KAMMER, OTTING], [SG, PETTING], [BLAU, KAMMER], [KAMMER, ROT], [PETTING, BLAU],
  [OTTING, SG], [PETTING, ROT], [KAMMER, PETTING], [OTTING, BLAU], [SG, ROT], [OTTING, ROT], [SG, BLAU],
]
/** Ergebnisse der Spiele 1–4 (Spiel 1 und 2 wie im Mockup) */
const ENDSTAENDE: [number, number][] = [[2, 1], [0, 0], [3, 1], [2, 0]]

const MINUTEN_JE_SPIEL = 10
const STUNDE_BEGINN = 9

function anstoss(nummer: number): string {
  const minuten = (nummer - 1) * MINUTEN_JE_SPIEL
  return new Date(2026, 11, 6, STUNDE_BEGINN, minuten).toISOString()
}

export type NikolausZustand = 'laeuft' | 'vor-anpfiff' | 'pause' | 'beendet'

/** Spiele 5–15 nach Ergebnis (nur für „alle beendet“) */
const REST_ENDSTAENDE: [number, number][] = [[1, 0], [2, 2], [0, 1], [3, 0], [1, 1], [2, 1], [0, 0], [1, 2], [4, 1], [2, 0], [1, 0]]

export async function erzeugeNikolausLaeuft(zustand: NikolausZustand): Promise<Tournament> {
  const laeuft = zustand === 'laeuft' || zustand === 'pause'
  const basis = await erzeugeNikolaus()
  const teams = basis.teams.map((t, i) => ({ ...t, name: NAMEN[i] ?? t.name }))
  const matches = basis.matches.map((m, i): Match => {
    const nummer = i + 1
    const [heim, gast] = PAARUNGEN[i] ?? [0, 1]
    const gemeinsam = {
      ...m,
      id: `00000009-0000-4000-8000-${String(nummer).padStart(12, '0')}`,
      matchNumber: nummer,
      slotA: { kind: 'team' as const, teamId: teams[heim]?.id ?? '' },
      slotB: { kind: 'team' as const, teamId: teams[gast]?.id ?? '' },
      scheduledTime: new Date(anstoss(nummer)),
    }
    const { scoreA: _a, scoreB: _b, decidedBy: _d, finishedAt: _f, timerElapsedSeconds: _t, ...offen } = gemeinsam as Match & Record<string, unknown>
    void [_a, _b, _d, _f, _t]
    const geplant = { ...offen, matchStatus: 'scheduled' } as Match
    const beendetMit = (x: number, y: number): Match => ({ ...geplant, scoreA: x, scoreB: y, matchStatus: 'finished', decidedBy: 'regular', finishedAt: ZEIT, timerElapsedSeconds: 600 } as Match)
    if (zustand === 'beendet') { const [x, y] = ENDSTAENDE[i] ?? REST_ENDSTAENDE[i - 4] ?? [0, 0]; return beendetMit(x, y) }
    if (!laeuft || nummer > 5) { return geplant }
    if (nummer < 5) {
      const [x, y] = ENDSTAENDE[i] ?? [0, 0]
      return { ...geplant, scoreA: x, scoreB: y, matchStatus: 'finished', decidedBy: 'regular', finishedAt: ZEIT, timerElapsedSeconds: 600 } as Match
    }
    return {
      ...geplant, scoreA: 1, scoreB: 0, matchStatus: zustand === 'pause' ? 'paused' : 'running', timerElapsedSeconds: zustand === 'pause' ? 252 : 0, timerStartTime: '@jetzt-252s',
      liveState: {
        engine: true, status: zustand === 'pause' ? 'paused' : 'running', phase: 'regular', section: 1, running: zustand !== 'pause', elapsedMs: zustand === 'pause' ? 252000 : 0, anchorAt: zustand === 'pause' ? '@jetzt-ms-0' : '@jetzt-ms-252000', elapsedSeconds: zustand === 'pause' ? 252 : 0,
        durationSeconds: 600, playPhase: 'regular', tiebreakerMode: 'overtime-then-shootout', overtimeDurationSeconds: 300, awaitingTiebreakerChoice: false,
        sections: 1, sectionSeconds: 600, breakSeconds: 60, overtimeSeconds: 300, sectionStartMs: 0, breakStartedAt: null,
      },
    } as unknown as Match
  })
  return { ...basis, id: `nikolaus-${zustand === 'beendet' ? 'alle-beendet' : zustand}`, title: 'Nikolaus-Turnier', teams, matches, timeSlot: '09:00 - 11:30', groupPhaseGameDuration: MINUTEN_JE_SPIEL, groupPhaseBreakDuration: 0 }
}

export async function main(): Promise<void> {
  const messlauf = JSON.parse(readFileSync(join(HIER, 'hallencup-messlauf.json'), 'utf8')) as {
    datenbanken: { name: string; version: number; store: string; eintraege: Record<string, unknown> }[]
    localStorage: Record<string, unknown>
  }
  for (const [name, zustand, beschreibung] of [
    ['nikolaus-laeuft', 'laeuft', 'Nikolausturnier (G3-N N1a) mit den Daten des Mockups Runde 4: Spiele 1–4 beendet, Spiel 5 läuft 1:0 (Restzeit 05:48), Spiele 6–15 geplant.'],
    ['nikolaus-vor-anpfiff', 'vor-anpfiff', 'Nikolausturnier (G3-N N1a) mit den Daten des Mockups Runde 4: alle 15 Spiele geplant, nächstes Spiel ist Spiel 1.'],
    ['nikolaus-pause', 'pause', 'Nikolausturnier (G3-N N1a): wie „läuft“, aber die Uhr von Spiel 5 steht (angehalten bei 4:12).'],
    ['nikolaus-alle-beendet', 'beendet', 'Nikolausturnier (G3-N N1a): alle 15 Spiele beendet, keine Karte oben.'],
  ] as const) {
    const turnier = await erzeugeNikolausLaeuft(zustand)
    const saat = {
      formatVersion: 1,
      name,
      beschreibung,
      datenbanken: messlauf.datenbanken.map((d) => (d.store === 'cache' ? { ...d, eintraege: { tournaments: [turnier] } } : { ...d, eintraege: {} })),
      localStorage: messlauf.localStorage,
      kennzahlen: { turnierId: turnier.id, shareCode: NIKOLAUS_SHARE_CODE, teams: NAMEN, spiele: turnier.matches.length },
    }
    writeFileSync(join(HIER, `${name}.json`), `${JSON.stringify(saat, null, 2)}\n`)
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
