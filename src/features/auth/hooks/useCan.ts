/**
 * useCan — die EINE Frage der App nach einem Recht (A-11, brief-A-11.md R-A11-3).
 *
 * `useCan(recht, turnierId)` = `hasPermission(rolle, recht)` auf der Rolle aus `useMyTournamentRole`; die Rechte kommen
 * immer aus rolePermissions.json (über hasPermission), nie aus einem gespeicherten Rechte-Satz.
 *
 * Gedächtnis je Turnier (`safeLocalStorage`, Schlüssel `tournament-role:<id>`): die zuletzt bekannte ROLLE. Es gilt nur,
 * solange die Rolle nicht bekannt ist (lädt noch, oder die Eigentümer-Prüfung scheiterte, z. B. ohne Netz). Ein online
 * bestätigtes Nicht-Mitglied bekommt nie etwas aus dem Gedächtnis -- der Server hat entschieden.
 * Der alte Schlüssel `engine-actor-role:<id>` (useActorRole bis A-11) wird nur noch gelesen: „leitung“ zählt wie ein
 * Co-Admin, „helper“ wie ein Helfer.
 *
 * L7/F2 (Rolle unbekannt, Gedächtnis leer): Spielbetrieb (`writeMatchData`) offen, alle Verwaltungsrechte zu. Der
 * Server entscheidet beim Übertragen.
 */
import { useEffect } from 'react';
import { safeLocalStorage } from '../../../core/utils/safeStorage';
import { hasPermission, type Permission } from '../utils/permissions';
import { TOURNAMENT_ROLES, type TournamentRole } from '../types/auth.types';
import { useMyTournamentRole } from './useMyTournamentRole';

const MEMORY_PREFIX = 'tournament-role:';
const LEGACY_ACTOR_PREFIX = 'engine-actor-role:';
// A-27: alle Rollen inkl. helper/screen -- ein gemerkter Bildschirm fällt nicht auf L7 (Spielbetrieb offen) zurück.
const KNOWN_ROLES: readonly TournamentRole[] = TOURNAMENT_ROLES;

/** L7: ohne bekannte Rolle und ohne Gedächtnis bleibt nur der Spielbetrieb offen. */
const UNKNOWN_ROLE_RIGHTS: ReadonlySet<Permission> = new Set<Permission>(['writeMatchData']);

function rememberedRole(tournamentId: string): TournamentRole | null {
  const stored = safeLocalStorage.getItem(`${MEMORY_PREFIX}${tournamentId}`);
  const known = KNOWN_ROLES.find((role) => role === stored);
  if (known) {
    return known;
  }
  const legacy = safeLocalStorage.getItem(`${LEGACY_ACTOR_PREFIX}${tournamentId}`);
  if (legacy === 'leitung') {
    return 'co-admin';
  }
  return legacy === 'helper' ? 'collaborator' : null;
}

export function useCan(permission: Permission, tournamentId: string): boolean {
  const { role, isLoading, isUnknown } = useMyTournamentRole(tournamentId);

  useEffect(() => {
    if (role !== null) {
      safeLocalStorage.setItem(`${MEMORY_PREFIX}${tournamentId}`, role);
    }
  }, [tournamentId, role]);

  if (role !== null) {
    return hasPermission(role, permission);
  }
  if (!isLoading && !isUnknown) {
    // Online bestätigt: kein Mitglied, kein Eigentümer.
    return false;
  }
  const remembered = rememberedRole(tournamentId);
  if (remembered !== null) {
    return hasPermission(remembered, permission);
  }
  return UNKNOWN_ROLE_RIGHTS.has(permission);
}

/**
 * CA-5 (@HE-088, Plan-Review Auflage 10c/11, Review CA-3–5 Auflage 4): Recht für ein Turnier der Startseiten-Liste.
 *
 * - Die Rolle darf NUR aus `Tournament.myRole` des Listenobjekts kommen (vom Server mit der Liste geliefert bzw. im
 *   Rollen-Gedächtnis des Kontos gemerkt, `core/repositories/accountListMerge.ts`) – nie von woanders. Eine Abfrage für alle
 *   Karten statt einer je Karte über `useCan`.
 * - `undefined` = eigenes Turnier (Gast, lokal angelegt): alle Rechte – bewusst anders als L7, wie vor CA-5.
 * - Unbekannte Rolle (nicht in `KNOWN_ROLES`, z. B. ein Wert aus einem kaputten Gedächtnis): wie `useCan` L7, nur der
 *   Spielbetrieb (`writeMatchData`), nie `true` für Verwaltungsrechte.
 * - Aufrufer stehen fest im Wächter `rightsOnlyViaUseCan.test.ts` (`LISTED_ROLE_CALLERS`, nur kürzen, nie erweitern).
 */
export function canWithListedRole(role: TournamentRole | undefined, permission: Permission): boolean {
  if (role === undefined) {
    return true;
  }
  const known = KNOWN_ROLES.find((candidate) => candidate === role);
  return known === undefined ? UNKNOWN_ROLE_RIGHTS.has(permission) : hasPermission(known, permission);
}
