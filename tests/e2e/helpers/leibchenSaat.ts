/**
 * Saat der Leibchen-Anzeige (@ZM-161, @ZM-195, @ZM-159, @ZM-140): die Nikolaus-Vorlage des Mockups `leibchen-anzeige` (Team 1 bis Team 6) in
 * den Zuständen des Mockups, gebaut im Speicher aus der Saat `hallencup-messlauf` (Monitore, Aufbau) – kein Produktivcode.
 *
 * - Spiel 1 · 08:30 Team 1 (OHNE Trikotfarbe) gegen Team 4 Blau, Leibchen Orange für Team 1 (Zustand 5, nur mit Leibchen)
 * - Spiel 2 · 08:40 Team 2 Rot gegen Team 3 Rot, Leibchen Gelb für Team 3 (Zustände 1b bis 4)
 * - Spiel 5 · 09:10 Team 5 Weiß gegen Team 6 Grün, kein Leibchen (Kontrollfall 6)
 */
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

export const LEIBCHEN_TURNIER_ID = 'leibchen-anzeige';
export const LEIBCHEN_SHARE_CODE = 'LEIB26';
export const LEIBCHEN_MONITOR_ID = 'mon-live';
/**
 * Turniertag in der Vergangenheit: ein überfälliges geplantes Spiel bleibt „nächstes Spiel“ und damit in der Vorlaufzeit (@ZM-141, @ZM-138) – die
 * Folie „Nächstes Spiel“ erscheint also ohne feste Uhr, zu jeder Zeit.
 */
export const TURNIERTAG = '2026-10-31';

export const ROT = '#C62828';
export const BLAU = '#1565C0';
export const GRUEN = '#2E7D32';
export const WEISS = '#FFFFFF';
export const GELB = '#FFCC00';
export const SPIEL_2_ID = '0000000b-0000-4000-8000-000000000002';
export const ORANGE = '#EF6C00';

export type Szene =
  | 'vor-gleiche-farbe'   // Zustand 1/1b: Spiel 2, noch kein Leibchen, beide Rot → Gast weicht aus (Blau)
  | 'laeuft'              // Zustand 3: Spiel 2 läuft 1 : 0, Leibchen Gelb, Zeitstrafe #5 Team 3
  | 'ende'                // Zustand 4: Spiel 2 läuft, der Test pfeift es ab (1 : 0)
  | 'beendet'             // Spiel 2 ist abgepfiffen (1 : 0), Spiel 5 folgt
  | 'laeuft-orange'       // Zustand 5: Spiel 1 läuft 2 : 1, Leibchen Orange für Team 1 (ohne Trikotfarbe)
  | 'laeuft-zweistellig'  // Spiel 2, Team 3 mit Leibchen und Stand 10
  | 'kontrolle-vor'       // Zustand 6: Spiel 5 vor dem Anpfiff
  | 'kontrolle-laeuft';   // Zustand 6: Spiel 5 läuft 2 : 1

type Zeile = Record<string, unknown>;

const TEAMS: Array<{ nr: number; farbe?: string }> = [
  { nr: 1 }, { nr: 2, farbe: ROT }, { nr: 3, farbe: ROT }, { nr: 4, farbe: BLAU }, { nr: 5, farbe: WEISS }, { nr: 6, farbe: GRUEN },
];
const teamId = (nr: number): string => `0000000a-0000-4000-8000-00000000000${nr}`;

function uhr(): Zeile {
  return {
    engine: true, status: 'running', phase: 'regular', section: 1, running: true, elapsedMs: 0, anchorAt: '@jetzt-ms-320000',
    elapsedSeconds: 0, durationSeconds: 600, playPhase: 'regular', tiebreakerMode: 'overtime-then-shootout', overtimeDurationSeconds: 300,
    awaitingTiebreakerChoice: false, sections: 1, sectionSeconds: 600, breakSeconds: 60, overtimeSeconds: 300, sectionStartMs: 0, breakStartedAt: null,
  };
}

function spiel(nr: number, a: number, b: number, zeit: string, extra: Zeile): Zeile {
  return {
    id: `0000000b-0000-4000-8000-00000000000${nr}`, round: nr, field: 1, slot: nr, group: 'A', isFinal: false, phase: 'groupStage',
    slotA: { kind: 'team', teamId: teamId(a) }, slotB: { kind: 'team', teamId: teamId(b) },
    scheduledTime: `${TURNIERTAG}T${zeit}:00+01:00`, matchNumber: nr, matchStatus: 'scheduled', ...extra,
  };
}

