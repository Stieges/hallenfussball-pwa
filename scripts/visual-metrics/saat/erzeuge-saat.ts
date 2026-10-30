/**
 * Erzeuger der Saat "Hallencup Messlauf" (Paket SM, @TA-011, R-SM-1 bis R-SM-3).
 *
 * Das Turnier entsteht ueber die ECHTE Erzeugung (`TournamentCreationService.createDraft/publish`, darin
 * `generateFullSchedule`); die Ergebnisse der Spiele entstehen aus Ereignissen der echten Spiel-Engine
 * (`reduceMatch` + `cacheColumns`), nicht aus von Hand gesetzten Spalten. Die Datei `hallencup-messlauf.json`
 * ist das eingefrorene Ergebnis. `scripts/` liegt ausserhalb von `tsc`; deshalb prueft der Vitest-Test
 * `__tests__/saat.test.ts`, dass die eingefrorene Datei einer frischen Erzeugung entspricht.
 *
 * Wird NIE von `src/` importiert (Testumgebung ist kein Produktivcode). Der Erzeuger liest das Systemdatum
 * (Veroeffentlichungszeit); der Aufrufer friert es ein (`SAAT_ZEIT`).
 */
import { TournamentCreationService } from '../../../src/core/services/TournamentCreationService';
import { resolveBracketAfterPlayoffMatch } from '../../../src/core/generators';
import { activeRanking, expectedState } from '../../../src/core/services/GroupCompletionService';
import { applyCompleteGroup } from '../../../src/core/repositories/localGroupCompletion';
import { cacheColumns, reduceMatch, serverRules } from '../../../src/core/match';
import type { EngineEvent, MatchContext, MatchRules } from '../../../src/core/match';
import { MATCH_COPY_FORMAT_VERSION, matchCopyKey } from '../../../src/core/match/client/matchCopy';
import type { ITournamentRepository } from '../../../src/core/repositories/ITournamentRepository';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Match, type Team, type Tournament } from '../../../src/types/tournament';
import { pendingSlot } from '../../../src/core/models/matchSlot'
import type { Sponsor } from '../../../src/types/sponsor';
import type { MonitorSlide, TournamentMonitor } from '../../../src/types/monitor';

export const SAAT_NAME = 'hallencup-messlauf'
export const SAAT_FORMAT = 1
/** Fester "Jetzt"-Zeitpunkt der Erzeugung (Veroeffentlichung, Ereigniszeiten); die Messung nutzt echte Zeit. */
export const SAAT_ZEIT = '2026-11-14T08:00:00.000Z'
export const TURNIER_ID = 'hallencup-messlauf'
export const SHARE_CODE = 'MESS26'
export const ABSCHLUSS_ID = 'abschluss-messlauf'
export const ENTWURF_ID = 'hallencup-entwurf'

/** Marke fuer "Zeit relativ zum Laden", vom Lader beim Befuellen aufgeloest (laufendes Spiel). */
export const JETZT_MARKE = '@jetzt'

export interface SaatDatei {
  formatVersion: number
  name: string
  beschreibung: string
  /**
   * IndexedDB-Datenbanken: `hallenfussball`/`cache` (Turniere, wie `IndexedDBAdapter` sie liest) und
   * `hallenfussball-matches`/`matches` (lokale Engine-Kopien des Gastkontos, wie `LocalMatchStore` sie liest).
   * Eintraege: Schluessel -> Wert; der Lader legt `{ key, value }` ab.
   */
  datenbanken: { name: string; version: number; store: string; eintraege: Record<string, unknown> }[]
  /** localStorage-Eintraege, Wert wird als JSON abgelegt. */
  localStorage: Record<string, unknown>
  /** Pflicht-Merkmale zur Kontrolle (Teamnamen, Spiel-IDs je Rolle). */
  kennzahlen: Record<string, unknown>
}

const uuid = (kind: number, n: number): string => `0000${String(kind).padStart(4, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`

const LANG_A = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921'
const LANG_B = 'Eintracht Oberweiler-Niederstetten 1919'

const TEAMS: Team[] = [
  { id: uuid(1, 1), name: LANG_A, group: 'A' },
  { id: uuid(1, 2), name: 'Turn- und Sportverein Ost', group: 'A' },
  { id: uuid(1, 3), name: 'FC Nordstadt', group: 'A' },
  { id: uuid(1, 4), name: 'SV Südpark', group: 'A' },
  { id: uuid(1, 5), name: LANG_B, group: 'B' },
  { id: uuid(1, 6), name: 'TSV Westtal', group: 'B' },
  { id: uuid(1, 7), name: 'BSC Ostring', group: 'B' },
  { id: uuid(1, 8), name: 'Sportvereinigung Nordheim', group: 'B' },
]

/** Nur die Teile des Repositories, die `publish` benutzt (kein Speicher noetig). */
const keinSpeicher = {
  get: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  updateMatches: () => Promise.resolve(),
} as unknown as ITournamentRepository

// ---------- Spiel-Engine ----------

