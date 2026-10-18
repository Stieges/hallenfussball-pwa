/**
 * A-08f3a: Fake-Cloud für Tests mit echtem `OfflineRepository` (Plan A-08f3, Testgerüst).
 *
 * - Stand = Turnier + Revision je Spiel (`matches.version` am Server).
 * - `save` prüft die Version wie der Server (CAS), `updateMatches` zählt die Turnier-Version nicht hoch.
 * - Jede Leseantwort ist einzeln verzögerbar: `holdNextRead()` liefert eine Freigabe, die den
 *   Stand zum Zeitpunkt des Aufrufs zurückgibt (älterer Stand kommt später an).
 */
import { vi } from 'vitest';
import type { Tournament, MatchUpdate } from '../core/models/types';
import type { CloudReadWithRevisions } from '../core/repositories/SupabaseRepository';
import { OptimisticLockError } from '../core/errors';

export interface FakeCloudState {
  tournament: Tournament;
  revisions: Map<string, number>;
}

interface HeldRead {
  release: () => void;
}

function clone(state: FakeCloudState): CloudReadWithRevisions {
  return {
    tournament: structuredClone(state.tournament),
    matchRevisions: new Map(state.revisions),
  };
}

/**
 * A-10 (Teil C, @TM-027): Spielplan-Felder, deren Änderung der Server in `tournaments.change_revision` zählt
 * (Trigger `matches_bump_change_revision`, Spaltenliste = `mapMatchToScheduleUpdate`).
 */
const SCHEDULE_FIELDS = ['slotA', 'slotB', 'round', 'field', 'slot', 'group', 'isFinal', 'finalType', 'label', 'scheduledTime', 'matchNumber', 'phase', 'referee'] as const;

export interface FakeCloudOptions {
  /** A-10: `updateMatches` zählt `changeRevision` je Spiel mit geänderter Spielplan-Spalte (wie der Server nach F2b). */
  countsChangeRevision?: boolean;
}

export function createFakeCloud(initial: FakeCloudState, options: FakeCloudOptions = {}) {
  let state: FakeCloudState = { tournament: structuredClone(initial.tournament), revisions: new Map(initial.revisions) };
  const held: Array<(snapshot: CloudReadWithRevisions) => Promise<void>> = [];

  async function read(id: string): Promise<CloudReadWithRevisions | null> {
    if (state.tournament.id !== id) { return null; }
    const snapshot = clone(state);
    const gate = held.shift();
    if (gate) { await gate(snapshot); }
    return snapshot;
  }

  const fake = {
    getWithMatchRevisions: vi.fn(read),
    get: vi.fn(async (id: string) => (await read(id))?.tournament ?? null),
    save: vi.fn(async (t: Tournament) => {
      const expected = state.tournament.version ?? 0;
      if ((t.version ?? 0) !== expected) { throw new OptimisticLockError(t.id, expected, t.version ?? 0); }
      state = { ...state, tournament: { ...structuredClone(t), version: expected + 1 } };
    }),
    updateMatches: vi.fn(async (_id: string, updates: MatchUpdate[]) => {
      const byId = new Map(updates.map((u) => [u.id, u]));
      const bumps = options.countsChangeRevision
        ? state.tournament.matches.filter((m) => {
          const u = byId.get(m.id) as Record<string, unknown> | undefined;
          return u !== undefined && SCHEDULE_FIELDS.some((f) => f in u && JSON.stringify(u[f]) !== JSON.stringify(m[f]));
        }).length
        : 0;
      state = {
        ...state,
        tournament: {
          ...state.tournament,
          ...(bumps > 0 ? { changeRevision: (state.tournament.changeRevision ?? 0) + bumps } : {}),
          matches: state.tournament.matches.map((m) => ({ ...m, ...(byId.get(m.id) ?? {}) }) as typeof m),
        },
      };
    }),
    updateTournamentMetadata: vi.fn(async () => undefined),
    listForCurrentUser: vi.fn(async () => [] as Tournament[]),
    getByShareCode: vi.fn(async () => null),
  };

  return {
    fake,
    /** Server-Stand ändern (z. B. Tor eines Helfers über `append_match_events`). */
    setState(next: FakeCloudState): void {
      state = { tournament: structuredClone(next.tournament), revisions: new Map(next.revisions) };
    },
    /** Die nächste Leseantwort wird festgehalten, bis `release()` gerufen wird. */
    holdNextRead(): HeldRead {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      held.push(async () => { await gate; });
      return { release: () => release() };
    },
  };
}

/**
 * Ergänzt einen vorhandenen `get`-Fake um `getWithMatchRevisions` (Revision 1 je Spiel = keine Einträge),
 * damit der Hintergrund-Abruf in `OfflineRepository` in älteren Tests nicht still ins Leere läuft.
 */
export function readWithRevisions(get: (id: string) => Promise<Tournament | null>) {
  return async (id: string): Promise<CloudReadWithRevisions | null> => {
    const t = await get(id);
    return t ? { tournament: t, matchRevisions: new Map(t.matches.map((m) => [m.id, 1])) } : null;
  };
}
