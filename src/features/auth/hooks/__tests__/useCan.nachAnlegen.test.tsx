/**
 * Rechte direkt nach dem Anlegen und bei gescheiterter Mitglieder-Abfrage (Review A-11 A4, Brief A-11-Fix A0).
 * Befund C-RECHTE-NACH-ANLEGEN-UNBEKANNT. Anforderung: `plattform/2026-09-24_fundament-gemeinsamer-stand.md`
 * @FU-098, @FU-099, @FU-100.
 *
 * Gemockt wird nur der Rand: Anmeldung, der Supabase-Client (Mitglieder-Abfrage + RPC) und die Sync-Quelle des Kontos.
 * Die Kette useCan → useMyTournamentRole → useTournamentMembers → membershipService → hasPermission läuft echt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  setActiveTournamentSyncSource,
  type TournamentSyncSource,
} from '../../../../core/repositories/activeTournamentSyncSource';

type Result = { data: unknown; error: { message: string } | null };
/** Antwort der Mitglieder-Abfrage (`tournament_collaborators`); 'throw' = kein Netz. */
type MembersAnswer = Result | 'throw';

const net = vi.hoisted(() => {
  const state: { members: MembersAnswer; rpc: ReturnType<typeof vi.fn> } = { members: { data: [], error: null }, rpc: vi.fn() };
  return state;
});

vi.mock('../useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'olli' } }) }));

function membersBuilder() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    not: () => builder,
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          if (net.members === 'throw') {
            throw new Error('Failed to fetch');
          }
          return net.members;
        })
        .then(resolve, reject),
  };
  return builder;
}

vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return { rpc: net.rpc, from: () => membersBuilder() };
  },
  get isSupabaseConfigured() {
    return true;
  },
}));

const memory = vi.hoisted(() => new Map<string, string>());
vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  },
}));

import { useCan } from '../useCan';

const LIVE_CUP = 'live-cup';

/** Sync-Quelle des Kontos: „noch nicht in der Cloud“ (`awaiting`), Benachrichtigung wie die Warteschlange. */
function syncSource(awaiting: boolean) {
  const listeners = new Set<() => void>();
  const state = { awaiting };
  const source: TournamentSyncSource = {
    isAwaitingFirstUpload: vi.fn(async (id: string) => id === LIVE_CUP && state.awaiting),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    source,
    finishSync: () => {
      state.awaiting = false;
      listeners.forEach((listener) => listener());
    },
  };
}

function memberRow(userId: string, role: string) {
  return {
    id: `m-${userId}`, tournament_id: LIVE_CUP, user_id: userId, invite_email: null, invite_code: null, role,
    team_ids: [], label: null, max_uses: null, use_count: null, expires_at: null, invited_at: null, invited_by: null,
    accepted_at: '2026-10-19T10:00:00Z', declined_at: null, created_at: '2026-10-19T09:00:00Z',
    allowed_fields: null, allowed_groups: null,
  };
}

/** Mehrere Rechte aus EINEM Hook-Baum (eine Mitglieder-Abfrage, eine Eigentümer-Prüfung je Hook). */
function useRights() {
  return {
    manageSchedule: useCan('manageSchedule', LIVE_CUP),
    writeMatchData: useCan('writeMatchData', LIVE_CUP),
    leadMatches: useCan('leadMatches', LIVE_CUP),
    tournamentSettings: useCan('tournamentSettings', LIVE_CUP),
    deleteTournament: useCan('deleteTournament', LIVE_CUP),
  };
}

