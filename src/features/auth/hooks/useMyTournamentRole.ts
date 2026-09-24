/**
 * useMyTournamentRole — Die EINE Stelle, die die effektive Turnier-Rolle des angemeldeten
 * Nutzers bestimmt, inklusive des Eigentümers.
 *
 * H-1 (final-review-2.md, R7-Fixrunde 1): `useTournamentMembers().myMembership` kennt NUR
 * echte Zeilen in `tournament_collaborators`. `createOwnerMembership()`
 * (`membershipService.ts`) hat im ganzen `src` keinen Aufrufer — der Eigentümer bekommt live
 * NIE eine solche Zeile, `tournament_collaborators` ist live leer. Jede Stelle, die bisher
 * `myMembership ? can…(myMembership.role) : false` schrieb (DangerZoneCategory,
 * TeamHelpersCategory, MemberList), sah den echten Eigentümer deshalb IMMER als "kein Recht" —
 * der Löschen-Bereich, die Einladungs-Verwaltung usw. verschwanden für genau die Person, die sie
 * am meisten braucht.
 *
 * Diese Funktion ist die zentrale, geteilte Korrektur (Review-Ruling: "keine drei getrennten
 * Lösungen"):
 *
 * 1. **Lokal-/Gastmodus** (`!isAuthenticated`, also `user === null` oder `globalRole === 'guest'`,
 *    siehe `AuthContext.tsx`): kein Cloud-Backend, kein anderer Akteur kann je schreiben — der
 *    lokale Nutzer gilt als Eigentümer. Kein RPC nötig oder möglich.
 * 2. **Cloud-Modus mit echter Mitgliedszeile**: die Rolle aus der Zeile — inklusive `'owner'`,
 *    sobald `createOwnerMembership()` künftig aufgerufen wird (dann greift dieser Zweig zuerst,
 *    der RPC-Fallback unten wird nie gebraucht).
 * 3. **Cloud-Modus ohne Mitgliedszeile**: per RPC `has_tournament_permission(tournamentId,
 *    'deleteTournament')` geprüft. `deleteTournament` ist in `rolePermissions.json` an KEINE
 *    Rolle vergeben — `has_tournament_permission()` liefert dafür nur über
 *    `user_owns_tournament()` `true` (SQL: `user_owns_tournament OR EXISTS(... role_permissions
 *    ...)`, und die EXISTS-Seite kann für `deleteTournament` nie zutreffen, weil keine Zeile in
 *    `role_permissions` dieses Recht trägt). Ein `true` hier ist deshalb gleichbedeutend mit
 *    "ist der Eigentümer" — kein falsch-positives Ergebnis für Co-Admin & Co möglich. `false`
 *    bedeutet: kein Mitglied, kein Eigentümer (`role: null`).
 *
 * Gemeinsam genutzt von DangerZoneCategory, TeamHelpersCategory und MemberList.
 */

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useTournamentMembers } from './useTournamentMembers';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { TournamentRole } from '../types/auth.types';

export interface UseMyTournamentRoleReturn {
  /** Effektive Rolle inkl. 'owner' -- null nur für einen echten Nicht-Mitglied im Cloud-Modus. */
  role: TournamentRole | null;
  isLoading: boolean;
}

/**
 * Reiner Auswertungs-Kern (kein eigener `useTournamentMembers()`-Aufruf) — für Stellen, die
 * bereits eine eigene `useTournamentMembers()`-Instanz halten (z.B. MemberList, das auch die
 * Mitgliederliste braucht) und keinen zweiten, redundanten Fetch auslösen wollen.
 */
export function useEffectiveTournamentRole(
  tournamentId: string,
  myMembership: { role: TournamentRole } | null,
  membersLoading: boolean
): UseMyTournamentRoleReturn {
  const { isAuthenticated } = useAuth();
  const [ownerCheck, setOwnerCheck] = useState<{ tournamentId: string; isOwner: boolean } | null>(null);
  const [isCheckingOwnership, setIsCheckingOwnership] = useState(false);

  const needsOwnerCheck =
    isAuthenticated && !membersLoading && !myMembership && isSupabaseConfigured && Boolean(supabase);

  useEffect(() => {
    if (!needsOwnerCheck || !supabase) {
      return;
    }
    const client = supabase;
    let cancelled = false;

    const checkOwnership = async () => {
      setIsCheckingOwnership(true);
      try {
        const { data, error } = await client.rpc('has_tournament_permission', {
          p_tournament_id: tournamentId,
          p_permission: 'deleteTournament',
        });
        if (cancelled) {
          return;
        }
        if (error) {
          if (import.meta.env.DEV) {
            console.error('useMyTournamentRole: Eigentümer-Prüfung fehlgeschlagen', error);
          }
          setOwnerCheck({ tournamentId, isOwner: false });
          return;
        }
        setOwnerCheck({ tournamentId, isOwner: data ?? false });
      } finally {
        if (!cancelled) {
          setIsCheckingOwnership(false);
        }
      }
    };

    void checkOwnership();
    return () => {
      cancelled = true;
    };
  }, [needsOwnerCheck, tournamentId]);

  if (!isAuthenticated) {
    // Lokal-/Gastmodus: kein anderer Akteur kann schreiben, der lokale Nutzer ist Eigentümer.
    return { role: 'owner', isLoading: false };
  }
  if (membersLoading) {
    return { role: null, isLoading: true };
  }
  if (myMembership) {
    return { role: myMembership.role, isLoading: false };
  }
  if (ownerCheck?.tournamentId === tournamentId) {
    return { role: ownerCheck.isOwner ? 'owner' : null, isLoading: false };
  }
  return { role: null, isLoading: isCheckingOwnership };
}

/**
 * Bequemlichkeits-Variante für Stellen, die sonst KEINE eigene `useTournamentMembers()`-Instanz
 * brauchen (DangerZoneCategory, TeamHelpersCategory) — holt die Mitgliedschaft selbst.
 */
export function useMyTournamentRole(tournamentId: string): UseMyTournamentRoleReturn {
  const { myMembership, isLoading } = useTournamentMembers(tournamentId);
  return useEffectiveTournamentRole(tournamentId, myMembership, isLoading);
}
