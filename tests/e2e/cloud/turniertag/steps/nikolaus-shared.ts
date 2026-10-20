/**
 * Gemeinsame Bausteine der Durchstich-Schritte der Hauptlinie „Nikolaus-Turnier TEST“ (N1 bis N7): Zugriff auf das Turnier
 * (Seed `scripts/lib/nikolausSeed.ts`, Daten `nikolausCup.ts`), Spiele in Spielplan-Reihenfolge und Ergebnisse über die
 * Turnierleitungs-RPC. Das Turnier hat EINE Gruppe auf EINEM Feld, 9 Minuten in einem Abschnitt: die Ereignisse tragen deshalb
 * keine Halbzeit (anders als `regularResultEvents` des Turniertag-Cups).
 */
import path from 'node:path';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { AUTH_DIR, type LoggedInRole } from '../../fixtures';
import { appendAsRole, fetchEngineRows, type AppendAsRoleEvent } from '../../engineHelpers';
import {
  E2E_NIKOLAUS_CUPS,
  E2E_NIKOLAUS_GAME_MINUTES,
  E2E_NIKOLAUS_MATCH_COUNT,
  type NikolausCup,
} from '../../testData';
import { getRows } from './shared';
import { eventOf, finishingEvents } from './playViaRpc';

export const NIKOLAUS = E2E_NIKOLAUS_CUPS.haupt;
export const SPIELZEIT_MS = E2E_NIKOLAUS_GAME_MINUTES * 60_000;

export interface NikolausMatch {
  id: string;
  slot: number;
  /** Spielnummer („Spiel 1“ bis „Spiel 15“), seit #300 gespeichert (@SL-049, @TM-142). */
  match_number: number | null;
  field: number;
  phase: string;
  group_letter: string | null;
  team_a_id: string;
  team_b_id: string;
  match_status: string | null;
  score_a: number | null;
  score_b: number | null;
  scheduled_start: string | null;
  actual_start: string | null;
}

const SPIEL_SPALTEN = 'id,slot,match_number,field,phase,group_letter,team_a_id,team_b_id,match_status,score_a,score_b,scheduled_start,actual_start';

/** Alle Spiele des Turniers in Spielplan-Reihenfolge: Index 0 ist Spiel 1. */
export function fetchNikolausSpiele(cup: NikolausCup = NIKOLAUS): Promise<NikolausMatch[]> {
  return getRows<NikolausMatch>(`matches?tournament_id=eq.${cup.tournamentId}&order=slot.asc&select=${SPIEL_SPALTEN}`, 'fetchNikolausSpiele');
}

export async function fetchNikolausTeamNamen(cup: NikolausCup = NIKOLAUS): Promise<Map<string, string>> {
  const teams = await getRows<{ id: string; name: string }>(`teams?tournament_id=eq.${cup.tournamentId}&select=id,name`, 'fetchNikolausTeamNamen');
  return new Map(teams.map((team) => [team.id, team.name]));
}

/** "<Heim> gegen <Gast>" eines Spiels, wie der Spielplan es beschriftet. */
export function paarung(spiel: NikolausMatch, namen: ReadonlyMap<string, string>): string {
  return `${namen.get(spiel.team_a_id) ?? '?'} gegen ${namen.get(spiel.team_b_id) ?? '?'}`;
}

/**
 * Spielplan-Reihenfolge der Spiele eines Turniers, mit Vorbedingung 15 Spiele auf einem Feld. Die Spielnummer ist gespeichert (C-SPIELNUMMER-FEHLT,
 * behoben mit #300): Spiel 1 bis Spiel 15 in Spielplan-Reihenfolge, lückenlos und eindeutig. Fehlt sie (Seed vor #300), ist das ein Fehler im Aufbau.
 */
export async function ladeSpielplan(cup: NikolausCup = NIKOLAUS): Promise<{ spiele: NikolausMatch[]; namen: Map<string, string> }> {
  const [spiele, namen] = await Promise.all([fetchNikolausSpiele(cup), fetchNikolausTeamNamen(cup)]);
  expect(spiele, 'das Nikolaus-Turnier hat 15 Spiele (Seed gelaufen?)').toHaveLength(E2E_NIKOLAUS_MATCH_COUNT);
  expect(
    spiele.map((s) => s.match_number),
    'die Spielnummern 1 bis 15 stehen in Spielplan-Reihenfolge in der Datenbank (@SL-049; Seed nach #300 gelaufen?)'
  ).toEqual(spiele.map((_, index) => index + 1));
  return { spiele, namen };
}

/** Spielnummer eines Spiels aus der Datenbank (wirft, wenn sie fehlt). */
export function spielnummer(spiel: NikolausMatch): number {
  if (spiel.match_number === null) {
    throw new Error(`Spiel ${spiel.id} hat keine Spielnummer (C-SPIELNUMMER-FEHLT)`);
  }
  return spiel.match_number;
}

