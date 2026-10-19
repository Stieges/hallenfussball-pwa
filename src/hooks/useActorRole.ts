/**
 * useActorRole (C3a-2a, V6/K1; seit A-11 über useCan): Akteursklasse für `MatchCommands` -- `leitung`, wenn
 * `useCan('leadMatches', turnier)` gilt, sonst `helper`. Das Gedächtnis der zuletzt bekannten Rolle liegt seit A-11 in
 * useCan (`tournament-role:<id>`; der alte Schlüssel `engine-actor-role:<id>` wird dort nur noch gelesen). Ganz ohne
 * bekannte Rolle gilt `helper` (keine Rechte "erzwingen" -- der Server überschreibt ohnehin, K1).
 */
import { useCan } from '../features/auth/hooks/useCan';
import type { Actor } from '../core/match';

export function useActorRole(tournamentId: string): Actor {
  return useCan('leadMatches', tournamentId) ? 'leitung' : 'helper';
}
