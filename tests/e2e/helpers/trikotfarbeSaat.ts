/**
 * Saat „Trikotfarbe am Turniertag“ (@W3-028): ein Turnier, das schon läuft, im Speicher gebaut aus der Saat `hallencup-messlauf`
 * (Monitore, Aufbau) – kein Produktivcode. Feld 1: Spiel 1 beendet, Spiel 2 steht an (der Test pfeift es im Cockpit an), Spiel 3 folgt; Feld 2: Spiel 4 folgt.
 *
 * - FC Nord (Team A) trägt Rot: Spiel 1 (beendet) wurde mit Rot gespielt (`kit` am Spiel), Spiel 2 bekommt sie beim Anpfiff, Spiel 3 folgt (gegen FC West, Blau).
 * - SG Mitte (Team B) hat KEINE Trikotfarbe und spielt gerade nicht: Spiel 4 (Feld 2) gegen VfB Ufer (Gelb) steht an.
 */
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

export const TURNIER_ID = 'trikotfarbe-turniertag';
export const SHARE_CODE = 'TRIK26';
export const MONITOR_LIVE = 'mon-live';
export const MONITOR_LIVE_2 = 'mon-live-2';
export const TAG = '2026-10-31';

export const ROT = '#C62828';
export const BLAU = '#1565C0';
export const GRUEN = '#2E7D32';
export const WEISS = '#FFFFFF';
export const GELB = '#FFCC00';

const teamId = (nr: number): string => `0000000a-0000-4000-8000-00000000000${String(nr)}`;
export const spielId = (nr: number): string => `0000000b-0000-4000-8000-00000000000${String(nr)}`;
export const TEAM_NORD = teamId(1);
export const TEAM_OST = teamId(3);
export const TEAM_MITTE = teamId(5);
export const NAMEN: Record<number, string> = { 1: 'FC Nord', 2: 'SV Süd', 3: 'TSV Ost', 4: 'FC West', 5: 'SG Mitte', 6: 'VfB Ufer' };

type Zeile = Record<string, unknown>;

const FARBEN: Array<string | undefined> = [ROT, GRUEN, WEISS, BLAU, undefined, GELB];

function spiel(nr: number, a: number, b: number, feld: number, zeit: string, extra: Zeile): Zeile {
  return {
    id: spielId(nr), round: nr, field: feld, slot: nr, group: 'A', isFinal: false, phase: 'groupStage',
    slotA: { kind: 'team', teamId: teamId(a) }, slotB: { kind: 'team', teamId: teamId(b) },
    scheduledTime: `${TAG}T${zeit}:00+01:00`, matchNumber: nr, matchStatus: 'scheduled', ...extra,
  };
}

/** Monitor mit der Folie „Live“ für ein Feld. */
function liveFolie(id: string, fieldId: string): Zeile {
  return {
    id, name: `Live ${fieldId}`, defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark', performanceMode: 'auto',
    slides: [{ id: `s-${id}`, type: 'live', config: { fieldId }, order: 0, duration: null }], createdAt: `${TAG}T07:00:00.000Z`, updatedAt: `${TAG}T07:00:00.000Z`,
  };
}

/** Das Turnier (ein Eintrag der lokalen Turnierliste), gebaut im Speicher aus der Saat `hallencup-messlauf`. */
export function trikotfarbeTurnier(): Zeile {
  const saat = leseSaat('hallencup-messlauf') as { datenbanken: Array<{ eintraege: { tournaments: Zeile[] } }> };
  const basis = (saat.datenbanken[0]?.eintraege.tournaments ?? []).find((t) => t.id === 'hallencup-messlauf');
  if (basis === undefined) { throw new Error('Saat hallencup-messlauf ohne Turnier'); }
  return {
    ...structuredClone(basis),
    id: TURNIER_ID, title: 'Hallencup Nord', shareCode: SHARE_CODE, date: TAG, startDate: TAG,
    numberOfFields: 2, numberOfTeams: 6, numberOfGroups: 1, groupSystem: 'roundRobin', groups: [{ id: 'A', customName: 'Gruppe A' }],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }, { id: 'field-2', defaultName: 'Feld 2' }],
    finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    finalsConfig: { preset: 'none', tiebreaker: 'overtime-then-shootout', tiebreakerDuration: 5 }, placementsToPlayOut: undefined,
    groupCompletions: undefined, sponsors: [], monitors: [liveFolie(MONITOR_LIVE, 'field-1'), liveFolie(MONITOR_LIVE_2, 'field-2')],
    teams: FARBEN.map((farbe, i) => ({ id: teamId(i + 1), name: NAMEN[i + 1], group: 'A', ...(farbe === undefined ? {} : { colors: { primary: farbe } }) })),
    matches: [
      spiel(1, 1, 2, 1, '08:30', { matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', finishedAt: `${TAG}T08:40:00+01:00`, timerElapsedSeconds: 600, kit: { a: ROT, b: GRUEN } }),
      spiel(2, 1, 3, 1, '08:40', {}),
      spiel(3, 1, 4, 1, '08:50', {}),
      spiel(4, 5, 6, 2, '08:40', {}),
    ],
  };
}