/** Regeln wie sie die App beim Anpfiff rechnet (`serverRules`, gleiche Eingabe wie `engineMatchModel.rulesFor`). */
function regelnFuer(t: Tournament, phase: string): MatchRules {
  return serverRules({
    durationMinutes: null, phase,
    groupPhaseDuration: t.groupPhaseGameDuration, finalRoundDuration: t.finalRoundGameDuration ?? null,
    config: { gamePeriods: t.gamePeriods, halftimeBreak: t.halftimeBreak, matchCockpitSettings: t.matchCockpitSettings },
    finalsConfig: t.finalsConfig ?? null,
  })
}

interface EreignisPlan {
  /** Tore der regulaeren Spielzeit in Reihenfolge (Team-ID); sie verteilen sich gleichmaessig ueber die Spielzeit. */
  tore: string[]
  /** Rueckennummer je Tor (gleicher Index wie `tore`); `undefined` = Nummer fehlt (die Ereignisliste zeigt dann das Warnzeichen). */
  nummern?: (number | undefined)[]
  /** Bis zu welcher Spielzeit (ms) sich die Tore verteilen; Vorgabe: die ganze Spielzeit (bzw. ein Abschnitt in der Halbzeitpause). */
  toreBisMs?: number
  /** Karten der regulaeren Spielzeit (Abschnitt 1): Art, Team-ID, Spieluhr (ms), Rueckennummer. */
  karten?: Array<{ art: 'YELLOW_CARD' | 'YELLOW_RED_CARD' | 'RED_CARD'; teamId: string; clockMs: number; nummer: number }>
  /** Wie weit die Regelspielzeit gespielt ist: laeuft, in der Halbzeitpause oder beendet. */
  bis: 'laeuft' | 'halbzeitpause' | 'ende'
  /** Nach einem Remis in die Verlaengerung: Tor (Team-ID), ob sie noch laeuft. */
  verlaengerung?: { tor?: string; laeuft?: boolean }
  /** Strafstoßschießen nach unentschiedener Verlaengerung: Treffer je Schuetze; beendet = SHOOTOUT_END. */
  elfmeter?: { a: boolean[]; b: boolean[]; beendet: boolean }
  /** Zeit seit Anpfiff bis "jetzt" fuer ein laufendes Spiel (ms); Vorgabe: 20 s nach dem letzten Ereignis. */
  jetztNachAnpfiffMs?: number
  /**
   * LT-6: beendetes Spiel mit Zeiten relativ zum Laden -- der Abpfiff liegt 2 Sekunden vor „jetzt“, der Endstand steht noch als
   * Quittung (@SL-152), „Spiel fortsetzen“ ist angeboten (@SL-074).
   */
  ebenBeendet?: boolean
}

let ereignisZaehler = 0

function baueEreignisse(ctx: MatchContext, rules: MatchRules, plan: EreignisPlan, start: number): EngineEvent[] {
  const nr = ++ereignisZaehler
  let n = 0
  const secMs = rules.sectionSeconds * 1000
  const pauseMs = rules.breakSeconds * 1000
  const gesamt = rules.sections * secMs
  const atOf = (clockMs: number, section: number): number => start + clockMs + (section - 1) * pauseMs
  const e = (type: EngineEvent['type'], section: number, clockMs: number | null, extra: Partial<EngineEvent> = {}): EngineEvent => ({
    id: uuid(2, nr * 100 + ++n), type, actor: 'helper', actorUser: 'helper',
    at: clockMs === null ? start : atOf(clockMs, section), section, clockMs, payload: {}, ...extra,
  })
  const log: EngineEvent[] = [e('MATCH_START', 1, null, { payload: { rules } })]
  // Tore: gleichmaessig verteilt, 20 s vor der Gleichverteilung (nie genau auf einer Abschnittsgrenze).
  const spanne = plan.toreBisMs ?? (plan.bis === 'halbzeitpause' ? secMs : gesamt)
  plan.tore.forEach((teamId, i) => {
    const clockMs = Math.round(((i + 1) * spanne) / (plan.tore.length + 1)) - 20_000
    const section = Math.min(rules.sections, Math.floor(clockMs / secMs) + 1)
    const nummer = plan.nummern?.[i]
    log.push(e('GOAL', section, clockMs, nummer === undefined ? { teamId } : { teamId, payload: { playerNumber: nummer } }))
  })
  // Karten (Abschnitt 1): fuer die Ansichten mit Kartenzeichen (Verlauf im Cockpit, Zuschauer-Seite)
  for (const k of plan.karten ?? []) {
    log.push(e(k.art, 1, k.clockMs, { teamId: k.teamId, payload: { playerNumber: k.nummer } }))
  }
  // Abschnittsgrenzen der Regelspielzeit
  for (let sec = 1; sec < rules.sections; sec++) {
    log.push(e('SECTION_END', sec, sec * secMs))
    if (plan.bis === 'halbzeitpause' && sec === 1) { return sortiere(log) }
    log.push(e('SECTION_START', sec + 1, sec * secMs, { at: atOf(sec * secMs, sec) + pauseMs }))
  }
  if (plan.bis === 'laeuft') { return sortiere(log) }
  log.push(e('MATCH_END', rules.sections, gesamt))
  if (plan.verlaengerung === undefined) { return sortiere(log) }
  // K.o.-Remis (overtime-then-shootout): Verlaengerung als weiterer Abschnitt (Muster Fixtures 25b/25c).
  const otSec = rules.sections + 1
  log.push(e('SECTION_START', otSec, gesamt, { at: atOf(gesamt, rules.sections) + pauseMs }))
  if (plan.verlaengerung.tor !== undefined) {
    log.push(e('GOAL', otSec, gesamt + 100_000, { teamId: plan.verlaengerung.tor }))
  }
  if (plan.verlaengerung.laeuft === true) { return sortiere(log) }
  const otEnde = gesamt + rules.overtimeSeconds * 1000
  log.push(e('MATCH_END', otSec, otEnde))
  if (plan.elfmeter === undefined) { return sortiere(log) }
  let at = atOf(otEnde, otSec)
  const { a, b } = plan.elfmeter
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) { at += 10_000; log.push(e('SHOOTOUT_KICK', otSec, null, { at, teamId: ctx.teamAId, payload: { scored: a[i], shooterNumber: i + 1 } })) }
    if (i < b.length) { at += 10_000; log.push(e('SHOOTOUT_KICK', otSec, null, { at, teamId: ctx.teamBId, payload: { scored: b[i], shooterNumber: i + 11 } })) }
  }
  if (plan.elfmeter.beendet) { log.push(e('SHOOTOUT_END', otSec, null, { at: at + 10_000 })) }
  return sortiere(log)
}

