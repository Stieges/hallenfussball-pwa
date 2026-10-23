/**
 * useCan (A-11, brief-A-11.md R-A11-3, L7, F2): die EINE Frage der App nach einem Recht.
 * (Endung .tsx: läuft im jsdom-Projekt von vitest, wie alle Hook-Tests mit renderHook.)
 *
 * Erwartungen kommen aus der GELESENEN rolePermissions.json (nicht aus hasPermission()) bzw. aus der Brief-Tabelle
 * R-A11-1. Gemockt wird nur unterhalb von useMyTournamentRole (Anmeldung, Mitgliedschaft, RPC) und der Speicher --
 * die Kette useCan -> useMyTournamentRole -> hasPermission laeuft echt.
 *
 * Szenarien: @W5-017, @ZP-040, @LZ-022, @TM-083, @ZM-019, @HE-042 (App-Seite: wer was angeboten bekommt).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import rolePermissionsJson from '../../permissions/rolePermissions.json';

const useAuthMock = vi.fn();
const useTournamentMembersMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../useAuth', () => ({ useAuth: () => useAuthMock() }));
vi.mock('../useTournamentMembers', () => ({ useTournamentMembers: () => useTournamentMembersMock() }));
vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return { rpc: rpcMock };
  },
  get isSupabaseConfigured() {
    return true;
  },
}));

const fakeStorage = new Map<string, string>();
vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => fakeStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      fakeStorage.set(key, value);
    },
    removeItem: (key: string) => {
      fakeStorage.delete(key);
    },
  },
}));

import { useCan, useCanState } from '../useCan';

/** Die 13 Rechte laut Brief (R-A11-1 + Bestand) -- bewusst hier ausgeschrieben, nicht aus PermissionSchema. */
const RIGHTS = [
  'writeMatchData', 'correctEvents', 'tournamentSettings', 'teams', 'restructure', 'deleteTournament',
  'manageMembers', 'leadMatches', 'manageSchedule', 'manageLifecycle', 'manageScreens', 'manageHelpers', 'readDisplay',
] as const;
type Right = (typeof RIGHTS)[number];

const tableRoles = (rolePermissionsJson as unknown as { roles: Record<string, string[]> }).roles;
function fromJson(role: string, right: Right): boolean {
  return role === 'owner' ? true : (tableRoles[role] ?? []).includes(right);
}

function asMember(role: string) {
  useAuthMock.mockReturnValue({ isAuthenticated: true });
  useTournamentMembersMock.mockReturnValue({ myMembership: { role }, isLoading: false });
}
function asOwnerWithoutRow() {
  useAuthMock.mockReturnValue({ isAuthenticated: true });
  useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
  rpcMock.mockResolvedValue({ data: true, error: null });
}
function asNonMemberOnline() {
  useAuthMock.mockReturnValue({ isAuthenticated: true });
  useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
  rpcMock.mockResolvedValue({ data: false, error: null });
}
/** Offline: keine Mitgliedszeile ladbar, die Eigentuemer-Pruefung scheitert (kein Netz). */
function offline() {
  useAuthMock.mockReturnValue({ isAuthenticated: true });
  useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
  rpcMock.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeStorage.clear();
});

