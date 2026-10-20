/**
 * useCan mit den Geräte-Rollen helper und screen (A-27, brief-A-27.md R-A27-7, § 5 Fehlerpolitik).
 *
 * @FU-100 „Gegeben Tom ist Helfer im „Live-Cup“ und sein Gerät hat sich die Rolle „Helfer“ gemerkt / Und die Abfrage der
 * Mitglieder scheitert … Dann gilt die gemerkte Rolle „Helfer“: Spiel 13 anpfeifen ja, „Spielplan bearbeiten“ nein /
 * Und ohne gemerkte Rolle bietet die App nur den Spielbetrieb an, keine Verwaltung“ -- hier mit der NEUEN Rolle helper
 * (Helfer-Zugang ohne Konto). Gegenbeispiel: ein gemerkter Bildschirm (screen) bekommt keinen Spielbetrieb (nicht L7).
 * Gemockt wird nur unterhalb von useMyTournamentRole (wie useCan.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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

import { useCan } from '../useCan';

const LIVE_CUP = 'live-cup';

function asMember(role: string) {
  useAuthMock.mockReturnValue({ isAuthenticated: true });
  useTournamentMembersMock.mockReturnValue({ myMembership: { role }, isLoading: false });
}
/** Die Abfrage der Mitglieder scheitert (kein Netz): keine Zeile, Eigentümer-Prüfung scheitert. */
function abfrageScheitert() {
  useAuthMock.mockReturnValue({ isAuthenticated: true });
  useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
  rpcMock.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeStorage.clear();
});

describe('@FU-100 Rolle „Helfer“ (Helfer-Zugang ohne Konto, helper)', () => {
  it('@FU-100 vom Server: Spiel 13 anpfeifen ja, „Spielplan bearbeiten“ nein', () => {
    asMember('helper');
    expect(renderHook(() => useCan('writeMatchData', LIVE_CUP)).result.current).toBe(true);
    expect(renderHook(() => useCan('manageSchedule', LIVE_CUP)).result.current).toBe(false);
    expect(renderHook(() => useCan('leadMatches', LIVE_CUP)).result.current).toBe(false);
  });

  it('@FU-100 die Rolle helper wird gemerkt', async () => {
    asMember('helper');
    renderHook(() => useCan('writeMatchData', LIVE_CUP));
    await waitFor(() => expect(fakeStorage.get(`tournament-role:${LIVE_CUP}`)).toBe('helper'));
  });

  it('@FU-100 gemerkt „Helfer“ und die Abfrage scheitert: Spiel 13 anpfeifen ja, „Spielplan bearbeiten“ nein', async () => {
    fakeStorage.set(`tournament-role:${LIVE_CUP}`, 'helper');
    abfrageScheitert();
    const anpfeifen = renderHook(() => useCan('writeMatchData', LIVE_CUP));
    const bearbeiten = renderHook(() => useCan('manageSchedule', LIVE_CUP));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(anpfeifen.result.current).toBe(true);
    expect(bearbeiten.result.current).toBe(false);
  });

  it('@FU-100 Gegenbeispiel: ohne gemerkte Rolle nur der Spielbetrieb (L7), keine Verwaltung', async () => {
    abfrageScheitert();
    const anpfeifen = renderHook(() => useCan('writeMatchData', LIVE_CUP));
    const bearbeiten = renderHook(() => useCan('manageSchedule', LIVE_CUP));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(anpfeifen.result.current).toBe(true);
    expect(bearbeiten.result.current).toBe(false);
  });
});

describe('@ME-059 Rolle „Bildschirm“ (screen): kein Spielbetrieb, auch nicht aus dem Gedächtnis', () => {
  it('@ME-059 vom Server: kein Tor, keine Monitor-Einstellung, Anzeige lesen ja', () => {
    asMember('screen');
    expect(renderHook(() => useCan('writeMatchData', LIVE_CUP)).result.current).toBe(false);
    expect(renderHook(() => useCan('manageScreens', LIVE_CUP)).result.current).toBe(false);
    expect(renderHook(() => useCan('readDisplay', LIVE_CUP)).result.current).toBe(true);
  });

  it('@FU-100 gemerkt „Bildschirm“ und die Abfrage scheitert: kein Spielbetrieb (nicht L7), Anzeige ja', async () => {
    fakeStorage.set(`tournament-role:${LIVE_CUP}`, 'screen');
    abfrageScheitert();
    const tor = renderHook(() => useCan('writeMatchData', LIVE_CUP));
    const anzeige = renderHook(() => useCan('readDisplay', LIVE_CUP));
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(tor.result.current).toBe(false);
    expect(anzeige.result.current).toBe(true);
  });
});