/** Nach Zeit ordnen; die Ereignis-IDs bleiben (Reihenfolge der Vergabe), nur die Lage im Log folgt der Zeit. */
const sortiere = (log: EngineEvent[]): EngineEvent[] => [...log].sort((x, y) => x.at - y.at)

/** Lokale Engine-Kopie des Gastkontos (Form `MatchCopy`, Format 2), Ereignisse lokal bestaetigt (V14). */
interface EngineKopie {
  formatVersion: number
  accountId: string
  matchId: string
  tournamentId: string
  ctx: MatchContext
  confirmed: (Omit<EngineEvent, 'at'> & { at: number | string; seq: number })[]
  watermarkSeq: number
  acked: never[]
  pending: never[]
  rejected: never[]
  review: never[]
  updatedAt: number | string
}

interface MatchMitKopie { match: Match; kopie: EngineKopie }

/** Setzt die Spalten eines Spiels aus dem Ergebnis der echten Engine. Wirft, wenn ein Ereignis abgelehnt wird. */
function wendeEngineAn(t: Tournament, match: Match, teamA: string, teamB: string, plan: EreignisPlan, start: number): MatchMitKopie {
  const ctx: MatchContext = { matchId: match.id, teamAId: teamA, teamBId: teamB }
  const rules = regelnFuer(t, match.phase ?? 'groupStage')
  const ereignisse = baueEreignisse(ctx, rules, plan, start)
  const { state, results } = reduceMatch(ereignisse, ctx)
  const abgelehnt = results.filter((r) => r.status !== 'accepted')
  if (abgelehnt.length > 0) {
    throw new Error(`Engine lehnt Ereignisse ab (${match.id}): ${JSON.stringify(abgelehnt)}`)
  }
  const c = cacheColumns(state, ctx)
  const status = c.match_status === 'paused' ? 'running' : c.match_status
  const ohneNull = <T,>(v: T | null): T | undefined => v ?? undefined
  // Laufende Spiele (inkl. Pause, Verlaengerung, Schießen): Zeiten relativ zum Laden, der Lader loest die Marken auf.
  const live = status === 'running'
  const relativ = live || plan.ebenBeendet === true
  const letztes = ereignisse[ereignisse.length - 1].at
  const jetzt = plan.jetztNachAnpfiffMs === undefined ? letztes + (plan.ebenBeendet === true ? 2_000 : 20_000) : start + plan.jetztNachAnpfiffMs
  const zeit = (at: number): number | string => (relativ ? `@jetzt-ms${at - jetzt >= 0 ? '+' : '-'}${String(Math.abs(at - jetzt))}` : at)
  const neu = {
    ...match,
    scoreA: ohneNull(c.score_a), scoreB: ohneNull(c.score_b),
    overtimeScoreA: ohneNull(c.overtime_score_a), overtimeScoreB: ohneNull(c.overtime_score_b),
    penaltyScoreA: ohneNull(c.penalty_score_a), penaltyScoreB: ohneNull(c.penalty_score_b),
    matchStatus: status,
    decidedBy: ohneNull(c.decided_by),
    finishedAt: c.finished_at === null ? undefined
      : plan.ebenBeendet === true ? `@jetzt-${String(Math.round((jetzt - c.finished_at) / 1000))}s` : new Date(c.finished_at).toISOString(),
    timerElapsedSeconds: c.timer_elapsed_seconds,
    ...(live ? { timerStartTime: `@jetzt-${String(Math.round((jetzt - start) / 1000))}s`, timerElapsedSeconds: 0 } : {}),
    // Aufgabe 1.2 (R-SA8): der Feinstatus aus `live_state` (Halbzeitpause, Verlängerung, Strafstoßschießen) für Monitor und Zuschauer
    ...(live && c.live_state !== null
      ? { liveState: { ...c.live_state, anchorAt: c.live_state.anchorAt === null ? null : zeit(c.live_state.anchorAt), breakStartedAt: c.live_state.breakStartedAt === null ? null : zeit(c.live_state.breakStartedAt) } }
      : {}),
  } as Match
  const kopie: EngineKopie = {
    formatVersion: MATCH_COPY_FORMAT_VERSION, accountId: 'guest', matchId: match.id.toLowerCase(), tournamentId: t.id, ctx,
    confirmed: ereignisse.map((ev, i) => ({ ...ev, at: zeit(ev.at), seq: i + 1 })),
    watermarkSeq: ereignisse.length, acked: [], pending: [], rejected: [], review: [],
    updatedAt: zeit(letztes),
  }
  return { match: neu, kopie }
}

