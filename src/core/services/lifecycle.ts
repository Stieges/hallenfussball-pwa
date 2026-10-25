/**
 * Turnier-Zustand (R3-1, @LZ-001, @LZ-002, @LZ-006): rein, ohne React.
 *
 * Der Zustand steht am Server (`tournaments.lifecycle_status`: draft | fixed | finished | cancelled). „Läuft“ wird
 * nicht gespeichert, sondern gelesen: festgelegt UND ein Spiel läuft, pausiert oder ist beendet – genau die Regel von
 * `public.tournament_lifecycle(uuid)` (Migration 20261113_003). Dies ist ihr TS-Zwilling; der Gleichlauf ist durch
 * `lifecycle-of.json` belegt (SQL-Seite: scripts/tournament-lifecycle-check.sh, Kategorie G).
 *
 * NIE aus Spielständen ableiten, ob ein Turnier „abgeschlossen“ ist (@LZ-006): sind alle Spiele entschieden, bleibt es
 * „Läuft“, bis die Turnierleitung abschließt. Die Alt-Haken `manuallyCompleted`, `completedAt`, `dashboardStatus`
 * und `statsSnapshot` zählen nicht mehr (Plan R3 E2, F9).
 */
import type { Match, Tournament } from '../../types/tournament';
import { matchSideTeamId } from '../models/matchSlot';

/** Was der Server speichert. */
export type StoredLifecycle = 'draft' | 'fixed' | 'finished' | 'cancelled';
/** Was die App anzeigt: gespeichert plus „Läuft“. */
export type TournamentLifecycle = StoredLifecycle | 'running';

/** Aktionen zum Turnierende, die die App in einem Zustand anbietet (MVP: nur Abschließen; Abbrechen/Wieder öffnen MVP+). */
export type TournamentEndAction = 'finish';

type LifecycleInput = Pick<Tournament, 'status' | 'lifecycleStatus' | 'matches' | 'anyMatchStarted'>;

const STORED: readonly StoredLifecycle[] = ['draft', 'fixed', 'finished', 'cancelled'];

/** Zustandswerte des Servers; alles andere (Altbestand, Fremdwert) ist unbekannt. */
export function parseStoredLifecycle(value: unknown): StoredLifecycle | undefined {
  return STORED.find((known) => known === value);
}

/**
 * Ist ein Spiel angepfiffen? Wie die Server-Regel: laufend, pausiert oder beendet. Listen ohne Spiele (Startseite aus der
 * Cloud) tragen das Ergebnis der Zusatzabfrage in `anyMatchStarted`.
 */
export function hasStartedMatch(t: Pick<Tournament, 'matches' | 'anyMatchStarted'>): boolean {
  if (t.anyMatchStarted === true) {
    return true;
  }
  return (t.matches ?? []).some(
    (match) => match.matchStatus === 'running' || match.matchStatus === 'paused' || match.matchStatus === 'finished',
  );
}

/**
 * Gespeicherter Zustand, Zwilling des Server-Triggers `tournaments_lifecycle_follow_status`: `finished` und `cancelled`
 * setzt nur der Server (Abschluss, Abbruch) und gelten, wenn die Kopie sie trägt. Sonst folgt der Zustand `status`
 * (festgelegt = `published` = fixed, sonst Entwurf) – ein veraltetes `draft` in der Kopie hält ein inzwischen festgelegtes
 * Turnier nicht zurück. Nie etwas aus Spielständen.
 */
export function storedLifecycleOf(t: Pick<Tournament, 'status' | 'lifecycleStatus'>): StoredLifecycle {
  if (t.lifecycleStatus === 'finished' || t.lifecycleStatus === 'cancelled') {
    return t.lifecycleStatus;
  }
  return t.status === 'published' ? 'fixed' : 'draft';
}

