/**
 * Erzeuger der Saat „Monitor Halle (sehr fern)“ (@ZM-212 bis @ZM-214; Regel T2-UI): ein Turnier je Fall, in jedem die Live-Folie auf Feld 1 mit
 * zwei Monitoren – `mon-halle` mit dem Profil „Halle (sehr fern)“ und `mon-fern` ohne Profil (bisherige Darstellung), beide mit denselben Daten.
 * Das Spiel des Falls ist das Halbfinale 1 (Heim = erster der Gruppe A, Gast = Zweiter der Gruppe B); die Gruppenspiele sind beendet. Der Zustand
 * entsteht über die echte Spiel-Engine (`wendeEngineAn`); nur „angehalten“ setzt die Pause von Hand wie die Saat „Nikolaus Pause“.
 * Spieldauer 20 Minuten, damit 22 Tore (10 : 12) vor der Restzeit 5:50 Platz haben; Halbzeit-Fall mit zwei Abschnitten zu 10 Minuten.
 * Das Turnier entsteht über die ECHTE Erzeugung (`TournamentCreationService.publish`). Aufruf: `npx tsx scripts/visual-metrics/saat/erzeuge-halle.ts`
 * schreibt `monitor-halle.json`. Wird nie von `src/` importiert (Testumgebung ist kein Produktivcode).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TournamentCreationService } from '../../../src/core/services/TournamentCreationService'
import type { ITournamentRepository } from '../../../src/core/repositories/ITournamentRepository'
import { matchCopyKey } from '../../../src/core/match/client/matchCopy'
import type { MonitorSlide, TournamentMonitor } from '../../../src/types/monitor'
import type { Match, Team, Tournament } from '../../../src/types/tournament'
import { halbfinaleVon, schliesseGruppenAb, wendeEngineAn, type EngineKopie, type EreignisPlanEingabe } from './erzeuge-saat'

const HIER = dirname(fileURLToPath(import.meta.url))
export const HALLE_SAAT_NAME = 'monitor-halle'
const ZEIT = '2026-11-17T08:00:00.000Z'
const BLAU = '#1565C0'
const ROT = '#C62828'
const WEISS = '#FFFFFF'
const GELB = '#FFCC00'
const LEIBCHEN = '#FF6600'

export type HalleZustand = 'vor' | 'laeuft' | 'angehalten' | 'halbzeit' | 'ende' | 'ende-strafstoss' | 'schiessen'

export interface HalleFall {
  id: string
  code: string
  titel: string
  zustand: HalleZustand
  heim: string
  gast: string
  /** Stand nach der regulären Spielzeit (Heim, Gast); im Strafstoß-Fall der Stand vor dem Schießen */
  stand: [number, number]
  farben?: { heim?: string; gast?: string }
  /** Heim trägt bestätigte Leibchen (Orange) */
  leibchen?: boolean
}

const LANG_A = 'SG Kirchanschöring/Fridol'
const LANG_B = 'FC Rotweiss Hinterwald Os'