export async function openNikolausPath(page: Page, pathSuffix: string, cup: NikolausCup = NIKOLAUS): Promise<void> {
  await page.goto(`/#/tournament/${cup.tournamentId}${pathSuffix}`);
  await page.waitForLoadState('networkidle');
}

/** Anmeldung und Einwilligung wie `newRoleContext`, dazu die Handy-Ansicht (390 x 844, Touch) für „am Handy“. */
export async function handyKontext(browser: Browser, role: LoggedInRole): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState: path.join(AUTH_DIR, `${role}.json`),
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem('app:consent', JSON.stringify({ errorTracking: true, sessionReplay: false, timestamp: Date.now(), version: 1 }));
  });
  return { context, page: await context.newPage() };
}

/** Spiel komplett über die Turnierleitungs-RPC: Anpfiff vor 9 Minuten, Tore ohne Halbzeit, Abpfiff. Nur für noch nicht angepfiffene Spiele. */
export function ergebnisEreignisse(spiel: NikolausMatch, toreA: number, toreB: number): AppendAsRoleEvent[] {
  const start = Date.now() - SPIELZEIT_MS - 5000;
  const events: AppendAsRoleEvent[] = [eventOf('MATCH_START', start, start)];
  let at = start;
  for (let i = 0; i < toreA; i++) {
    at += 1000;
    events.push(eventOf('GOAL', at, start, { teamId: spiel.team_a_id }));
  }
  for (let i = 0; i < toreB; i++) {
    at += 1000;
    events.push(eventOf('GOAL', at, start, { teamId: spiel.team_b_id }));
  }
  events.push(eventOf('MATCH_END', start + SPIELZEIT_MS, start));
  return events;
}

/** Trägt ein Ergebnis ein und prüft, dass die Datenbank jedes Ereignis annimmt (Vorbedingung, kein erwartetes Rot). */
export async function spieleErgebnis(spiel: NikolausMatch, toreA: number, toreB: number): Promise<void> {
  const rows = await fetchEngineRows(spiel.id);
  expect(rows, `Spiel ${spielnummer(spiel)} ist noch nicht angepfiffen`).toHaveLength(0);
  const events = ergebnisEreignisse(spiel, toreA, toreB);
  const result = await appendAsRole('owner', spiel.id, events);
  expect(result.results.map((r) => r.status), `Ergebnis ${toreA}:${toreB} für Spiel ${spielnummer(spiel)}`).toEqual(events.map(() => 'accepted'));
}

/**
 * Die Ergebnisse aller 15 Spiele für Tabelle und Endstand (Heim:Gast in Spielplan-Reihenfolge). Spiel 1 ist das 1:0 aus N4. Gewählt für die Szenarien:
 *  - Kammer und Waging rot punktgleich (je 10), Kammer gewann das direkte Spiel 2:1 (Spiel 10: Waging rot 1:2 Kammer), Waging rot hat die bessere
 *    Tordifferenz (+7 gegen +2): Kammer steht vor Waging rot (@ET-056);
 *  - Petting und Otting nach allen Kriterien gleich (8 Punkte, Tordifferenz 0, 9 Tore), das direkte Spiel 11 endete 1:1: Strafstoßschießen nötig (@ET-055, @ET-025);
 *  - Fridolfing 4 Punkte, Waging blau 1 Punkt.
 * Erwartete Reihenfolge: Kammer, Waging rot, Petting/Otting (gleichauf), Fridolfing, Waging blau.
 */
export const NIKOLAUS_ERGEBNISSE: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [2, 0], [1, 1], [2, 2], [0, 3], [2, 1], [0, 4], [1, 0], [3, 3], [1, 2], [1, 1], [1, 3], [1, 4], [1, 0], [3, 4],
];

/** Beendet alle Spiele, die noch nicht beendet sind, mit den Ergebnissen aus `NIKOLAUS_ERGEBNISSE` (Vorbedingung der Schritte N6 und N7; wiederholbar). */
export async function beendeAlleSpiele(): Promise<void> {
  const { spiele } = await ladeSpielplan();
  for (const [index, spiel] of spiele.entries()) {
    const [toreA, toreB] = NIKOLAUS_ERGEBNISSE[index];
    const rows = await fetchEngineRows(spiel.id);
    if (rows.some((row) => row.type === 'MATCH_END')) {
      continue;
    }
    const events = rows.length === 0 ? ergebnisEreignisse(spiel, toreA, toreB) : finishingEvents(rows, ergebnisEreignisse(spiel, toreA, toreB));
    const result = await appendAsRole('owner', spiel.id, events);
    expect(result.results.map((r) => r.status), `Spiel ${spielnummer(spiel)} beenden`).toEqual(events.map(() => 'accepted'));
  }
  const nachher = await fetchNikolausSpiele();
  expect(nachher.map((s) => `${s.score_a}:${s.score_b}`), 'alle 15 Ergebnisse stehen wie vorgesehen').toEqual(NIKOLAUS_ERGEBNISSE.map(([a, b]) => `${a}:${b}`));
}