// ---------- Monitore und Sponsor ----------

const ZEIT = '2026-11-14T07:00:00.000Z'
const monitor = (id: string, name: string, slides: Omit<MonitorSlide, 'order' | 'duration'>[]): TournamentMonitor => ({
  id, name, defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark', performanceMode: 'auto',
  slides: slides.map((s, order) => ({ ...s, order, duration: null })), createdAt: ZEIT, updatedAt: ZEIT,
})

const SPONSOR: Sponsor = {
  id: 'sponsor-messlauf', name: 'Autohaus Süd-Westfalen Nordheim GmbH', tier: 'gold',
  websiteUrl: 'https://example.invalid/sponsor', createdAt: ZEIT, updatedAt: ZEIT,
}

/** Ein Monitor je Folientyp (jede Folie einzeln messbar) plus ein Monitor mit allen Folien. */
const FOLIEN: { monitorId: string; name: string; slide: Omit<MonitorSlide, 'order' | 'duration'> }[] = [
  { monitorId: 'mon-live', name: 'Live', slide: { id: 's-live', type: 'live', config: { fieldId: 'field-1' } } },
  { monitorId: 'mon-tabelle', name: 'Tabelle', slide: { id: 's-tab', type: 'standings', config: { groupId: 'A' } } },
  { monitorId: 'mon-alle-tabellen', name: 'Alle Tabellen', slide: { id: 's-alle', type: 'all-standings', config: {} } },
  { monitorId: 'mon-plan-gruppe', name: 'Spielplan Gruppe', slide: { id: 's-pg', type: 'schedule-group', config: { groupId: 'A' } } },
  { monitorId: 'mon-plan-feld', name: 'Spielplan Feld', slide: { id: 's-pf', type: 'schedule-field', config: { fieldId: 'field-1' } } },
  { monitorId: 'mon-naechste', name: 'Nächste Spiele', slide: { id: 's-nx', type: 'next-matches', config: { matchCount: 5 } } },
  { monitorId: 'mon-torschuetzen', name: 'Torschützen', slide: { id: 's-ts', type: 'top-scorers', config: { numberOfPlayers: 10 } } },
  { monitorId: 'mon-sponsor', name: 'Sponsor', slide: { id: 's-sp', type: 'sponsor', config: { sponsorId: SPONSOR.id, showQrCode: true, qrTarget: 'tournament' } } },
  { monitorId: 'mon-text', name: 'Text', slide: { id: 's-tx', type: 'custom-text', config: { headline: 'Herzlich willkommen in der Halle Nordheim', body: 'Bitte die Tribüne nur in Hallenschuhen betreten. Der Imbiss im Foyer hat bis 16 Uhr geöffnet.', textAlign: 'center', colorScheme: 'default' } } },
  { monitorId: 'mon-qr', name: 'Zuschauer-QR', slide: { id: 's-qr', type: 'qr-code', config: {} } },
]
const MONITORE: TournamentMonitor[] = [
  ...FOLIEN.map((f) => monitor(f.monitorId, `Folie ${f.name}`, [f.slide])),
  monitor('mon-alle', 'Alle Folien', FOLIEN.map((f) => f.slide)),
]

// ---------- Erzeugung ----------

/** Gruppenergebnisse (Tore Heim:Gast) je Paarung nach Reihenfolge des Spielplans – feste Tabelle. */
const GRUPPEN_ERGEBNISSE: [number, number][] = [
  [3, 1], [2, 2], [0, 1], [4, 0], [1, 1], [2, 0],
  [2, 1], [0, 0], [3, 2], [1, 0], [2, 2], [0, 3],
]

const service = new TournamentCreationService(keinSpeicher)
const FELDER = [{ id: 'field-1', defaultName: 'Feld 1' }, { id: 'field-2', defaultName: 'Feld 2' }] as Tournament['fields']

interface Erzeugt { turnier: Tournament; kopien: EngineKopie[] }

const seiteId = (m: Match, seite: 'slotA' | 'slotB'): string => {
  const sl = m[seite]
  if (sl.kind !== 'team') { throw new Error(`Seite ${seite} von ${m.id} ist nicht besetzt`) }
  return sl.teamId
}

