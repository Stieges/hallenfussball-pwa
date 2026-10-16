/**
 * A-08f3a2/b (Plan `task-A-08f3-plan.md` v4): übernommene Server-Revision je Spiel, je Turnier, mit Benachrichtigung.
 *
 * - `serverLedMatchIds(id)`: Spiele mit Revision > 1 (Server führt den Spielstand). a2 sperrt dafür die
 *   Schnelleingabe wie heute (Befund C-SCHNELLEINGABE-SPERRE-STATUS, Rückbau in e2).
 * - `subscribe(id, cb)`: meldet je Übernahme die Spiele, deren Revision gestiegen ist (b, H-1: geladene
 *   Engine-Kopien nachladen). `OfflineRepository` kennt die Engine nicht (Layering).
 * Anforderungen: @FU-087, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
export type ServerRevisionListener = (raisedMatchIds: ReadonlySet<string>) => void;

/** Lesesicht für Hooks (Duck-Typing, damit Test-Fakes ohne Klasse auskommen). */
export interface ServerRevisionSource {
    serverLedMatchIds(tournamentId: string): ReadonlySet<string>;
    subscribeServerRevisions(tournamentId: string, listener: ServerRevisionListener): () => void;
}

export function isServerRevisionSource(value: unknown): value is ServerRevisionSource {
    return typeof value === 'object' && value !== null
        && typeof (value as Partial<ServerRevisionSource>).serverLedMatchIds === 'function'
        && typeof (value as Partial<ServerRevisionSource>).subscribeServerRevisions === 'function';
}

const EMPTY: ReadonlySet<string> = new Set();

export class ServerRevisionRegistry {
    private readonly revisions = new Map<string, ReadonlyMap<string, number>>();
    /** Stabile Referenz je Turnier für `useSyncExternalStore` (neu nur bei Änderung). */
    private readonly ledSets = new Map<string, ReadonlySet<string>>();
    private readonly listeners = new Map<string, Set<ServerRevisionListener>>();

    get(tournamentId: string): ReadonlyMap<string, number> {
        return this.revisions.get(tournamentId) ?? new Map();
    }

    /** Setzt den Stand je Spiel (nie rückwärts) und meldet die Spiele mit gestiegener Revision. */
    record(tournamentId: string, next: ReadonlyMap<string, number>): void {
        const previous = this.get(tournamentId);
        const merged = new Map(previous);
        const raised = new Set<string>();
        for (const [matchId, revision] of next) {
            if (revision > (previous.get(matchId) ?? 0)) { merged.set(matchId, revision); raised.add(matchId); }
        }
        if (raised.size === 0) { return; }
        this.store(tournamentId, merged, raised);
    }

    /** Turnier gelöscht: Stand verwerfen. */
    clear(tournamentId: string): void {
        this.retain(tournamentId, EMPTY);
    }

    /** Spielplan neu erzeugt: nur die Revisionen der noch vorhandenen Spiele behalten. */
    retain(tournamentId: string, matchIds: ReadonlySet<string>): void {
        const previous = this.get(tournamentId);
        const kept = new Map([...previous].filter(([matchId]) => matchIds.has(matchId)));
        if (kept.size === previous.size) { return; }
        this.store(tournamentId, kept, EMPTY);
    }

    private store(tournamentId: string, revisions: ReadonlyMap<string, number>, raised: ReadonlySet<string>): void {
        this.revisions.set(tournamentId, revisions);
        this.ledSets.set(tournamentId, new Set([...revisions].filter(([, revision]) => revision > 1).map(([matchId]) => matchId)));
        this.listeners.get(tournamentId)?.forEach((listener) => listener(raised));
    }

    serverLedMatchIds(tournamentId: string): ReadonlySet<string> {
        return this.ledSets.get(tournamentId) ?? EMPTY;
    }

    subscribe(tournamentId: string, listener: ServerRevisionListener): () => void {
        const set = this.listeners.get(tournamentId) ?? new Set<ServerRevisionListener>();
        set.add(listener);
        this.listeners.set(tournamentId, set);
        return () => { set.delete(listener); };
    }
}