/** Der Zustand, den Startseite, Turnier-Kopf und Zuschauer-Seite zeigen (@LZ-001). */
export function lifecycleOf(t: LifecycleInput): TournamentLifecycle {
  const stored = storedLifecycleOf(t);
  return stored === 'fixed' && hasStartedMatch(t) ? 'running' : stored;
}

/** Abgeschlossen oder abgebrochen = nichts mehr zu bearbeiten (Server-Sperre `tournament_is_closed`). */
export function isTournamentClosed(t: Pick<Tournament, 'status' | 'lifecycleStatus'>): boolean {
  const stored = storedLifecycleOf(t);
  return stored === 'finished' || stored === 'cancelled';
}

/** @LZ-002 (MVP-Teil): welche Aktion zum Turnierende die App anbietet; ohne Recht `manageLifecycle` keine (@LZ-022). */
export function actionsOffered(lifecycle: TournamentLifecycle, can: { manageLifecycle: boolean }): TournamentEndAction[] {
  return lifecycle === 'running' && can.manageLifecycle ? ['finish'] : [];
}

/**
 * Stand eines Spiels für den Stand-Vergleich beim Turnierabschluss (A-21a-C1, R-EA-14, @LZ-029, Plan R3 E4). Schlüssel wie
 * `match_engine.tournament_state` (Migration 20261113_003): Teams, Tore, Verlängerung, Strafstoßschießen, Status (fehlend =
 * `scheduled`), wer bei einer Wertung fehlte. Fehlende Werte fehlen (dort `jsonb_strip_nulls`).
 */
export interface TournamentMatchState {
  id: string;
  ta?: string;
  tb?: string;
  a?: number;
  b?: number;
  oa?: number;
  ob?: number;
  pa?: number;
  pb?: number;
  s: string;
  f?: string;
}

const present = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  value === undefined ? {} : ({ [key]: value } as Record<K, V>);

function matchState(m: Match): TournamentMatchState {
  return {
    id: m.id,
    ...present('ta', matchSideTeamId(m, 'A')),
    ...present('tb', matchSideTeamId(m, 'B')),
    ...present('a', m.scoreA),
    ...present('b', m.scoreB),
    ...present('oa', m.overtimeScoreA),
    ...present('ob', m.overtimeScoreB),
    ...present('pa', m.penaltyScoreA),
    ...present('pb', m.penaltyScoreB),
    s: m.matchStatus ?? 'scheduled',
    ...present('f', m.forfeitAbsent),
  };
}

/**
 * TS-Zwilling von `match_engine.tournament_state` (Gleichlauf `core/standings/__fixtures__/tournament-state.json`): Stand
 * ALLER Spiele, nach Spiel-ID (Text) sortiert. Der Abschluss gilt nur für den Stand, auf dem das Gerät den Endstand
 * gerechnet hat – gesendet wird der bestätigte Serverstand, die App rechnet nur, wenn ihr Stand ihm gleicht (E4).
 */
export function expectedTournamentState(t: Pick<Tournament, 'matches'>): TournamentMatchState[] {
  return t.matches.map(matchState).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/** Kanonische Form eines Stands (Reihenfolge der Spiele und Schlüssel egal) – für den Vergleich lokal ↔ Server. */
function canonicalState(state: readonly TournamentMatchState[]): string {
  const KEYS: ReadonlyArray<keyof TournamentMatchState> = ['id', 'ta', 'tb', 'a', 'b', 'oa', 'ob', 'pa', 'pb', 's', 'f'];
  return JSON.stringify(
    [...state]
      .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
      .map((row) => KEYS.filter((key) => row[key] !== undefined && row[key] !== null).map((key) => [key, row[key]])),
  );
}

/** Gleicht der lokale Stand dem bestätigten Serverstand (`finish_preflight.state`)? */
export function sameTournamentState(a: readonly TournamentMatchState[], b: readonly TournamentMatchState[]): boolean {
  return canonicalState(a) === canonicalState(b);
}