/** Gemeinsames Gerüst: ersetzt Spiele und sammelt die Engine-Kopien. */
/**
 * A-13c: „Gruppe abschließen“ für jede Gruppe über den echten lokalen Weg (`applyCompleteGroup`): Abschluss (`groupCompletions`) und
 * besetzte Finalrunde. Ohne den Abschluss zeigte die Ansicht einen Vorschlag für Gruppen, deren Halbfinals längst laufen
 * (Review #336 A3) – diesen Zustand gibt es nach A-13c nicht mehr.
 */
function schliesseGruppenAb(t: Tournament): void {
  for (const gruppe of ['A', 'B']) {
    const { tournament } = applyCompleteGroup(t, {
      groupId: gruppe, ranking: activeRanking(t, gruppe), openRanks: [], tieDecisions: [], knownDecisionIds: [], expectedState: expectedState(t, gruppe),
    })
    if (tournament === undefined) { throw new Error(`Gruppe ${gruppe} nicht abgeschlossen`) }
    t.matches = tournament.matches
    t.groupCompletions = tournament.groupCompletions
  }
}

function werkbank(t: Tournament): { kopien: EngineKopie[]; ersetze: (alt: Match, e: MatchMitKopie) => void } {
  const kopien: EngineKopie[] = []
  return {
    kopien,
    ersetze: (alt, e) => {
      t.matches = t.matches.map((m) => (m.id === alt.id ? e.match : m))
      kopien.push(e.kopie)
    },
  }
}

const halbfinaleVon = (t: Tournament): [Match, Match] => {
  const hf = t.matches.filter((m) => /Halbfinale/.test(m.label ?? '')).sort((x, y) => (x.label ?? '').localeCompare(y.label ?? ''))
  if (hf.length !== 2) { throw new Error(`Erwartet 2 Halbfinals, erzeugt ${String(hf.length)}`) }
  return [hf[0], hf[1]]
}

/** Hauptturnier: 2 Gruppen à 4, Halbfinale mit Verlaengerung bzw. Strafstoßschießen, Finale laeuft, Platz 3 offen. */
async function erzeugeHauptturnier(): Promise<Erzeugt> {
  const t = await service.publish({
    id: TURNIER_ID, title: 'Hallencup Messlauf', ageClass: 'U11', date: '2026-11-14', startDate: '2026-11-14',
    startTime: '09:00', timeSlot: '09:00 - 16:00', location: { name: 'Sporthalle Nordheim' },
    organizer: 'Turn- und Sportverein Ost',
    numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 2, groupSystem: 'groupsAndFinals',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, finalRoundGameDuration: 10, finalRoundBreakDuration: 2,
    breakBetweenPhases: 5, resultMode: 'goals', gamePeriods: 1, halftimeBreak: 1,
    teams: TEAMS,
    groups: [{ id: 'A', customName: 'Gruppe A' }, { id: 'B', customName: 'Gruppe B' }],
    fields: FELDER,
    finalsConfig: { preset: 'top-4', tiebreaker: 'overtime-then-shootout', tiebreakerDuration: 5 },
    finals: { final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false },
    isPublic: true, shareCode: SHARE_CODE, shareCodeCreatedAt: SAAT_ZEIT,
    monitors: MONITORE, sponsors: [SPONSOR],
    lastVisitedStep: 6,
  })
  const start = Date.parse(SAAT_ZEIT)
  const { kopien, ersetze } = werkbank(t)
  const gruppe = t.matches.filter((m) => !m.isFinal)
  if (gruppe.length !== GRUPPEN_ERGEBNISSE.length) { throw new Error(`Erwartet ${String(GRUPPEN_ERGEBNISSE.length)} Gruppenspiele, erzeugt ${String(gruppe.length)}`) }
  gruppe.forEach((m, i) => {
    const [a, b] = GRUPPEN_ERGEBNISSE[i]
    const tore = [...Array.from({ length: a }, () => seiteId(m, 'slotA')), ...Array.from({ length: b }, () => seiteId(m, 'slotB'))]
    ersetze(m, wendeEngineAn(t, m, seiteId(m, 'slotA'), seiteId(m, 'slotB'), { tore, bis: 'ende' }, start + i * 900_000))
  })
  schliesseGruppenAb(t)

  const [hf1, hf2] = halbfinaleVon(t)
  // Halbfinale 1: 1:1, die Verlaengerung entscheidet (Tor Heim).
  ersetze(hf1, wendeEngineAn(t, hf1, seiteId(hf1, 'slotA'), seiteId(hf1, 'slotB'),
    { tore: [seiteId(hf1, 'slotA'), seiteId(hf1, 'slotB')], bis: 'ende', verlaengerung: { tor: seiteId(hf1, 'slotA') } }, start + 20_000_000))
  // Halbfinale 2: 0:0, Strafstoßschießen 4:3 fuer Heim.
  ersetze(hf2, wendeEngineAn(t, hf2, seiteId(hf2, 'slotA'), seiteId(hf2, 'slotB'),
    { tore: [], bis: 'ende', verlaengerung: {}, elfmeter: { a: [true, true, false, true, true], b: [true, false, true, true, false], beendet: true } }, start + 21_000_000))
  resolveBracketAfterPlayoffMatch(t)

  // Finale: laeuft seit 5:20 (2:1). Platz 3 bleibt ungespielt.
  const finale = t.matches.find((m) => m.finalType === 'final')
  if (!finale) { throw new Error('Finale fehlt') }
  ersetze(finale, wendeEngineAn(t, finale, seiteId(finale, 'slotA'), seiteId(finale, 'slotB'),
    {
      tore: [seiteId(finale, 'slotA'), seiteId(finale, 'slotB'), seiteId(finale, 'slotA')], bis: 'laeuft', jetztNachAnpfiffMs: 320_000,
      // Die Tore liegen vor "jetzt" (5:20) und tragen echte Spielminuten; Nummer 9, 11 und beim dritten Tor bewusst keine (Warnzeichen als Beispiel)
      toreBisMs: 320_000, nummern: [9, 11, undefined],
      // Gelb, Gelb-Rot und Rot im laufenden Finale (Karten-Farben nur fuer Karten, Oberflaeche E)
      karten: [
        { art: 'YELLOW_CARD', teamId: seiteId(finale, 'slotA'), clockMs: 90_000, nummer: 7 },
        { art: 'YELLOW_RED_CARD', teamId: seiteId(finale, 'slotB'), clockMs: 150_000, nummer: 5 },
        { art: 'RED_CARD', teamId: seiteId(finale, 'slotA'), clockMs: 230_000, nummer: 3 },
      ],
    }, start + 22_000_000))
  return { turnier: t, kopien }
}

