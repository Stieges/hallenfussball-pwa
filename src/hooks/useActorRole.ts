/**
 * useActorRole (C3a-2a, V6/K1): Akteursklasse fuer `MatchCommands` -- `leitung`, wenn
 * `hasPermission(rolle, 'leadMatches')` fuer das Turnier gilt, sonst `helper`. Die zuletzt
 * bekannte Rolle wird je Turnier in `safeLocalStorage` zwischengespeichert und offline (Rolle
 * noch unbekannt, z. B. keine Netzverbindung fuer die Mitgliedschafts-Abfrage) verwendet; ganz
 * ohne Cache gilt `helper` (keine Rechte "erzwingen" -- der Server ueberschreibt ohnehin, K1).
 */
import { useEffect } from 'react';
import { useMyTournamentRole } from '../features/auth/hooks/useMyTournamentRole';
import { hasPermission } from '../features/auth/utils/permissions';
import { safeLocalStorage } from '../core/utils/safeStorage';
import type { Actor } from '../core/match';

function cacheKey(tournamentId: string): string {
  return `engine-actor-role:${tournamentId}`;
}

function roleToActor(hasLeadMatches: boolean): Actor {
  return hasLeadMatches ? 'leitung' : 'helper';
}

export function useActorRole(tournamentId: string): Actor {
  const { role } = useMyTournamentRole(tournamentId);
  const known = role !== null;
  const actor = known ? roleToActor(hasPermission(role, 'leadMatches')) : null;

  useEffect(() => {
    if (actor !== null) {
      safeLocalStorage.setItem(cacheKey(tournamentId), actor);
    }
  }, [tournamentId, actor]);

  if (actor !== null) {
    return actor;
  }
  const cached = safeLocalStorage.getItem(cacheKey(tournamentId));
  return cached === 'leitung' ? 'leitung' : 'helper';
}