/** Lässt Abfrage und Prüfung ganz durchlaufen: ein Zwischenstand (lädt → L7) darf keinen Test grün machen. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

const ALL_TRUE = { manageSchedule: true, writeMatchData: true, leadMatches: true, tournamentSettings: true, deleteTournament: true };
const ALL_FALSE = { manageSchedule: false, writeMatchData: false, leadMatches: false, tournamentSettings: false, deleteTournament: false };
const ONLY_PLAY = { manageSchedule: false, writeMatchData: true, leadMatches: false, tournamentSettings: false, deleteTournament: false };

beforeEach(() => {
  vi.clearAllMocks();
  memory.clear();
  net.members = { data: [], error: null };
  setActiveTournamentSyncSource(null);
});

afterEach(() => {
  setActiveTournamentSyncSource(null);
});

describe('@FU-098 Wer ein Turnier angelegt hat, hat sofort alle Rechte, auch bevor es in der Cloud ist', () => {
  it('@FU-098 die Übertragung läuft noch, Olli öffnet den Spielplan: „Spielplan bearbeiten“ und Spiel 1 leiten', async () => {
    setActiveTournamentSyncSource(syncSource(true).source);
    net.rpc.mockResolvedValue({ data: false, error: null }); // die Cloud kennt den Live-Cup noch nicht

    const { result } = renderHook(() => useRights());

    await waitFor(() => expect(net.rpc).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toEqual(ALL_TRUE));
  });

  it('@FU-098 sein Gerät hat kein Netz, Olli öffnet das Cockpit von Spiel 1: alle Eigentümer-Rechte', async () => {
    setActiveTournamentSyncSource(syncSource(true).source);
    net.members = 'throw';
    net.rpc.mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => useRights());

    await waitFor(() => expect(result.current).toEqual(ALL_TRUE));
  });

  it('@FU-098 ohne Neuladen: wird die Übertragung fertig, fragt die App den Server erneut und Olli bleibt Eigentümer', async () => {
    const sync = syncSource(true);
    setActiveTournamentSyncSource(sync.source);
    net.rpc.mockResolvedValue({ data: false, error: null });
    const { result } = renderHook(() => useRights());
    await waitFor(() => expect(result.current).toEqual(ALL_TRUE));
    const callsBefore = net.rpc.mock.calls.length;

    net.rpc.mockResolvedValue({ data: true, error: null }); // jetzt in der Cloud
    act(() => sync.finishSync());

    await waitFor(() => expect(net.rpc.mock.calls.length).toBeGreaterThan(callsBefore));
    await waitFor(() => expect(result.current).toEqual(ALL_TRUE));
  });
});

describe('@FU-099 Ein angemeldeter Fremder bekommt keine Rechte', () => {
  it('@FU-099 Mitglieder-Abfrage „kein Mitglied“, Server „kein Eigentümer“, nichts wartet: weder bearbeiten noch leiten', async () => {
    setActiveTournamentSyncSource(syncSource(false).source);
    net.rpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useRights());

    await waitFor(() => expect(net.rpc).toHaveBeenCalled());
    await settle();
    expect(result.current).toEqual(ALL_FALSE);
  });

  it('@FU-099 Gegenbeispiel: auch ein gemerktes „Co-Admin“ hilft einem bestätigten Fremden nicht', async () => {
    memory.set(`tournament-role:${LIVE_CUP}`, 'co-admin');
    net.rpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useRights());

    await waitFor(() => expect(net.rpc).toHaveBeenCalled());
    await settle();
    expect(result.current).toEqual(ALL_FALSE);
  });
});

describe('@FU-100 Scheitert die Mitglieder-Abfrage, ist die Rolle unbekannt – nicht „kein Recht“ und nicht „alle Rechte“', () => {
  it('@FU-100 gemerkte Rolle „Helfer“: Spiel 13 anpfeifen ja, „Spielplan bearbeiten“ nein', async () => {
    memory.set(`tournament-role:${LIVE_CUP}`, 'collaborator');
    net.members = { data: null, error: { message: 'upstream timeout' } };
    net.rpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useRights());

    await settle();
    expect(result.current).toEqual(ONLY_PLAY);
    // „unbekannt“ ist nicht „bestätigt kein Mitglied“: die gemerkte Rolle bleibt stehen
    expect(memory.get(`tournament-role:${LIVE_CUP}`)).toBe('collaborator');
  });

  it('@FU-100 die gemerkte Rolle gilt bei unbekannter Rolle wirklich (gemerkt „Co-Admin“ → „Spielplan bearbeiten“ ja)', async () => {
    memory.set(`tournament-role:${LIVE_CUP}`, 'co-admin');
    net.members = { data: null, error: { message: 'upstream timeout' } };
    net.rpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useRights());

    await settle();
    expect(result.current).toEqual({ ...ONLY_PLAY, manageSchedule: true, leadMatches: true, tournamentSettings: true });
  });

  it('@FU-100 ohne gemerkte Rolle bietet die App nur den Spielbetrieb an, keine Verwaltung', async () => {
    net.members = { data: null, error: { message: 'upstream timeout' } };
    net.rpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useRights());

    await settle();
    expect(result.current).toEqual(ONLY_PLAY);
  });

  it('@FU-100 Gegenbeispiel: eine gescheiterte Abfrage ist nicht „alle Rechte“ (nichts wartet auf die erste Übertragung)', async () => {
    setActiveTournamentSyncSource(syncSource(false).source);
    net.members = 'throw';
    net.rpc.mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => useRights());

    await settle();
    expect(result.current).toEqual(ONLY_PLAY);
  });

  it('@FU-100 sobald die Abfrage wieder gelingt, gilt die Rolle vom Server, ohne Neuladen', async () => {
    memory.set(`tournament-role:${LIVE_CUP}`, 'collaborator');
    net.members = 'throw';
    net.rpc.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(() => useRights());
    await settle();
    expect(result.current).toEqual(ONLY_PLAY);

    net.members = { data: [memberRow('olli', 'co-admin')], error: null };
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.manageSchedule).toBe(true));
    expect(result.current.deleteTournament).toBe(false);
  });
});

/**
 * Review A-11 Fixrunde 1, V1 (Wettlauf, Vorlage des Reviewers): Die Eigentümer-Prüfung ist unterwegs, die Übertragung
 * wird fertig, ERST DANACH kommt das veraltete „kein Eigentümer“ an. Es zählt nicht – die App fragt erneut.
 */