/** Teamfarben des Mockups: Team 1 ohne Farbe; die übrigen als `colors.primary`. */
function teams(): Zeile[] {
  return TEAMS.map(({ nr, farbe }) => ({ id: teamId(nr), name: `Team ${String(nr)}`, group: 'A', ...(farbe === undefined ? {} : { colors: { primary: farbe } }) }));
}

function kit(a: string | undefined, b: string | undefined, bibSide?: 'a' | 'b'): Zeile {
  return { kit: { ...(a === undefined ? {} : { a }), ...(b === undefined ? {} : { b }), ...(bibSide === undefined ? {} : { bibSide }) } };
}

function spiele(szene: Szene): Zeile[] {
  const laeuft = { matchStatus: 'running', timerElapsedSeconds: 0, timerStartTime: '@jetzt-320s', liveState: uhr() };
  const strafe = {
    events: [{
      id: 'z5', type: 'TIME_PENALTY', timestampSeconds: 280, clockMs: 280_000,
      payload: { teamId: teamId(3), playerNumber: 5, durationSeconds: 120 }, scoreAfter: { home: 1, away: 0 },
    }],
  };
  switch (szene) {
    // dazu Spiel 5 später: nur das nächste Spiel des Felds trägt Kästen (Spielliste der Zuschauer-Seite)
    case 'vor-gleiche-farbe': return [spiel(2, 2, 3, '08:40', {}), spiel(5, 5, 6, '09:10', {})];
    case 'laeuft': return [spiel(2, 2, 3, '08:40', { ...laeuft, ...kit(ROT, GELB, 'b'), scoreA: 1, scoreB: 0, ...strafe })];
    case 'laeuft-zweistellig': return [spiel(2, 2, 3, '08:40', { ...laeuft, ...kit(ROT, GELB, 'b'), scoreA: 1, scoreB: 10 })];
    case 'ende': return [spiel(2, 2, 3, '08:40', { ...laeuft, ...kit(ROT, GELB, 'b'), scoreA: 1, scoreB: 0, ...strafe })]; // der Abpfiff folgt zur Laufzeit (`beendeSpiel2`)
    case 'beendet':
      return [
        spiel(2, 2, 3, '08:40', { ...kit(ROT, GELB, 'b'), matchStatus: 'finished', scoreA: 1, scoreB: 0, decidedBy: 'regular', finishedAt: `${TURNIERTAG}T08:50:00+01:00`, timerElapsedSeconds: 600 }),
        spiel(5, 5, 6, '09:10', {}),
      ];
    case 'laeuft-orange': return [spiel(1, 1, 4, '08:30', { ...laeuft, ...kit(ORANGE, BLAU, 'a'), scoreA: 2, scoreB: 1 })];
    case 'kontrolle-vor': return [spiel(5, 5, 6, '09:10', {})];
    case 'kontrolle-laeuft': return [spiel(5, 5, 6, '09:10', { ...laeuft, scoreA: 2, scoreB: 1 })];
  }
}

/** Die Saat in der Form des Laders; `nachher`-Zustände des Mockups. */
export function leibchenSaat(szene: Szene): unknown {
  const saat = leseSaat('hallencup-messlauf') as { datenbanken: Array<{ eintraege: { tournaments: Zeile[] } }> };
  const alle = saat.datenbanken[0]?.eintraege.tournaments ?? [];
  const basis = alle.find((t) => t.id === 'hallencup-messlauf');
  if (basis === undefined) { throw new Error('Saat hallencup-messlauf ohne Turnier'); }
  const turnier: Zeile = {
    ...structuredClone(basis),
    id: LEIBCHEN_TURNIER_ID, title: 'F2-Junioren Hallenturnier', shareCode: LEIBCHEN_SHARE_CODE, date: TURNIERTAG, startDate: TURNIERTAG,
    numberOfFields: 1, numberOfTeams: 6, numberOfGroups: 1, groupSystem: 'roundRobin', groups: [{ id: 'A', customName: 'Gruppe A' }],
    fields: [{ id: 'field-1', defaultName: 'Feld 1' }], finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    finalsConfig: { preset: 'none', tiebreaker: 'overtime-then-shootout', tiebreakerDuration: 5 }, placementsToPlayOut: undefined,
    groupCompletions: undefined, sponsors: [], teams: teams(), matches: spiele(szene),
  };
  saat.datenbanken[0].eintraege.tournaments = [turnier];
  return saat;
}
