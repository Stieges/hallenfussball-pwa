/**
 * useMyTournamentRole — Die EINE Stelle, die die effektive Turnier-Rolle des angemeldeten
 * Nutzers bestimmt, inklusive des Eigentümers.
 *
 * H-1 (final-review-2.md, R7-Fixrunde 1): `useTournamentMembers().myMembership` kennt NUR
 * echte Zeilen in `tournament_collaborators`. `createOwnerMembership()`
 * (`membershipService.ts`) hat im ganzen `src` keinen Aufrufer — der Eigentümer bekommt live
 * NIE eine solche Zeile, `tournament_collaborators` ist live leer. Jede Stelle, die bisher
 * `myMembership ? can…(myMembership.role) : false` schrieb (DangerZoneCategory,
 * TeamHelpersCategory, damals auch MemberList), sah den echten Eigentümer deshalb IMMER als "kein Recht" —
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
 * Gemeinsam genutzt von DangerZoneCategory und TeamHelpersCategory (MemberList entfiel mit A-18a).
 */

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useTournamentMembers } from './useTournamentMembers';
import { useAwaitingFirstUpload } from './useAwaitingFirstUpload';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { TournamentRole } from '../types/auth.types';

export interface UseMyTournamentRoleReturn {
  /** Effektive Rolle inkl. 'owner' -- null nur für einen echten Nicht-Mitglied im Cloud-Modus. */
  role: TournamentRole | null;
  isLoading: boolean;
  /**
   * A-11 (useCan, L7): nur gesetzt (true), wenn die Rolle NICHT bestimmt werden konnte -- die Mitglieder-Abfrage oder
   * die Eigentümer-Prüfung scheiterte (z. B. kein Netz, @FU-100). `role: null` heißt dann „unbekannt“, nicht „kein Mitglied“.
   */
  isUnknown?: true;
}

/** Review A-11 A4 (@FU-100): wie oft eine unbekannte Rolle von selbst erneut geprüft wird (zusätzlich bei „online“/Sync). */
export const ROLE_RECHECK_MS = 30_000;

export interface EffectiveRoleOptions {
  /** Die Mitglieder-Abfrage ist gescheitert (`useTournamentMembers().loadFailed`): Rolle unbekannt, nicht „kein Mitglied“. */
  membersFailed?: boolean;
  /** Erneut abfragen (wird bei unbekannter Rolle bei „online“, nach dem Sync und alle 30 s gerufen). */
  refreshMembers?: () => unknown;
}

interface OwnerCheck {
  tournamentId: string;
  isOwner: boolean;
  failed?: true;
  /** @FU-098: die Antwort kam, während das Turnier noch auf die erste Übertragung wartete -- kein Beleg für „kein Mitglied“. */
  whileAwaiting: boolean;
}

/**
 * Reiner Auswertungs-Kern (kein eigener `useTournamentMembers()`-Aufruf) — für Stellen, die
 * bereits eine eigene `useTournamentMembers()`-Instanz halten (z.B. früher MemberList, das auch die
 * Mitgliederliste braucht) und keinen zweiten, redundanten Fetch auslösen wollen.
 *
 * Review A-11 A4 (@FU-098, @FU-099, @FU-100):
 * - Hat dieses Konto das Turnier auf diesem Gerät angelegt und ist es noch nicht in der Cloud (`useAwaitingFirstUpload`),
 *   gilt es als Eigentümer -- auch wenn die Cloud „kein Eigentümer“ antwortet (die Zeile fehlt dort noch) oder die
 *   Abfragen ohne Netz scheitern. Ist der Sync fertig, fragt der Hook den Server erneut (ohne Neuladen).
 * - Eine gescheiterte Mitglieder-Abfrage ist „unbekannt“ (useCan: gemerkte Rolle, sonst L7) und wird erneut geprüft.
 * - Nur „kein Mitglied“ + „kein Eigentümer“ + nichts wartet auf die erste Übertragung = bestätigt kein Recht.
 */
