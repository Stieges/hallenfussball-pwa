/**
 * Erzeuger der Saat "Leibchen vor dem Anpfiff" (Leibchen 2b, Punkt 8; Regel T2-UI): Spiel 2 SV Aschau 2:1 FC Seeon ist beendet, als Nächstes folgt Spiel 3
 * TSV Waging 1 (Blau) gegen TSV Petting (Blau) auf Feld 1 – der Anstoß liegt kurz vor "jetzt" (Marke `@jetzt+240s`, das Turnierdatum ist `@heute`), damit die
 * Live-Folie "Nächstes Spiel" des Hallenmonitors und der Kopf "Als Nächstes" der Zuschauer-Seite erscheinen (Vorlaufzeit mindestens 5 Minuten, @ZM-138).
 *
 * Ein Turnier je Fall der Bildfreigabe (Mockup Runde 3, Abschnitt 7; @ZM-195, @ZM-200, @ZM-201, @ZM-203, @ZM-204):
 *   7a Blau gegen Blau, Leibchen nicht geklärt · 7b Waging zieht Gelb, bestätigt (Weste Gelb über Blau) · 7c Waging ohne Trikotfarbe (gestreift) ·
 *   7d Weste über dem gestreiften Kasten (bestätigt, Trikotfarbe fehlt) · 7e beide Teams ohne Trikotfarbe (Standardfarben) ·
 *   lang: wie 7b mit dem Namen "Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921".
 * Das Turnier entsteht über die ECHTE Erzeugung (`TournamentCreationService.publish`). Aufruf: `npx tsx scripts/visual-metrics/saat/erzeuge-leibchen.ts`
 * schreibt `leibchen-vor-anpfiff.json`. Wird nie von `src/` importiert (Testumgebung ist kein Produktivcode).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TournamentCreationService } from '../../../src/core/services/TournamentCreationService'
import type { ITournamentRepository } from '../../../src/core/repositories/ITournamentRepository'
import { matchCopyKey } from '../../../src/core/match/client/matchCopy'
import { slotTeamId, teamSlot } from '../../../src/core/models/matchSlot'
import type { MonitorSlide, TournamentMonitor } from '../../../src/types/monitor'
import type { Match, Team, Tournament } from '../../../src/types/tournament'
import { wendeEngineAn, type EngineKopie } from './erzeuge-saat'

const HIER = dirname(fileURLToPath(import.meta.url))
export const LEIBCHEN_SAAT_NAME = 'leibchen-vor-anpfiff'
const ZEIT = '2026-12-06T08:00:00.000Z'
const BLAU = '#1565C0'
const GELB = '#FFCC00'
const ORANGE = '#FF6600'
const LANG = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921'

const uuid = (n: number): string => `0000000b-0000-4000-8000-${String(n).padStart(12, '0')}`
const ASCHAU = uuid(1)
const SEEON = uuid(2)
const WAGING = uuid(3)
const PETTING = uuid(4)

export interface LeibchenFall {
  id: string
  code: string
  titel: string
  /** Trikotfarbe von Waging 1 und Petting (`undefined` = keine eingetragen). */
  waging: string | undefined
  petting: string | undefined
  /** Wahl der Leibchen am Spiel 3: bestätigt (Waging zieht Gelb) oder offen. */
  bestaetigt: boolean
  name?: string
  /** Spiel 2 ist eben beendet (Engine-Kopie): das Cockpit zeigt den Endstand, die Karte für Spiel 3 steht darüber (@SL-215). */
  endstand?: boolean
}

