/**
 * tests/e2e/cloud/nikolausCup.ts
 *
 * Testdaten-Vorlage „Nikolaus-Turnier TEST“ (Hauptlinie des Durchstichs, `meilenstein-setup-nikolaus.md`):
 * das echte Turnier der Turnierleitung als Daten für den lokalen Testlauf und die CI. Sa 28.11.2026, Start 16:30,
 * Bergader Arena, Veranstalter TSV Waging, D-Jugend, eine Gruppe „Jeder gegen jeden“, 1 Feld, 9 Minuten Spielzeit
 * plus 1 Minute Wechsel, sechs Mannschaften, 15 Spiele (16:30 bis 19:00). Beide Waging-Mannschaften sind als
 * Mannschaften des Veranstalters markiert; die Eröffnung steht auf der Voreinstellung „Veranstalter gegen einen
 * Gast, Vereinsduell in Runde 2“ (`guest-opening`, @W4-033).
 *
 * Nur lokaler Stack (`scripts/require-local-stack.sh`); nie gegen Produktion. `scripts/e2e-seed.ts` legt das
 * Turnier an (`scripts/lib/nikolausSeed.ts`), die Durchstich-Schritte N1 bis N7 (`turniertag/steps/nikolaus.ts`)
 * spielen es durch. Die Einzelwerte stehen hier an EINER Stelle (testData.ts führt sie durch `export *` mit).
 */
import { e2eUuid } from './e2eUuid';

export const E2E_NIKOLAUS_CUP_ID = e2eUuid('tournament:nikolaus-cup');
export const E2E_NIKOLAUS_CUP_TITLE = 'Nikolaus-Turnier TEST';
/**
 * Zwilling für den Schritt „Zeitplan vor dem ersten Anpfiff vorziehen“ (N5): dieselben Daten, eigene Kennungen, eigener
 * Share-Code und Monitor, dazu der Helfer als Mitglied. Die Hauptlinie bleibt dadurch unberührt: der Schritt braucht ein
 * Turnier ohne angepfiffenes Spiel, die Schritte N3 und N4 pfeifen Spiel 1 des Hauptturniers an.
 */
export type NikolausVariante = 'haupt' | 'zeitplan';
export interface NikolausCup {
  variante: NikolausVariante;
  tournamentId: string;
  title: string;
  shareCode: string;
  monitorId: string;
  /** Der Helfer (Tom) ist Mitglied des Turniers. */
  mitHelfer: boolean;
  teamId: (name: (typeof E2E_NIKOLAUS_TEAM_NAMES)[number]) => string;
}
/** Sa 28.11.2026, Start 16:30. */
export const E2E_NIKOLAUS_DATE = '2026-11-28';
export const E2E_NIKOLAUS_START_TIME = '16:30';
export const E2E_NIKOLAUS_END_TIME = '19:00';
export const E2E_NIKOLAUS_LOCATION = 'Bergader Arena';
export const E2E_NIKOLAUS_ORGANIZER = 'TSV Waging';
export const E2E_NIKOLAUS_AGE_CLASS = 'D-Jugend';
/** 9 Minuten Spielzeit, 1 Minute Wechsel: ein Spiel alle 10 Minuten. */
export const E2E_NIKOLAUS_GAME_MINUTES = 9;
export const E2E_NIKOLAUS_CHANGE_MINUTES = 1;
/** 6 Teams, jeder gegen jeden: 15 Spiele. */
export const E2E_NIKOLAUS_MATCH_COUNT = 15;
/** Veröffentlicht (Zuschauer-Seite, Bildschirm) mit festem Code und einem Monitor. */
export const E2E_NIKOLAUS_SHARE_CODE = 'NIKOLS';
export const E2E_NIKOLAUS_MONITOR_ID = e2eUuid('monitor:nikolaus-cup:1');

/** Die beiden Mannschaften des Veranstalters. */
export const E2E_NIKOLAUS_HOST_TEAM_NAMES = ['TSV Waging rot', 'TSV Waging blau'] as const;
/** Reihenfolge = Teamliste (@W4-044): die beiden Waging-Mannschaften zuerst. */
export const E2E_NIKOLAUS_TEAM_NAMES = [
  'TSV Waging rot',
  'TSV Waging blau',
  'DJK Kammer',
  'TSV Petting',
  'DJK Otting',
  'TSV 1921 Fridolfing',
] as const;

export function nikolausTeamId(name: (typeof E2E_NIKOLAUS_TEAM_NAMES)[number]): string {
  return e2eUuid(`team:nikolaus-cup:${name}`);
}

export const E2E_NIKOLAUS_ZEITPLAN_CUP_ID = e2eUuid('tournament:nikolaus-cup:zeitplan');
export const E2E_NIKOLAUS_ZEITPLAN_SHARE_CODE = 'NIKZPL';
export const E2E_NIKOLAUS_ZEITPLAN_MONITOR_ID = e2eUuid('monitor:nikolaus-cup:zeitplan:1');

export const E2E_NIKOLAUS_CUPS: Record<NikolausVariante, NikolausCup> = {
  haupt: {
    variante: 'haupt',
    tournamentId: E2E_NIKOLAUS_CUP_ID,
    title: E2E_NIKOLAUS_CUP_TITLE,
    shareCode: E2E_NIKOLAUS_SHARE_CODE,
    monitorId: E2E_NIKOLAUS_MONITOR_ID,
    mitHelfer: false,
    teamId: nikolausTeamId,
  },
  zeitplan: {
    variante: 'zeitplan',
    tournamentId: E2E_NIKOLAUS_ZEITPLAN_CUP_ID,
    title: `${E2E_NIKOLAUS_CUP_TITLE} (Zeitplan)`,
    shareCode: E2E_NIKOLAUS_ZEITPLAN_SHARE_CODE,
    monitorId: E2E_NIKOLAUS_ZEITPLAN_MONITOR_ID,
    mitHelfer: true,
    teamId: (name) => e2eUuid(`team:nikolaus-cup:zeitplan:${name}`),
  },
};