export type PhasenArt = 'halbzeitpause' | 'verlaengerung' | 'strafstoss' | 'vorwarnung' | 'fortsetzen'
export const PHASEN: Record<PhasenArt, { id: string; titel: string; code: string; name: string }> = {
  halbzeitpause: { id: 'hallencup-phase-halbzeit', titel: 'Hallencup Phase Halbzeit', code: 'PHASEH', name: 'Halbzeitpause' },
  verlaengerung: { id: 'hallencup-phase-verlaengerung', titel: 'Hallencup Phase Verlängerung', code: 'PHASEV', name: 'Verlängerung läuft' },
  strafstoss: { id: 'hallencup-phase-strafstoss', titel: 'Hallencup Phase Strafstoß', code: 'PHASES', name: 'Strafstoßschießen läuft' },
  vorwarnung: { id: 'hallencup-phase-vorwarnung', titel: 'Hallencup Phase Vorwarnung', code: 'PHASEW', name: 'Spiel kurz vor dem Ende (Restzeit 2:40, nächstes Spiel steht an)' },
  // LT-6 (@SL-074, @SL-152): Halbfinale 1 eben (2 s vor dem Laden) mit Ablauf bei 2:1 beendet -- Endstand mit „Weiter“ und „Spiel fortsetzen“
  fortsetzen: { id: 'hallencup-phase-fortsetzen', titel: 'Hallencup Phase Fortsetzen', code: 'PHASEF', name: 'Eben von selbst abgepfiffen (Endstand 2:1, Spiel fortsetzen)' },
}

/**
 * Phasen-Turnier: 4 Teams in 2 Gruppen à 2, zwei Abschnitte, Halbfinale. Die Gruppenspiele sind beendet; genau EIN Halbfinale
 * steht in der gewuenschten Cockpit-Phase (Halbzeitpause, Verlaengerung laeuft oder Strafstoßschießen laeuft). Je Phase ein
 * eigenes Turnier: das Cockpit beendet beim Oeffnen eines anderen Spiels ein bereits laufendes automatisch (ManagementTab,
 * initialMatchId), mehrere laufende Spiele in einem Turnier wuerden sich gegenseitig beenden.
 */