export const FAELLE: readonly LeibchenFall[] = [
  { id: 'leibchen-7a', code: 'LBX2A7', titel: '7a Blau gegen Blau, Leibchen nicht geklärt', waging: BLAU, petting: BLAU, bestaetigt: false },
  { id: 'leibchen-7b', code: 'LBX2B7', titel: '7b Waging 1 zieht Gelb, bestätigt', waging: BLAU, petting: BLAU, bestaetigt: true },
  { id: 'leibchen-7c', code: 'LBX2C7', titel: '7c Waging 1 ohne Trikotfarbe', waging: undefined, petting: BLAU, bestaetigt: false },
  { id: 'leibchen-7d', code: 'LBX2D7', titel: '7d Weste über dem gestreiften Kasten', waging: undefined, petting: BLAU, bestaetigt: true },
  { id: 'leibchen-7e', code: 'LBX2E7', titel: '7e beide Teams ohne Trikotfarbe', waging: undefined, petting: undefined, bestaetigt: false },
  { id: 'leibchen-endstand', code: 'LBX2S7', titel: 'Endstand von Spiel 2 mit der Karte für Spiel 3', waging: BLAU, petting: BLAU, bestaetigt: false, endstand: true },
  { id: 'leibchen-lang', code: 'LBX2L7', titel: 'Waging 1 mit langem Namen, bestätigt', waging: BLAU, petting: BLAU, bestaetigt: true, name: LANG },
]

const keinSpeicher = {
  get: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  updateMatches: () => Promise.resolve(),
} as unknown as ITournamentRepository

const live: Omit<MonitorSlide, 'order' | 'duration'> = { id: 's-live', type: 'live', config: { fieldId: 'field-1' } }
const MONITOR: TournamentMonitor = {
  id: 'mon-live', name: 'Folie Live', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark', performanceMode: 'auto',
  slides: [{ ...live, order: 0, duration: null }], createdAt: ZEIT, updatedAt: ZEIT,
}

const team = (id: string, name: string, primary: string | undefined): Team => (primary === undefined ? { id, name } : { id, name, colors: { primary } })

export async function erzeugeFall(fall: LeibchenFall): Promise<{ turnier: Tournament; kopien: EngineKopie[] }> {
  const teams = [team(ASCHAU, 'SV Aschau', '#C62828'), team(SEEON, 'FC Seeon', '#2E7D32'), team(WAGING, fall.name ?? 'TSV Waging 1', fall.waging), team(PETTING, 'TSV Petting', fall.petting)]
  const t = await new TournamentCreationService(keinSpeicher).publish({
    id: fall.id, title: 'Leibchen vor dem Anpfiff', ageClass: 'U11', date: '2026-12-06', startDate: '2026-12-06',
    startTime: '09:00', timeSlot: '09:00 - 16:00', location: { name: 'Sporthalle Waging' },
    numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 9, groupPhaseBreakDuration: 2, finalRoundGameDuration: 9, finalRoundBreakDuration: 2,
    breakBetweenPhases: 5, resultMode: 'goals', gamePeriods: 1, halftimeBreak: 1,
    teams, bibColor: GELB,
    finalsConfig: { preset: 'none', tiebreaker: 'overtime-then-shootout', tiebreakerDuration: 5 },
    finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    isPublic: true, shareCode: fall.code, shareCodeCreatedAt: ZEIT, lastVisitedStep: 6,
    monitors: [MONITOR],
  } as unknown as Parameters<TournamentCreationService['publish']>[0])
  // feste Zeitstempel: die Datei ist eingefroren und muss bei jeder Erzeugung gleich sein
  // Turnierdatum: "heute" (der Lader löst die Marke auf), die Zeiten der gespielten Spiele bleiben fest
  // Hallenfarben Gelb und Orange, bei gleicher Farbe zieht Heim (@W3-029, @W3-041)
  Object.assign(t, { createdAt: ZEIT, updatedAt: ZEIT, publishedAt: ZEIT, date: '@heute', startDate: '@heute', bibColor: GELB, bibColors: [GELB, ORANGE], bibRule: 'home' })
  const matches = [...t.matches].sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))
  t.matches = matches.map((m, i): Match => {
    const id = `0000000b-0000-4000-9000-${String(i + 1).padStart(12, '0')}`
    const nr = i + 1
    if (nr === 3) {
      // Spiel 3: das nächste Spiel auf Feld 1, beginnt gleich
      const bib = fall.bestaetigt ? { kitDecision: 'bib' as const, kit: { a: GELB, bibSide: 'a' as const } } : {}
      return { ...m, id, matchNumber: 3, field: 1, slotA: teamSlot(WAGING), slotB: teamSlot(PETTING), matchStatus: 'scheduled', scheduledTime: '@jetzt+240s' as unknown as Date, ...bib }
    }
    const [a, b] = nr === 2 ? [ASCHAU, SEEON] : [slotTeamId(m.slotA) ?? ASCHAU, slotTeamId(m.slotB) ?? SEEON]
    // Spiel 1 und 2 sind beendet (Spiel 2: SV Aschau 2:1 FC Seeon), Spiel 3 ist das nächste, Spiel 4 und später stehen noch aus
    // Anstoßzeiten im Takt von 12 Minuten, Spiel 3 um „jetzt + 240 s“: Spiel 1 und 2 davor, Spiel 4 danach (die Reihenfolge 1, 2, 3, 4 …, @SL-206)
    const zeit = `@jetzt${nr < 3 ? '-' : '+'}${String(Math.abs(240 + (nr - 3) * 720))}s` as unknown as Date
    const vorbei = { scoreA: nr === 2 ? 2 : 1, scoreB: nr === 2 ? 1 : 0, matchStatus: 'finished' as const, decidedBy: 'regular' as const, finishedAt: ZEIT, timerElapsedSeconds: 540 }
    return { ...m, id, field: 1, scheduledTime: zeit, slotA: teamSlot(a), slotB: teamSlot(b), ...(nr < 3 ? vorbei : { matchStatus: 'scheduled' as const }) }
  })
  const kopien: EngineKopie[] = []
  if (fall.endstand === true) {
    // Spiel 2 über die echte Engine: eben beendet (der Lader löst die Zeitmarken auf), damit das Cockpit den Endstand zeigt
    const spiel2 = t.matches.find((m) => m.matchNumber === 2)
    if (spiel2 === undefined) { throw new Error('Spiel 2 fehlt') }
    const e = wendeEngineAn(t, spiel2, ASCHAU, SEEON, { tore: [ASCHAU, SEEON, ASCHAU], bis: 'ende', ebenBeendet: true }, Date.parse(ZEIT))
    t.matches = t.matches.map((m) => (m.id === spiel2.id ? e.match : m))
    kopien.push(e.kopie)
  }
  return { turnier: t, kopien }
}