export const FAELLE: readonly HalleFall[] = [
  { id: 'halle-team34', code: 'HAL001', titel: 'Läuft: Team 3 gegen Team 4, 1:0', zustand: 'laeuft', heim: 'Team 3', gast: 'Team 4', stand: [1, 0] },
  { id: 'halle-laeuft', code: 'HAL002', titel: 'Läuft: TSV Fridolfing gegen SG Taching/Tengling, 1:0', zustand: 'laeuft', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 0] },
  { id: 'halle-djk', code: 'HAL003', titel: 'Läuft: TSV Fridolfing gegen DJK Otting, 1:0', zustand: 'laeuft', heim: 'TSV Fridolfing', gast: 'DJK Otting', stand: [1, 0] },
  { id: 'halle-zweistellig', code: 'HAL004', titel: 'Läuft: TSV Fridolfing gegen SG Taching/Tengling, 10:12', zustand: 'laeuft', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [10, 12] },
  { id: 'halle-lang25', code: 'HAL005', titel: 'Läuft: zwei Namen mit 25 Zeichen, 2:2', zustand: 'laeuft', heim: LANG_A, gast: LANG_B, stand: [2, 2] },
  { id: 'halle-vor', code: 'HAL006', titel: 'Vor dem Anpfiff: Nächstes Spiel', zustand: 'vor', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [0, 0] },
  { id: 'halle-angehalten', code: 'HAL007', titel: 'Uhr angehalten, 1:0', zustand: 'angehalten', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 0] },
  { id: 'halle-halbzeit', code: 'HAL008', titel: 'Halbzeitpause, 1:0', zustand: 'halbzeit', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 0] },
  { id: 'halle-ende', code: 'HAL009', titel: 'Ende: Endstand 3:1', zustand: 'ende', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [3, 1] },
  { id: 'halle-ende-strafstoss', code: 'HAL010', titel: 'Ende nach Strafstoßschießen 4:3 (Stand vorher 1:1)', zustand: 'ende-strafstoss', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 1] },
  { id: 'halle-schiessen', code: 'HAL011', titel: 'Strafstoßschießen läuft, Zwischenstand 3:2', zustand: 'schiessen', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 1] },
  { id: 'halle-weiss', code: 'HAL012', titel: 'Läuft: Heim in Weiß, 1:0', zustand: 'laeuft', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 0], farben: { heim: WEISS } },
  { id: 'halle-gelb', code: 'HAL013', titel: 'Läuft: Gast in Gelb, 1:0', zustand: 'laeuft', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 0], farben: { gast: GELB } },
  { id: 'halle-leibchen', code: 'HAL014', titel: 'Läuft: Heim trägt Leibchen, 1:0', zustand: 'laeuft', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 0], leibchen: true },
  { id: 'halle-ohne-farbe', code: 'HAL015', titel: 'Läuft: Gast ohne Trikotfarbe (Fallback-Muster), 1:0', zustand: 'laeuft', heim: 'TSV Fridolfing', gast: 'SG Taching/Tengling', stand: [1, 0], farben: { gast: '' } },
]

const keinSpeicher = {
  get: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  updateMatches: () => Promise.resolve(),
} as unknown as ITournamentRepository

const live: Omit<MonitorSlide, 'order' | 'duration'> = { id: 's-live', type: 'live', config: { fieldId: 'field-1' } }
const monitor = (id: string, name: string, profile?: 'hall-very-far'): TournamentMonitor => ({
  id, name, defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark', performanceMode: 'auto',
  ...(profile === undefined ? {} : { profile }),
  slides: [{ ...live, order: 0, duration: null }], createdAt: ZEIT, updatedAt: ZEIT,
})

const uuid = (n: number): string => `0000000c-0000-4000-8000-${String(n).padStart(12, '0')}`
const SEKUNDEN_JETZT = 850
const marke = (sekunden: number): Date => `@jetzt${sekunden < 0 ? '-' : '+'}${String(Math.abs(sekunden))}s` as unknown as Date

/** Tore abwechselnd, bis beide Seiten ihren Stand haben (Heim zuerst) */
function toreFolge(heim: string, gast: string, stand: [number, number]): string[] {
  const rest: [number, number] = [stand[0], stand[1]]
  const folge: string[] = []
  while (rest[0] > 0 || rest[1] > 0) {
    if (rest[0] > 0) { folge.push(heim); rest[0]-- }
    if (rest[1] > 0) { folge.push(gast); rest[1]-- }
  }
  return folge
}

