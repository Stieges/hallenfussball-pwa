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
 * - R3-1 (@LZ-001, @LZ-006, Befund C-STARTSEITE-OHNE-ANPFIFF-CLOUD): die Liste kennt den gespeicherten Zustand
 *   (`lifecycle_status`); „Läuft“ = festgelegt + ein angepfiffenes Spiel. Dafür EINE Zusatzabfrage je Liste: welche der
 *   festgelegten Turniere ein laufendes, pausiertes oder beendetes Spiel haben (dieselbe Regel wie `tournament_lifecycle`).
 *   Scheitert sie, bleibt die Liste stehen (Zustand „Festgelegt“), der Fehler geht nicht verloren.
 * Keine Migration: alter und neuer Server-Stand haben dieselben Spalten und Lese-Regeln.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { Tournament, TournamentListRole } from '../../types/tournament';
import { RepositoryError } from '../errors';
import { mapTournamentFromSupabase } from './supabaseMappers';
import { storedLifecycleOf } from '../services/lifecycle';

/** `known`: Abfrage gelungen · `unknown`: Abfrage gescheitert · `not-queried`: anonyme Sitzung oder kein Konto. */
export type MembershipLookup = 'known' | 'unknown' | 'not-queried';

export interface CloudTournamentList {
    /** Sichtbare Turniere (nicht im Papierkorb), jedes mit `myRole`. */
    tournaments: Tournament[];
    /** Alle eigenen Turniere des Kontos, auch die im Papierkorb. */
    ownIds: ReadonlySet<string>;
    memberships: MembershipLookup;
    membershipError?: Error;
    /** R3-1: die Zusatzabfrage „angepfiffenes Spiel“ ist gescheitert (festgelegte Turniere stehen dann als „Festgelegt“). */
    startedError?: Error;
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

/** Spielstände, die ein Turnier zum „Läuft“ machen (Regel von `public.tournament_lifecycle`). */
const STARTED_MATCH_STATUSES = ['running', 'paused', 'finished'];

/**
 * R3-1: markiert festgelegte Turniere mit einem angepfiffenen Spiel (`anyMatchStarted`). Nur festgelegte werden gefragt – bei
 * Entwurf, Abgeschlossen und Abgebrochen ändert „angepfiffen“ den Zustand nicht. Eine Abfrage für die ganze Liste.
 */
async function markStarted(client: Client, tournaments: Tournament[]): Promise<{ tournaments: Tournament[]; error?: Error }> {
    const fixedIds = tournaments.filter((t) => storedLifecycleOf(t) === 'fixed').map((t) => t.id);
    if (fixedIds.length === 0) {
        return { tournaments };
    }
    const { data, error } = await client
        .from('matches')
        .select('tournament_id')
        .in('tournament_id', fixedIds)
        .in('match_status', STARTED_MATCH_STATUSES);
    if (error) {
        return { tournaments, error: new RepositoryError('listStarted', error.message, error) };
    }
    const started = new Set(data.map((row) => row.tournament_id));
    const ended = await lastMatchEnds(client, [...started]);
    return {
        tournaments: tournaments.map((t) => {
            if (!started.has(t.id)) {
                return t;
            }
            const end = ended.get(t.id);
            return { ...t, anyMatchStarted: true, ...(end === undefined ? {} : { lastMatchEndedAt: end }) };
        }),
    };
}

/**
 * @LZ-005 (Hinweis „Turnier läuft noch“ auf der Startseite): je laufendem Turnier das Ende des letzten Spiels, aber nur wenn JEDES Spiel
 * entschieden ist (beendet oder ausgefallen). Scheitert die Abfrage, fehlt der Hinweis – die Liste bleibt stehen.
 */
async function lastMatchEnds(client: Client, tournamentIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (tournamentIds.length === 0) {
        return result;
    }
    const { data, error } = await client.from('matches').select('tournament_id, match_status, actual_end').in('tournament_id', tournamentIds);
    if (error) {
        return result;
    }
    const open = new Set<string>();
    for (const row of data) {
        if (row.match_status !== 'finished' && row.match_status !== 'skipped') {
            open.add(row.tournament_id);
        } else if (row.actual_end !== null && (result.get(row.tournament_id) ?? '') < row.actual_end) {
            result.set(row.tournament_id, row.actual_end);
        }
    }
    open.forEach((id) => result.delete(id));
    return result;
}

export async function readAccountTournamentList(client: Client): Promise<CloudTournamentList> {
    const list = await readAccountTournamentListUnmarked(client);
    const marked = await markStarted(client, list.tournaments);
    return { ...list, tournaments: marked.tournaments, ...(marked.error ? { startedError: marked.error } : {}) };
}

async function readAccountTournamentListUnmarked(client: Client): Promise<CloudTournamentList> {
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
