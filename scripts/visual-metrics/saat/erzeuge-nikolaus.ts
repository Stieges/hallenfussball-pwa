/**
 * Erzeuger der Saat "Nikolaus Gleichstand" (Paket TB-B, TB-6; Regel T2-UI): das Nikolausturnier aus dem Plan (Jeder gegen jeden,
 * 6 Teams, alle 15 Spiele entschieden; TSV Petting und DJK Otting gleich auf Platz 3 und 4, Referenzdaten
 * `DATA.NIKOLAUS` aus `src/core/standings/__tests__/fixtures.ts`). Das Turnier entsteht über die ECHTE Erzeugung
 * (`TournamentCreationService.publish`); die Ergebnisse stehen direkt an den Spielen. Aufruf:
 * `npx tsx scripts/visual-metrics/saat/erzeuge-nikolaus.ts` schreibt `nikolaus-gleichstand.json`. Wird nie von `src/` importiert.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TournamentCreationService } from '../../../src/core/services/TournamentCreationService'
import type { ITournamentRepository } from '../../../src/core/repositories/ITournamentRepository'
import type { Match, Team, Tournament } from '../../../src/types/tournament'
import { DATA, NAME, id, type Key } from '../../../src/core/standings/__tests__/fixtures'

const HIER = dirname(fileURLToPath(import.meta.url))
export const NIKOLAUS_TURNIER_ID = 'nikolaus-gleichstand'
export const NIKOLAUS_SHARE_CODE = 'NIKO26'
const ZEIT = '2026-12-06T08:00:00.000Z'

const keinSpeicher = {
  get: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  updateMatches: () => Promise.resolve(),
} as unknown as ITournamentRepository

const TEAM_KEYS: Key[] = ['K', 'R', 'P', 'D', 'F', 'X']

export async function erzeugeNikolaus(): Promise<Tournament> {
  const teams: Team[] = TEAM_KEYS.map((k) => ({ id: id(k), name: NAME[k] }))
  const t = await new TournamentCreationService(keinSpeicher).publish({
    id: NIKOLAUS_TURNIER_ID, title: 'Nikolausturnier', ageClass: 'U11', date: '2026-12-06', startDate: '2026-12-06',
    startTime: '09:00', timeSlot: '09:00 - 16:00', location: { name: 'Sporthalle Nikolaus' },
    numberOfTeams: 6, numberOfGroups: 1, numberOfFields: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, finalRoundGameDuration: 10, finalRoundBreakDuration: 2,
    breakBetweenPhases: 5, resultMode: 'goals', gamePeriods: 1, halftimeBreak: 1,
    teams,
    finalsConfig: { preset: 'none', tiebreaker: 'overtime-then-shootout', tiebreakerDuration: 5 },
    finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    isPublic: true, shareCode: NIKOLAUS_SHARE_CODE, shareCodeCreatedAt: ZEIT, lastVisitedStep: 6,
  })
  const ergebnisse = new Map<string, [number, number]>()
  for (const part of DATA.NIKOLAUS.split(';')) {
    const m = /^\s*([A-Z])\s*–\s*([A-Z])\s+(\d+):(\d+)$/.exec(part)
    if (m === null) { throw new Error(`unlesbar: ${part}`) }
    ergebnisse.set(`${id(m[1] as Key)}|${id(m[2] as Key)}`, [Number(m[3]), Number(m[4])])
  }
  const seite = (m: Match, s: 'slotA' | 'slotB'): string => {
    const slot = m[s]
    if (slot.kind !== 'team') { throw new Error(`Seite ${s} von ${m.id} ist nicht besetzt`) }
    return slot.teamId
  }
  t.matches = t.matches.map((m, i) => {
    const a = seite(m, 'slotA'), b = seite(m, 'slotB')
    const direkt = ergebnisse.get(`${a}|${b}`)
    const gedreht = ergebnisse.get(`${b}|${a}`)
    const [x, y] = direkt ?? (gedreht === undefined ? [undefined, undefined] : [gedreht[1], gedreht[0]])
    if (x === undefined || y === undefined) { throw new Error(`kein Ergebnis für ${m.id}`) }
    return { ...m, id: `00000009-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, scoreA: x, scoreB: y, matchStatus: 'finished', decidedBy: 'regular', finishedAt: ZEIT, timerElapsedSeconds: 600 } as Match
  })
  return t
}

export async function main(): Promise<void> {
  const messlauf = JSON.parse(readFileSync(join(HIER, 'hallencup-messlauf.json'), 'utf8')) as {
    datenbanken: { name: string; version: number; store: string; eintraege: Record<string, unknown> }[]
    localStorage: Record<string, unknown>
  }
  const turnier = await erzeugeNikolaus()
  const saat = {
    formatVersion: 1,
    name: 'nikolaus-gleichstand',
    beschreibung: 'Nikolausturnier (Paket TB-B): Jeder gegen jeden, 6 Teams, alle 15 Spiele entschieden, TSV Petting und DJK Otting gleich auf Platz 3 und 4.',
    datenbanken: messlauf.datenbanken.map((d) => (d.store === 'cache' ? { ...d, eintraege: { tournaments: [turnier] } } : { ...d, eintraege: {} })),
    localStorage: messlauf.localStorage,
    kennzahlen: { turnierId: NIKOLAUS_TURNIER_ID, shareCode: NIKOLAUS_SHARE_CODE, teams: TEAM_KEYS.map((k) => NAME[k]), spiele: turnier.matches.length },
  }
  writeFileSync(join(HIER, 'nikolaus-gleichstand.json'), `${JSON.stringify(saat, null, 2)}\n`)
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