describe('useCan – je Rolle × je Recht aus der gelesenen JSON (@W5-017 @ZP-040 @LZ-022 @TM-083 @ZM-019 @HE-042)', () => {
  const memberCells = ['co-admin', 'collaborator', 'trainer', 'viewer'].flatMap((role) =>
    RIGHTS.map((right) => ({ role, right })),
  );

  it.each(memberCells)('Mitglied $role: useCan($right)', ({ role, right }) => {
    asMember(role);
    const { result } = renderHook(() => useCan(right, 't1'));
    expect(result.current).toBe(fromJson(role, right));
  });

  it.each(RIGHTS)('Eigentümer ohne Mitgliedszeile (RPC bestätigt): useCan(%s) ist true', async (right) => {
    asOwnerWithoutRow();
    const { result } = renderHook(() => useCan(right, 't1'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('@ZP-040: Maria (Co-Admin) darf den Zeitplan ändern, Tom (Helfer) nicht, Tom darf anpfeifen', () => {
    asMember('co-admin');
    expect(renderHook(() => useCan('manageSchedule', 't1')).result.current).toBe(true);
    asMember('collaborator');
    expect(renderHook(() => useCan('manageSchedule', 't1')).result.current).toBe(false);
    expect(renderHook(() => useCan('writeMatchData', 't1')).result.current).toBe(true);
  });

  it('@TM-083: Gruppe abschließen/wieder öffnen (manageLifecycle) und neu besetzen (manageSchedule) – Maria ja, Tom nein', () => {
    asMember('co-admin');
    expect(renderHook(() => useCan('manageLifecycle', 't1')).result.current).toBe(true);
    expect(renderHook(() => useCan('manageSchedule', 't1')).result.current).toBe(true);
    asMember('collaborator');
    expect(renderHook(() => useCan('manageLifecycle', 't1')).result.current).toBe(false);
    expect(renderHook(() => useCan('manageSchedule', 't1')).result.current).toBe(false);
  });

  it('@ZM-019: Folienprogramm (manageScreens) und Zuschauer-Schalter (tournamentSettings) – Maria ja, Tom nein', () => {
    asMember('co-admin');
    expect(renderHook(() => useCan('manageScreens', 't1')).result.current).toBe(true);
    expect(renderHook(() => useCan('tournamentSettings', 't1')).result.current).toBe(true);
    asMember('collaborator');
    expect(renderHook(() => useCan('manageScreens', 't1')).result.current).toBe(false);
    expect(renderHook(() => useCan('tournamentSettings', 't1')).result.current).toBe(false);
  });

  it('@HE-042: Tom benennt kein Team um (teams) und korrigiert nicht (correctEvents)', () => {
    asMember('collaborator');
    expect(renderHook(() => useCan('teams', 't1')).result.current).toBe(false);
    expect(renderHook(() => useCan('correctEvents', 't1')).result.current).toBe(false);
  });

  it('readDisplay hat in A-11 keine Mitgliedsrolle (Rolle screen kommt mit A-27)', () => {
    for (const role of ['co-admin', 'collaborator', 'trainer', 'viewer']) {
      asMember(role);
      expect(renderHook(() => useCan('readDisplay', 't1')).result.current, role).toBe(false);
    }
  });
});

describe('useCan – Gast und Nicht-Mitglied (Gegenbeispiel 8)', () => {
  it.each(RIGHTS)('Gast (lokal, nicht angemeldet): useCan(%s) ist true, nichts ausgeblendet', (right) => {
    useAuthMock.mockReturnValue({ isAuthenticated: false });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
    const { result } = renderHook(() => useCan(right, 't1'));
    expect(result.current).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each(RIGHTS)('Gegen: Konto ohne Mitgliedschaft (online, RPC verneint): useCan(%s) ist false', async (right) => {
    asNonMemberOnline();
    const { result } = renderHook(() => useCan(right, 't1'));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('useCan – Gedächtnis je Turnier und L7 (F2)', () => {
  it('Gegenbeispiel 7: online als Co-Admin gesehen -> offline weiter manageSchedule = true', async () => {
    asMember('co-admin');
    renderHook(() => useCan('manageSchedule', 't-mem'));
    await waitFor(() => expect(fakeStorage.get('tournament-role:t-mem')).toBe('co-admin'));

    offline();
    const { result } = renderHook(() => useCan('manageSchedule', 't-mem'));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('Gegen: Gedächtnis „collaborator“ -> offline manageSchedule = false, writeMatchData = true', async () => {
    fakeStorage.set('tournament-role:t-mem', 'collaborator');
    offline();
    const schedule = renderHook(() => useCan('manageSchedule', 't-mem'));
    const play = renderHook(() => useCan('writeMatchData', 't-mem'));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(schedule.result.current).toBe(false);
    expect(play.result.current).toBe(true);
  });

  it('Gedächtnis speichert nur die Rolle, keinen Rechte-Satz', async () => {
    asMember('collaborator');
    renderHook(() => useCan('writeMatchData', 't-only-role'));
    await waitFor(() => expect(fakeStorage.get('tournament-role:t-only-role')).toBe('collaborator'));
    expect([...fakeStorage.keys()]).toEqual(['tournament-role:t-only-role']);
  });

  it('L7: offline ohne Gedächtnis -> Spielbetrieb (writeMatchData) offen, alle Verwaltungsrechte zu', async () => {
    offline();
    const results = RIGHTS.map((right) => ({ right, hook: renderHook(() => useCan(right, 't-leer')) }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    for (const { right, hook } of results) {
      expect(hook.result.current, right).toBe(right === 'writeMatchData');
    }
  });

  it('Rolle lädt noch: Gedächtnis gilt (Co-Admin -> manageSchedule true), ohne Gedächtnis L7', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: true });
    fakeStorage.set('tournament-role:t-laedt', 'co-admin');
    expect(renderHook(() => useCan('manageSchedule', 't-laedt')).result.current).toBe(true);
    expect(renderHook(() => useCan('manageSchedule', 't-anders')).result.current).toBe(false);
    expect(renderHook(() => useCan('writeMatchData', 't-anders')).result.current).toBe(true);
  });

  it('alter Schlüssel engine-actor-role: wird gelesen („leitung“ -> leadMatches), aber nicht weiter geschrieben', async () => {
    fakeStorage.set('engine-actor-role:t-alt', 'leitung');
    offline();
    const { result } = renderHook(() => useCan('leadMatches', 't-alt'));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(result.current).toBe(true);

    asMember('collaborator');
    renderHook(() => useCan('leadMatches', 't-alt'));
    await waitFor(() => expect(fakeStorage.get('tournament-role:t-alt')).toBe('collaborator'));
    expect(fakeStorage.get('engine-actor-role:t-alt')).toBe('leitung');
  });

  it('Gegen: online bekanntes Nicht-Mitglied nutzt kein Gedächtnis (Server sagt nein)', async () => {
    fakeStorage.set('tournament-role:t-weg', 'co-admin');
    asNonMemberOnline();
    const { result } = renderHook(() => useCan('manageSchedule', 't-weg'));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('useCanState – Ladezustand (A-18a, Review N-4)', () => {
  it('Rolle lädt noch, kein Gedächtnis: isLoading = true (die Seite wartet statt „kein Recht“ zu zeigen), allowed wie useCan', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: true });
    const { result } = renderHook(() => useCanState('manageHelpers', 't-neu'));
    expect(result.current).toEqual({ allowed: false, isLoading: true });
    expect(renderHook(() => useCan('manageHelpers', 't-neu')).result.current).toBe(result.current.allowed);
  });

  it('Gegenbeispiel: mit Gedächtnis wartet niemand (isLoading = false, Recht aus der gemerkten Rolle)', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: true });
    fakeStorage.set('tournament-role:t-bekannt', 'co-admin');
    expect(renderHook(() => useCanState('manageHelpers', 't-bekannt')).result.current).toEqual({ allowed: true, isLoading: false });
  });

  it('Gegenbeispiel: bekannte Rolle oder online bestätigtes Nicht-Mitglied lädt nicht', async () => {
    asMember('collaborator');
    expect(renderHook(() => useCanState('manageHelpers', 't-1')).result.current).toEqual({ allowed: false, isLoading: false });
    asNonMemberOnline();
    const { result } = renderHook(() => useCanState('manageHelpers', 't-2'));
    await waitFor(() => expect(result.current).toEqual({ allowed: false, isLoading: false }));
  });
});
