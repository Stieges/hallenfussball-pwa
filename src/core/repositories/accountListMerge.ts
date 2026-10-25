/**
 * CA-5 (Plan-Review Auflage 10a/b; @HE-085, @HE-087, @FU-100): Cloud-Liste und lokale Kopien eines Kontos zur
 * Startseiten-Liste zusammenführen. Reine Entscheidung, das Lesen und Schreiben macht `OfflineRepository`.
 *
 * - Kopie stammt aus der Cloud (`changeRevision` liest nur ein Cloud-Abruf, A-10), das Turnier steht nach gelungener
 *   Abfrage aber weder unter den eigenen (auch Papierkorb) noch unter den Mitgliedschaften → das Konto gehört nicht
 *   (mehr) dazu: die Kopie erscheint nicht als „nur lokal“ und wird nie hochgeladen. Kein Zeitstempel-Vergleich.
 * - Rollen-Gedächtnis je Konto (`safeLocalStorage`): Rolle je Turnier und die Turniere, aus denen das Konto
 *   ausgetragen ist. Ohne Netz liefert die lokale Liste damit dieselbe Rolle (kein „Löschen“ für die Co-Admin).
 * - Mitglieder-Abfrage gescheitert: nichts neu ausblenden, Rollen aus dem Gedächtnis. Anonyme Sitzung: wie bisher.
 */
import type { Tournament, TournamentListRole } from '../../types/tournament';
import { safeLocalStorage } from '../utils/safeStorage';
import type { CloudTournamentList } from './accountTournamentList';

export interface AccountRoleMemory {
    roles: Readonly<Record<string, TournamentListRole>>;
    /** Turniere, die dieses Konto nicht mehr sieht (ausgetragen, gelöscht, fremd). */
    former: readonly string[];
}

const EMPTY_MEMORY: AccountRoleMemory = { roles: {}, former: [] };
const KNOWN_ROLES: readonly TournamentListRole[] = ['owner', 'co-admin', 'trainer', 'collaborator', 'viewer'];

const memoryKey = (accountId: string): string => `tournament-list-roles:${accountId}`;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Liest das Gedächtnis; Unlesbares oder unbekannte Rollen zählen als „nichts gemerkt“. */
export function readAccountRoleMemory(accountId: string): AccountRoleMemory {
    let parsed: unknown;
    try {
        parsed = JSON.parse(safeLocalStorage.getItem(memoryKey(accountId)) ?? 'null');
    } catch {
        return EMPTY_MEMORY;
    }
    if (!isRecord(parsed)) {
        return EMPTY_MEMORY;
    }
    const roles: Record<string, TournamentListRole> = {};
    if (isRecord(parsed.roles)) {
        for (const [id, value] of Object.entries(parsed.roles)) {
            const role = KNOWN_ROLES.find((known) => known === value);
            if (role !== undefined) {
                roles[id] = role;
            }
        }
    }
    const former = Array.isArray(parsed.former) ? parsed.former.filter((id): id is string => typeof id === 'string') : [];
    return { roles, former };
}

export function writeAccountRoleMemory(accountId: string, memory: AccountRoleMemory): void {
    safeLocalStorage.setItem(memoryKey(accountId), JSON.stringify(memory));
}

/** R3-1: Zustand und „angepfiffen“ gehören dem Server – auch wenn die lokale Fassung sonst neuer ist. */
const withServerState = (localT: Tournament, cloudT: Tournament): Tournament => ({
    ...localT,
    lifecycleStatus: cloudT.lifecycleStatus,
    finishedAt: cloudT.finishedAt,
    anyMatchStarted: cloudT.anyMatchStarted,
    lastMatchEndedAt: cloudT.lastMatchEndedAt,
});

const withRole = (tournament: Tournament, role: TournamentListRole | undefined): Tournament => {
    const { myRole: _stored, ...rest } = tournament;
    return role === undefined ? rest : { ...rest, myRole: role };
};

export interface AccountListInput {
    cloud: CloudTournamentList;
    local: readonly Tournament[];
    memory: AccountRoleMemory;
    /** @W5-027: gilt die lokale Fassung statt der Cloud-Zeile? */
    preferLocal: (cloud: Tournament, local: Tournament) => boolean;
}

export interface AccountListResult {
    list: Tournament[];
    /** Neues Gedächtnis; `undefined` = unverändert lassen (anonyme Sitzung). */
    memory?: AccountRoleMemory;
}

export function mergeAccountList({ cloud, local, memory, preferLocal }: AccountListInput): AccountListResult {
    const cloudIds = new Set(cloud.tournaments.map((t) => t.id));
    const localById = new Map(local.map((t) => [t.id, t]));
    const merged = cloud.tournaments.map((cloudT) => {
        const localT = localById.get(cloudT.id);
        return localT && preferLocal(cloudT, localT) ? withRole(withServerState(localT, cloudT), cloudT.myRole) : cloudT;
    });
    const notListed = local.filter((t) => !cloudIds.has(t.id));

    if (cloud.memberships === 'not-queried') {
        return { list: [...merged, ...notListed.map((t) => withRole(t, undefined))] };
    }

    const roles: Record<string, TournamentListRole> = {};
    for (const t of merged) {
        if (t.myRole !== undefined) {
            roles[t.id] = t.myRole;
        }
    }

    if (cloud.memberships === 'known') {
        const former = notListed.filter((t) => t.changeRevision !== undefined && !cloud.ownIds.has(t.id)).map((t) => t.id);
        const formerIds = new Set(former);
        const localOnly = notListed.filter((t) => !formerIds.has(t.id)).map((t) => withRole(t, 'owner'));
        return { list: [...merged, ...localOnly], memory: { roles, former } };
    }

    // Mitglieder-Abfrage gescheitert: Gemerktes gilt, eigene Rollen aus der Cloud kommen dazu.
    const former = memory.former.filter((id) => !cloudIds.has(id));
    const formerIds = new Set(former);
    const localOnly = notListed.filter((t) => !formerIds.has(t.id)).map((t) => withRole(t, memory.roles[t.id]));
    return { list: [...merged, ...localOnly], memory: { roles: { ...memory.roles, ...roles }, former } };
}

/** Ohne Netz: lokale Kopien ohne die ausgetragenen, mit der gemerkten Rolle. */
export function offlineAccountList(local: readonly Tournament[], memory: AccountRoleMemory): Tournament[] {
    const formerIds = new Set(memory.former);
    return local.filter((t) => !formerIds.has(t.id)).map((t) => withRole(t, memory.roles[t.id]));
}