async function erzeugePhasenturnier(art: PhasenArt, nr: number): Promise<Erzeugt> {
  const kopf = PHASEN[art]
  const namen = ['TSV Westtal', 'FC Nordstadt', 'BSC Ostring', 'SV Südpark']
  const teams: Team[] = namen.map((name, i) => ({ id: uuid(5, nr * 10 + i + 1), name, group: i < 2 ? 'A' : 'B' }))
  const t = await service.publish({
    id: kopf.id, title: kopf.titel, ageClass: 'U11', date: '2026-11-14', startDate: '2026-11-14',
    startTime: '09:00', timeSlot: '09:00 - 16:00', location: { name: 'Sporthalle Nordheim' },
    numberOfTeams: 4, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, finalRoundGameDuration: 10, finalRoundBreakDuration: 2,
    breakBetweenPhases: 5, resultMode: 'goals', gamePeriods: 2, halftimeBreak: 1,
    teams, groups: [{ id: 'A', customName: 'Gruppe A' }, { id: 'B', customName: 'Gruppe B' }],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }] as Tournament['fields'],
    finalsConfig: { preset: 'top-4', tiebreaker: 'overtime-then-shootout', tiebreakerDuration: 5 },
    finals: { final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false },
    isPublic: true, shareCode: kopf.code, shareCodeCreatedAt: SAAT_ZEIT, lastVisitedStep: 6,
    // Aufgabe 1.2: die Live-Folie zeigt das Abzeichen der Phase (Halbzeit, Strafstoßschießen) am Monitor
    monitors: [monitor('mon-live', 'Folie Live', [FOLIEN[0].slide])],
    // Das Cockpit beendet ein Spiel selbstaendig, sobald die kumulierte Spielzeit die Regelspielzeit erreicht – in der
    // Verlaengerung also sofort (Befund im Report). Fuer eine stabile Ansicht "Verlaengerung laeuft" ist das hier aus.
    matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, autoFinishEnabled: art !== 'verlaengerung' },
  })
  const start = Date.parse(SAAT_ZEIT)
  const { kopien, ersetze } = werkbank(t)
  const gruppe = t.matches.filter((m) => !m.isFinal)
  if (gruppe.length !== 2) { throw new Error(`Phasen-Turnier: ${String(gruppe.length)} Gruppenspiele statt 2`) }
  // LT-6: die Gruppenspiele liegen hier vor dem Laden (30 Tage vor der Saat-Zeit) -- sonst hielte das Cockpit ihren Endstand
  // (Abpfiff nach „jetzt“) statt den des eben beendeten Halbfinales, und „Spiel fortsetzen“ stuende nicht da.
  const gruppenStart = art === 'fortsetzen' ? start - 30 * 86_400_000 : start
  gruppe.forEach((m, i) => {
    ersetze(m, wendeEngineAn(t, m, seiteId(m, 'slotA'), seiteId(m, 'slotB'), { tore: [seiteId(m, 'slotA')], bis: 'ende' }, gruppenStart + i * 900_000))
  })
  schliesseGruppenAb(t)
  const [hf1] = halbfinaleVon(t)
  const [a, b] = [seiteId(hf1, 'slotA'), seiteId(hf1, 'slotB')]
  const plan: EreignisPlan =
    art === 'halbzeitpause' ? { tore: [a], nummern: [8], bis: 'halbzeitpause' }
    // Vorwarnung (@SL-155): zweiter und letzter Abschnitt, Restzeit 2:40 (unter 3:00); die Uhr steht 7:20 nach dem Anpfiff
    // (10:00 Spielzeit, 1 Minute Halbzeitpause), das 2. Halbfinale ist das "Nächste" auf Feld 1.
    : art === 'vorwarnung' ? { tore: [a, b], nummern: [8, 4], bis: 'laeuft', toreBisMs: 440_000, jetztNachAnpfiffMs: 440_000 + 60_000 }
    : art === 'verlaengerung' ? { tore: [a, b], nummern: [8, 4], bis: 'ende', verlaengerung: { laeuft: true } }
    : art === 'fortsetzen' ? { tore: [a, b, a], nummern: [8, 4, 9], bis: 'ende', ebenBeendet: true }
    : { tore: [], bis: 'ende', verlaengerung: {}, elfmeter: { a: [true, false], b: [false, true], beendet: false } }
  ersetze(hf1, wendeEngineAn(t, hf1, a, b, plan, start + 20_000_000))
  // 2. Halbfinale, Platz 3 und Finale bleiben ungespielt.
  return { turnier: t, kopien }
}

/** Entwurf mit allen 8 Teams (lange Namen) fuer die Schritte des Assistenten: eigene Instanz je Schritt (Teams, Gruppen). */
async function erzeugeEntwurf(): Promise<Erzeugt> {
  const t = await service.saveDraft({
    id: ENTWURF_ID, title: 'Hallencup Entwurf', ageClass: 'U11', date: '2026-11-21', startDate: '2026-11-21',
    startTime: '09:00', timeSlot: '09:00 - 16:00', location: { name: 'Sporthalle Nordheim' },
    organizer: 'Turn- und Sportverein Ost',
    numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 2, groupSystem: 'groupsAndFinals',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, finalRoundGameDuration: 10, finalRoundBreakDuration: 2,
    breakBetweenPhases: 5, resultMode: 'goals', gamePeriods: 1, halftimeBreak: 1,
    teams: TEAMS.map((x, i) => ({ ...x, id: uuid(4, i + 1) })),
    groups: [{ id: 'A', customName: 'Gruppe A' }, { id: 'B', customName: 'Gruppe B' }], fields: FELDER,
    finalsConfig: { preset: 'top-4', tiebreaker: 'overtime-then-shootout', tiebreakerDuration: 5 },
    finals: { final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false },
    // Ohne gemerkten Schritt gilt `?step=N` der Adresse (TournamentCreationScreen: lastVisitedStep sperrt sie).
    lastVisitedStep: undefined,
  })
  return { turnier: t, kopien: [] }
}

/** Ersetzt alle Spiel-IDs durch feste (die Generatoren vergeben Zufalls-IDs) – in der ganzen Struktur. */
function normalisiereIds<T>(wert: T, spielIds: string[], art: number): T {
  const abbildung = new Map(spielIds.map((alt, i) => [alt, uuid(art, i + 1)]))
  const text = JSON.stringify(wert).replace(/"([^"\\]+)"/g, (voll, inhalt: string) => {
    const neu = abbildung.get(inhalt) ?? abbildung.get(inhalt.toLowerCase())
    return neu === undefined ? voll : `"${neu}"`
  })
  return JSON.parse(text) as T
}