export async function erzeugeFall(fall: HalleFall): Promise<{ turnier: Tournament; kopien: EngineKopie[] }> {
  const farbe = (seite: 'heim' | 'gast', standard: string): string | undefined => {
    const gesetzt = fall.farben?.[seite]
    return gesetzt === undefined ? standard : gesetzt === '' ? undefined : gesetzt
  }
  // Gruppe A: Heim-Kandidat und Gegner, Gruppe B: Gegner und Gast-Kandidat; welche Teams im Halbfinale 1 stehen, ergibt die echte Erzeugung
  const namen = ['Platzhalter A1', 'Platzhalter A2', 'Platzhalter B1', 'Platzhalter B2']
  const teams: Team[] = namen.map((name, i) => ({ id: uuid(i + 1), name, group: i < 2 ? 'A' : 'B' }))
  const t = await new TournamentCreationService(keinSpeicher).publish({
    id: fall.id, title: 'Monitor Halle (sehr fern)', ageClass: 'U11', date: '2026-12-06', startDate: '2026-12-06',
    startTime: '09:00', timeSlot: '09:00 - 16:00', location: { name: 'Sporthalle Fridolfing' },
    numberOfTeams: 4, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
    groupPhaseGameDuration: 20, groupPhaseBreakDuration: 2, finalRoundGameDuration: 20, finalRoundBreakDuration: 2,
    breakBetweenPhases: 5, resultMode: 'goals', gamePeriods: fall.zustand === 'halbzeit' ? 2 : 1, halftimeBreak: 1,
    teams, groups: [{ id: 'A', customName: 'Gruppe A' }, { id: 'B', customName: 'Gruppe B' }],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }] as Tournament['fields'],
    finalsConfig: { preset: 'top-4', tiebreaker: 'overtime-then-shootout', tiebreakerDuration: 5 },
    finals: { final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false },
    isPublic: true, shareCode: fall.code, shareCodeCreatedAt: ZEIT, lastVisitedStep: 6,
    monitors: [monitor('mon-halle', 'Halle (sehr fern)', 'hall-very-far'), monitor('mon-fern', 'Spielfeld (fern)')],
  } as unknown as Parameters<TournamentCreationService['publish']>[0])
  // Feste Spiel-Kennungen: die Erzeugung vergibt zufällige; die Datei ist eingefroren und muss bei jeder Erzeugung gleich sein (auch in den Verweisen der Finalrunde).
  // Je Fall eigene Kennungen: die lokale Engine-Kopie eines Spiels hängt an der Spiel-Kennung (gleiche Kennung in zwei Fällen überschriebe sich im Browser)
  const fallNr = String(FAELLE.indexOf(fall) + 1).padStart(4, '0')
  let text = JSON.stringify(t)
  t.matches.forEach((m, i) => { text = text.split(m.id).join(`0000000c-${fallNr}-4000-9000-${String(i + 1).padStart(12, '0')}`) })
  Object.assign(t, JSON.parse(text) as Tournament)
  const start = Date.parse(ZEIT)
  const kopien: EngineKopie[] = []
  const ersetze = (alt: Match, neu: Match, kopie?: EngineKopie): void => {
    t.matches = t.matches.map((m) => (m.id === alt.id ? neu : m))
    if (kopie !== undefined) { kopien.push(kopie) }
  }
  const seite = (m: Match, s: 'slotA' | 'slotB'): string => {
    const sl = m[s]
    if (sl.kind !== 'team') { throw new Error(`Seite ${s} von ${m.id} ist nicht besetzt`) }
    return sl.teamId
  }
  // Gruppenspiele beenden (Heim-Kandidat gewinnt je Gruppe), danach die Gruppen abschließen
  t.matches.filter((m) => !m.isFinal).forEach((m, i) => {
    const e = wendeEngineAn(t, m, seite(m, 'slotA'), seite(m, 'slotB'), { tore: [seite(m, 'slotA')], bis: 'ende' }, start - 6_000_000 + i * 900_000)
    ersetze(m, { ...e.match, scheduledTime: marke(-4000 + i * 900) }, e.kopie)
  })
  schliesseGruppenAb(t)
  // feste Zeit: der Abschluss liest die Uhr des Rechners, die Datei muss bei jeder Erzeugung gleich sein
  t.groupCompletions = t.groupCompletions?.map((c) => ({ ...c, completedAt: ZEIT }))
  const [hf1, hf2] = halbfinaleVon(t)
  const [heimId, gastId] = [seite(hf1, 'slotA'), seite(hf1, 'slotB')]
  const restTeams = teams.filter((x) => x.id !== heimId && x.id !== gastId)
  const bekannt = new Map<string, string>([[heimId, fall.heim], [gastId, fall.gast], [restTeams[0].id, 'SV Gegner 1'], [restTeams[1].id, 'SV Gegner 2']])
  t.teams = t.teams.map((x) => {
    const basis = { ...x, name: bekannt.get(x.id) ?? x.name }
    const farbeDe = x.id === heimId ? farbe('heim', BLAU) : x.id === gastId ? farbe('gast', ROT) : GELB
    const { colors: _alt, ...ohneFarbe } = basis
    void _alt
    return farbeDe === undefined ? ohneFarbe : { ...ohneFarbe, colors: { primary: farbeDe } }
  })

  const tore = toreFolge(heimId, gastId, fall.stand)
  const jetzt = SEKUNDEN_JETZT * 1000
  const plan: Record<HalleZustand, EreignisPlanEingabe | null> = {
    vor: null,
    laeuft: { tore, bis: 'laeuft', toreBisMs: jetzt, jetztNachAnpfiffMs: jetzt },
    angehalten: { tore, bis: 'laeuft', toreBisMs: jetzt, jetztNachAnpfiffMs: jetzt },
    halbzeit: { tore, bis: 'halbzeitpause' },
    ende: { tore, bis: 'ende' },
    'ende-strafstoss': { tore, bis: 'ende', verlaengerung: {}, elfmeter: { a: [true, true, false, true, true], b: [true, false, true, true, false], beendet: true } },
    schiessen: { tore, bis: 'ende', verlaengerung: {}, elfmeter: { a: [true, true, true], b: [true, true, false], beendet: false } },
  }
  const geplant = plan[fall.zustand]
  // Getragene Farben des Spiels (`match.kit`, beim Anpfiff festgelegt): ohne sie zeigt der Monitor die Standardfarben; eine fehlende Seite zeigt das Fallback-Muster
  const heimFarbe = farbe('heim', BLAU)
  const gastFarbe = farbe('gast', ROT)
  const getragen = fall.leibchen === true ? { a: LEIBCHEN, ...(gastFarbe === undefined ? {} : { b: gastFarbe }), bibSide: 'a' as const } : { ...(heimFarbe === undefined ? {} : { a: heimFarbe }), ...(gastFarbe === undefined ? {} : { b: gastFarbe }) }
  const bib = { kit: getragen, ...(fall.leibchen === true ? { kitDecision: 'bib' as const } : {}) }
  if (geplant === null) {
    ersetze(hf1, { ...hf1, matchStatus: 'scheduled', scheduledTime: marke(240), ...bib } as Match)
  } else {
    const e = wendeEngineAn(t, hf1, heimId, gastId, geplant, start + 20_000_000)
    let neu: Match = { ...e.match, scheduledTime: marke(fall.zustand === 'laeuft' || fall.zustand === 'angehalten' ? -SEKUNDEN_JETZT : -300), ...bib } as Match
    if (fall.zustand === 'angehalten') {
      // Uhr angehalten (Tom hat sie angehalten): Pause von Hand wie in der Saat „Nikolaus Pause“; die Zeit bleibt bei 850 Sekunden stehen
      const alt = neu.liveState as Record<string, unknown>
      neu = { ...neu, matchStatus: 'paused', timerStartTime: undefined, timerElapsedSeconds: SEKUNDEN_JETZT, liveState: { ...alt, status: 'paused', anchorAt: null, elapsedMs: jetzt } } as unknown as Match
    }
    ersetze(hf1, neu, e.kopie)
  }
  // Halbfinale 2, Platz 3 und Finale bleiben ungespielt, später am Tag
  t.matches = t.matches.map((m) => (m.id === hf2.id || (m.isFinal === true && m.id !== hf1.id) ? { ...m, scheduledTime: marke(1500) } : m))
  Object.assign(t, { createdAt: ZEIT, updatedAt: ZEIT, publishedAt: ZEIT, date: '@heute', startDate: '@heute' })
  if (fall.leibchen === true) { Object.assign(t, { bibColor: LEIBCHEN, bibColors: [LEIBCHEN], bibRule: 'home' }) }
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
    name: HALLE_SAAT_NAME,
    beschreibung: 'Monitor Halle (sehr fern): ein Turnier je Fall (Läuft, vor dem Anpfiff, angehalten, Halbzeit, Ende, Strafstoßschießen, Namen, helle Trikots, Leibchen); Monitor mon-halle mit dem Profil, mon-fern ohne.',
    datenbanken: messlauf.datenbanken.map((d) => (d.store === 'cache' ? { ...d, eintraege: { tournaments: turniere } } : { ...d, eintraege: Object.fromEntries(kopien.map((k) => [matchCopyKey(k.accountId, k.matchId), k])) })),
    localStorage: messlauf.localStorage,
    kennzahlen: { faelle: FAELLE.map((f) => ({ turnierId: f.id, shareCode: f.code, titel: f.titel })), monitore: ['mon-halle', 'mon-fern'] },
  }
  writeFileSync(join(HIER, `${HALLE_SAAT_NAME}.json`), `${JSON.stringify(saat, null, 2)}\n`)
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