export async function main(): Promise<void> {
  const messlauf = JSON.parse(readFileSync(join(HIER, 'hallencup-messlauf.json'), 'utf8')) as {
    datenbanken: { name: string; version: number; store: string; eintraege: Record<string, unknown> }[]
    localStorage: Record<string, unknown>
  }
  const faelle = await Promise.all(FAELLE.map(erzeugeFall))
  const turniere = faelle.map((f) => f.turnier)
  const kopien = faelle.flatMap((f) => f.kopien)
  const saat = {
    formatVersion: 1,
    name: LEIBCHEN_SAAT_NAME,
    beschreibung: 'Leibchen vor dem Anpfiff (Leibchen 2b): Spiel 2 SV Aschau 2:1 FC Seeon beendet, Spiel 3 TSV Waging 1 gegen TSV Petting beginnt gleich; ein Turnier je Fall 7a bis 7e der Bildfreigabe und ein Fall mit langem Namen.',
    datenbanken: messlauf.datenbanken.map((d) => (d.store === 'cache' ? { ...d, eintraege: { tournaments: turniere } } : { ...d, eintraege: Object.fromEntries(kopien.map((k) => [matchCopyKey(k.accountId, k.matchId), k])) })),
    localStorage: messlauf.localStorage,
    kennzahlen: { faelle: FAELLE.map((f) => ({ turnierId: f.id, shareCode: f.code, titel: f.titel })), naechstesSpiel: 'Spiel 3', beendetesSpiel: 'Spiel 2' },
  }
  writeFileSync(join(HIER, `${LEIBCHEN_SAAT_NAME}.json`), `${JSON.stringify(saat, null, 2)}\n`)
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