/**
 * A-13c (Review #336 R1): Abschluss-Lage für die Messung der neuen Elemente. Aus dem Hauptturnier abgeleitet: alle Gruppenspiele
 * entschieden, die Finalrunde noch ohne Spiele und ohne Besetzung; Gruppe A abgeschlossen und nach einer Korrektur veraltet
 * (`stale`, „Besetzung prüfen“, Halbfinal-Seiten aus A besetzt), Gruppe B fertig, aber nicht abgeschlossen (Vorschlag „Gruppe abschließen“).
 */
function abschlussTurnier(basis: Tournament): Tournament {
  const matches: Match[] = basis.matches.map((m, i) => {
    const id = uuid(9, i + 1)
    if (m.isFinal !== true) { return { ...m, id } }
    const { scoreA: _a, scoreB: _b, decidedBy: _d, finishedAt: _f, timerStartTime: _s, timerElapsedSeconds: _e, penaltyScoreA: _pa, penaltyScoreB: _pb, overtimeScoreA: _oa, overtimeScoreB: _ob, events: _ev, ...rest } = m
    return {
      ...rest, id, matchStatus: 'scheduled',
      slotA: m.originA === undefined ? m.slotA : pendingSlot(m.originA),
      slotB: m.originB === undefined ? m.slotB : pendingSlot(m.originB),
    }
  })
  const t: Tournament = { ...basis, id: ABSCHLUSS_ID, title: 'Hallencup Abschluss', shareCode: 'ABSC26', monitors: [], matches, groupCompletions: [] }
  const ranking = activeRanking(t, 'A')
  const placed = applyCompleteGroup(t, { groupId: 'A', ranking, openRanks: [], tieDecisions: [], knownDecisionIds: [], expectedState: expectedState(t, 'A') })
  if (placed.tournament === undefined) { throw new Error('Abschluss-Saat: Gruppe A nicht abgeschlossen') }
  return { ...placed.tournament, groupCompletions: (placed.tournament.groupCompletions ?? []).map((c) => ({ ...c, stale: true })) }
}

export async function erzeugeSaat(): Promise<SaatDatei> {
  ereignisZaehler = 0
  const haupt = await erzeugeHauptturnier()
  const arten = Object.keys(PHASEN) as PhasenArt[]
  const phasen = await Promise.all(arten.map((art, i) => erzeugePhasenturnier(art, i + 1)))
  const entwurf = await erzeugeEntwurf()
  const h = normalisiereIds(haupt, haupt.turnier.matches.map((m) => m.id), 3)
  const p = phasen.map((x, i) => normalisiereIds(x, x.turnier.matches.map((m) => m.id), 6 + i))
  const turniere = [h.turnier, ...p.map((x) => x.turnier), entwurf.turnier, abschlussTurnier(h.turnier)]
  const rolle = (f: (m: Match) => boolean): string | undefined => h.turnier.matches.find(f)?.id
  const kopien = [...h.kopien, ...p.flatMap((x) => x.kopien)]
  return {
    formatVersion: SAAT_FORMAT,
    name: SAAT_NAME,
    beschreibung: 'Hallencup Messlauf: Hauptturnier (2 Gruppen à 4 Teams, Halbfinale 1 mit Verlängerung, Halbfinale 2 mit Strafstoßschießen, Finale läuft), je ein Phasen-Turnier (Halbzeitpause, Verlängerung läuft, Strafstoßschießen läuft), Entwurf für den Assistenten; Monitor je Folientyp, Sponsor.',
    datenbanken: [
      { name: 'hallenfussball', version: 1, store: 'cache', eintraege: { tournaments: turniere } },
      { name: 'hallenfussball-matches', version: MATCH_COPY_FORMAT_VERSION, store: 'matches', eintraege: Object.fromEntries(kopien.map((k) => [matchCopyKey(k.accountId, k.matchId), k])) },
    ],
    localStorage: { 'app:consent': { errorTracking: false, sessionReplay: false, timestamp: Date.parse(SAAT_ZEIT), version: 1 } },
    kennzahlen: {
      turnierId: TURNIER_ID,
      entwurfId: ENTWURF_ID,
      shareCode: SHARE_CODE,
      teams: h.turnier.teams.map((x) => x.name),
      spiele: h.turnier.matches.length,
      engineKopien: kopien.length,
      laufendesSpiel: rolle((m) => m.matchStatus === 'running'),
      mitVerlaengerung: rolle((m) => m.decidedBy === 'overtime'),
      mitStrafstossschiessen: rolle((m) => m.decidedBy === 'penalty'),
      ungespieltesSpiel: rolle((m) => m.finalType === 'thirdPlace'),
      phasenTurniere: Object.fromEntries(arten.map((art, i) => [art, { turnierId: PHASEN[art].id, spielId: p[i].turnier.matches.find((m) => m.matchStatus === 'running' || (art === 'fortsetzen' && m.isFinal && m.matchStatus === 'finished'))?.id }])),
      monitore: h.turnier.monitors?.map((m) => m.id),
    },
  }
}