describe('@FU-098 ohne Neuladen – Wettlauf: veraltetes „nein“ kommt erst nach dem Sync an', () => {
  it('@FU-098 Prüfung unterwegs, Übertragung fertig, dann „nein“: die App fragt erneut und Olli behält alle Rechte', async () => {
    const sync = syncSource(true);
    setActiveTournamentSyncSource(sync.source);
    const pending: Array<(value: Result) => void> = [];
    net.rpc.mockImplementation(() => new Promise<Result>((resolve) => { pending.push(resolve); }));
    const { result } = renderHook(() => useRights());
    await settle();
    expect(result.current).toEqual(ALL_TRUE);

    act(() => sync.finishSync()); // Übertragung fertig, BEVOR die Antworten kommen
    await settle();
    net.rpc.mockResolvedValue({ data: true, error: null });
    await act(async () => { pending.forEach((resolve) => resolve({ data: false, error: null })); });
    await settle();

    await waitFor(() => expect(result.current).toEqual(ALL_TRUE));
  });

  it('@FU-098 Prüfung startet, bevor die Sync-Quelle geantwortet hat; Übertragung fertig vor dem „nein“: Olli behält alle Rechte', async () => {
    const listeners = new Set<() => void>();
    const state = { awaiting: true };
    let releaseFirst: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const source: TournamentSyncSource = {
      isAwaitingFirstUpload: vi.fn(async () => { await gate; return state.awaiting; }),
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    };
    setActiveTournamentSyncSource(source);
    const pending: Array<(value: Result) => void> = [];
    net.rpc.mockImplementation(() => new Promise<Result>((resolve) => { pending.push(resolve); }));
    const { result } = renderHook(() => useRights());
    await settle();

    state.awaiting = false;
    act(() => { releaseFirst(); listeners.forEach((listener) => listener()); });
    await settle();
    net.rpc.mockResolvedValue({ data: true, error: null });
    await act(async () => { pending.forEach((resolve) => resolve({ data: false, error: null })); });
    await settle();

    await waitFor(() => expect(result.current).toEqual(ALL_TRUE));
  });
});