export function useEffectiveTournamentRole(
  tournamentId: string,
  myMembership: { role: TournamentRole } | null,
  membersLoading: boolean,
  options: EffectiveRoleOptions = {}
): UseMyTournamentRoleReturn {
  const { membersFailed = false, refreshMembers } = options;
  const { isAuthenticated } = useAuth();
  const [ownerCheck, setOwnerCheck] = useState<OwnerCheck | null>(null);
  const [isCheckingOwnership, setIsCheckingOwnership] = useState(false);
  const [recheck, setRecheck] = useState(0);

  const cloudMode = isAuthenticated && isSupabaseConfigured && Boolean(supabase);
  const confirmedOwner = ownerCheck?.tournamentId === tournamentId && ownerCheck.isOwner;
  const { awaiting, syncTick } = useAwaitingFirstUpload(
    tournamentId,
    cloudMode && !membersLoading && !myMembership && !confirmedOwner
  );
  const needsOwnerCheck = cloudMode && !membersLoading && !myMembership && !membersFailed;
  const current = ownerCheck?.tournamentId === tournamentId ? ownerCheck : null;
  const unknown = !myMembership && (membersFailed || Boolean(current?.failed));
  const staleNo = Boolean(current && !current.isOwner && !current.failed && current.whileAwaiting && awaiting === false);

  useEffect(() => {
    if (!needsOwnerCheck || !supabase) {
      return;
    }
    const client = supabase;
    let cancelled = false;
    // Review A-11 V1: auch „noch unbekannt“ (null) zählt -- ein „nein“, das nach dem Sync ankommt, wird erneut geprüft.
    const whileAwaiting = awaiting !== false;

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
          setOwnerCheck({ tournamentId, isOwner: false, failed: true, whileAwaiting });
          return;
        }
        setOwnerCheck({ tournamentId, isOwner: data ?? false, whileAwaiting });
      } catch {
        // A-11: ein geworfener Netzfehler zählt wie ein gemeldeter -- Rolle unbekannt (useCan: Gedächtnis/L7).
        if (!cancelled) {
          setOwnerCheck({ tournamentId, isOwner: false, failed: true, whileAwaiting });
        }
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
    // `awaiting` bewusst nicht in den Abhängigkeiten: die Prüfung läuft erneut über `recheck` (Sync fertig, online, Takt).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOwnerCheck, tournamentId, recheck]);

  // @FU-098: „kein Eigentümer“, während das Turnier auf die erste Übertragung wartet, ist kein Beleg -- merken ...
  useEffect(() => {
    if (awaiting === true && current && !current.isOwner && !current.failed && !current.whileAwaiting) {
      setOwnerCheck({ ...current, whileAwaiting: true });
    }
  }, [awaiting, current]);

  // ... und nach dem Sync den Server erneut fragen.
  useEffect(() => {
    if (staleNo) {
      setRecheck((n) => n + 1);
    }
  }, [staleNo]);

  // @FU-100: unbekannte Rolle erneut prüfen -- bei „online“, nach jeder Meldung der Warteschlange und alle 30 s.
  useEffect(() => {
    if (!unknown) {
      return;
    }
    const retry = () => {
      void refreshMembers?.();
      setRecheck((n) => n + 1);
    };
    window.addEventListener('online', retry);
    const timer = setInterval(retry, ROLE_RECHECK_MS);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, [unknown, refreshMembers]);
  useEffect(() => {
    if (unknown && syncTick > 0) {
      void refreshMembers?.();
      setRecheck((n) => n + 1);
    }
    // nur auf neue Meldungen der Warteschlange reagieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTick]);

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
  if (current?.isOwner || awaiting === true) {
    // @FU-098: bestätigter Eigentümer, oder hier angelegt und noch nicht in der Cloud.
    return { role: 'owner', isLoading: false };
  }
  if (membersFailed || current?.failed) {
    return awaiting === null ? { role: null, isLoading: true } : { role: null, isLoading: false, isUnknown: true };
  }
  if (current) {
    // „kein Eigentümer“ zählt erst, wenn feststeht, dass nichts auf die erste Übertragung wartet (@FU-099).
    return awaiting === null || staleNo ? { role: null, isLoading: true } : { role: null, isLoading: false };
  }
  // A-11: solange die Eigentümer-Prüfung aussteht (auch im ersten Render vor dem Effekt), gilt die Rolle als ladend.
  return { role: null, isLoading: isCheckingOwnership || needsOwnerCheck };
}

/**
 * Bequemlichkeits-Variante für Stellen, die sonst KEINE eigene `useTournamentMembers()`-Instanz
 * brauchen (DangerZoneCategory, TeamHelpersCategory) — holt die Mitgliedschaft selbst.
 */
export function useMyTournamentRole(tournamentId: string): UseMyTournamentRoleReturn {
  const { myMembership, isLoading, loadFailed, refresh } = useTournamentMembers(tournamentId);
  return useEffectiveTournamentRole(tournamentId, myMembership, isLoading, { membersFailed: loadFailed, refreshMembers: refresh });
}
