/**
 * CA-5 (Befund C-LISTE-NUR-EIGENTUEMER; @HE-085, @HE-086, @HE-087): die Startseiten-Liste eines Kontos aus der Cloud.
 *
 * - Eigene Turniere (`owner_id`), Rolle `owner`. Gelesen auch die im Papierkorb (`deleted_at`), damit `ownIds` sie kennt;
 *   in der Liste stehen sie wie bisher nicht.
 * - Dazu Turniere mit angenommener, nicht widerrufener Mitgliedschaft (`tournament_collaborators`: `accepted_at` gesetzt,
 *   `declined_at` leer – dieselbe Regel wie `is_active_tournament_member`), mit der Rolle aus der Mitgliedszeile.
 *   Nie über die Lese-Regel allein: `tournaments_select_v3` lässt jedes öffentliche Turnier durch (Plan-Review CA, § 3).
 * - Rollenumfang (Plan-Review Auflage 10d): echte Konten listen alle aktiven Mitgliedschaften; eine anonyme Sitzung
 *   (Geräte-Zugang, Gast-Konto) fragt keine Mitgliedschaften ab – ihre Liste bleibt wie bisher.
 * - Scheitert nur die Mitglieder-Abfrage, bleiben die eigenen Turniere stehen, `memberships = 'unknown'` (@FU-100).
 * Keine Migration: alter und neuer Server-Stand haben dieselben Spalten und Lese-Regeln.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { Tournament, TournamentListRole } from '../../types/tournament';
import { RepositoryError } from '../errors';
import { mapTournamentFromSupabase } from './supabaseMappers';

/** `known`: Abfrage gelungen · `unknown`: Abfrage gescheitert · `not-queried`: anonyme Sitzung oder kein Konto. */
export type MembershipLookup = 'known' | 'unknown' | 'not-queried';

export interface CloudTournamentList {
    /** Sichtbare Turniere (nicht im Papierkorb), jedes mit `myRole`. */
    tournaments: Tournament[];
    /** Alle eigenen Turniere des Kontos, auch die im Papierkorb. */
    ownIds: ReadonlySet<string>;
    memberships: MembershipLookup;
    membershipError?: Error;
}

/** Rollen einer Mitgliedszeile, die die Startseite kennt (CHECK `tournament_collaborators_role_check` ohne 'owner'). */
const MEMBER_ROLES: readonly TournamentListRole[] = ['co-admin', 'trainer', 'collaborator', 'viewer'];

type Client = SupabaseClient<Database>;
type TournamentRow = Database['public']['Tables']['tournaments']['Row'];

function listed(row: TournamentRow, myRole: TournamentListRole): Tournament {
    return { ...mapTournamentFromSupabase(row, [], []), myRole };
}

async function readOwn(client: Client, userId: string): Promise<{ tournaments: Tournament[]; ownIds: Set<string> }> {
    const { data, error } = await client
        .from('tournaments')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false });
    if (error) {
        throw new RepositoryError('list', error.message, error);
    }
    return {
        tournaments: data.filter((row) => row.deleted_at === null).map((row) => listed(row, 'owner')),
        ownIds: new Set(data.map((row) => row.id)),
    };
}

async function readMemberTournaments(client: Client, userId: string, ownIds: ReadonlySet<string>): Promise<Tournament[]> {
    const { data: rows, error } = await client
        .from('tournament_collaborators')
        .select('tournament_id, role')
        .eq('user_id', userId)
        .not('accepted_at', 'is', null)
        .is('declined_at', null);
    if (error) {
        throw new RepositoryError('listMemberships', error.message, error);
    }
    const roleById = new Map<string, TournamentListRole>();
    for (const row of rows) {
        const role = MEMBER_ROLES.find((known) => known === row.role);
        if (role !== undefined && !ownIds.has(row.tournament_id)) {
            roleById.set(row.tournament_id, role);
        }
    }
    if (roleById.size === 0) {
        return [];
    }
    const { data, error: listError } = await client
        .from('tournaments')
        .select('*')
        .in('id', [...roleById.keys()])
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
    if (listError) {
        throw new RepositoryError('listMemberships', listError.message, listError);
    }
    return data.flatMap((row) => {
        const role = roleById.get(row.id);
        return role === undefined ? [] : [listed(row, role)];
    });
}

export async function readAccountTournamentList(client: Client): Promise<CloudTournamentList> {
    const {
        data: { user },
    } = await client.auth.getUser();
    if (!user) {
        return { tournaments: [], ownIds: new Set(), memberships: 'not-queried' };
    }
    const own = await readOwn(client, user.id);
    if (user.is_anonymous === true) {
        return { ...own, memberships: 'not-queried' };
    }
    try {
        const members = await readMemberTournaments(client, user.id, own.ownIds);
        return { tournaments: [...own.tournaments, ...members], ownIds: own.ownIds, memberships: 'known' };
    } catch (error) {
        const membershipError = error instanceof Error ? error : new Error(String(error));
        return { ...own, memberships: 'unknown', membershipError };
    }
}
