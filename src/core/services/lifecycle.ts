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
import type { Tournament } from '../../types/tournament';

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
 * Gespeicherter Zustand. Ohne Server-Zeile (lokal angelegt, Gast) gilt wie beim Backfill der Server-Migration:
 * festgelegt (`published`) = fixed, sonst Entwurf – nie etwas aus Spielständen.
 */
export function storedLifecycleOf(t: Pick<Tournament, 'status' | 'lifecycleStatus'>): StoredLifecycle {
  return t.lifecycleStatus ?? (t.status === 'published' ? 'fixed' : 'draft');
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
