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
import type { TournamentRole } from '../types/auth.types';
import { useMyTournamentRole } from './useMyTournamentRole';

const MEMORY_PREFIX = 'tournament-role:';
const LEGACY_ACTOR_PREFIX = 'engine-actor-role:';
const KNOWN_ROLES: readonly TournamentRole[] = ['owner', 'co-admin', 'trainer', 'collaborator', 'viewer'];

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
