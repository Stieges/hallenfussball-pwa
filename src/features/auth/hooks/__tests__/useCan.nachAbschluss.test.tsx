/**
 * R3-3 (Plan R3 V6): die Sperre nach dem Abschluss sitzt ZENTRAL in `useCan` -- „die EINE Frage nach einem Recht“.
 * Szenarien: @LZ-036 „Nach dem Abschluss ist alles gesperrt“ (Z. 3–6: die App bietet es nicht an), @LZ-037 „Nach dem
 * Abschluss bleiben nur öffentliche Ansicht und Ablage änderbar“ (Z. 5, 7: Helfer entfernen, Code erneuern bleiben).
 * Erwartung kommt aus der Anforderung (alle schreibenden Rechte zu, außer Helfer verwalten und Anzeige lesen), nicht aus dem Code.
 * Gemockt wird nur unterhalb von useMyTournamentRole; die Kette useCan -> hasPermission läuft echt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const roleMock = vi.hoisted((): { current: string } => ({ current: 'owner' }));
vi.mock('../useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: roleMock.current, isLoading: false }),
}));
vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
}));

import { setTournamentClosed, resetClosedTournaments } from '../../../../core/services/closedTournaments';
import { useCan, canWithListedRole, PERMISSIONS_OPEN_AFTER_CLOSE } from '../useCan';

const WRITING = [
  'writeMatchData', 'correctEvents', 'tournamentSettings', 'teams', 'restructure', 'deleteTournament',
  'leadMatches', 'manageSchedule', 'manageLifecycle', 'manageScreens', 'manageMembers',
] as const;
const STAYS_OPEN = ['manageHelpers', 'readDisplay'] as const;

beforeEach(() => { roleMock.current = 'owner'; resetClosedTournaments(); });
afterEach(() => { resetClosedTournaments(); });

describe('@LZ-036 abgeschlossen: kein schreibendes Recht', () => {
  it.each(WRITING)('Olli (Eigentümer): useCan(%s) ist offen true, nach dem Abschluss false', (right) => {
    const { result } = renderHook(() => useCan(right, 'cup'));
    expect(result.current).toBe(true);
    act(() => setTournamentClosed('cup', true));
    expect(result.current).toBe(false);
  });

  it.each(['co-admin', 'collaborator'])('%s: auch die eigenen Rechte schließen sich (writeMatchData)', (role) => {
    roleMock.current = role;
    const { result } = renderHook(() => useCan('writeMatchData', 'cup'));
    expect(result.current).toBe(true);
    act(() => setTournamentClosed('cup', true));
    expect(result.current).toBe(false);
  });

  it('Wiederöffnen (Zustand wieder offen) gibt die Rechte zurück', () => {
    const { result } = renderHook(() => useCan('tournamentSettings', 'cup'));
    act(() => setTournamentClosed('cup', true));
    expect(result.current).toBe(false);
    act(() => setTournamentClosed('cup', false));
    expect(result.current).toBe(true);
  });

  it('Gegenbeispiel: ein anderes, offenes Turnier bleibt ungesperrt', () => {
    act(() => setTournamentClosed('cup', true));
    const { result } = renderHook(() => useCan('tournamentSettings', 'anderes-turnier'));
    expect(result.current).toBe(true);
  });
});

describe('@LZ-037 abgeschlossen: was offen bleibt', () => {
  it.each(STAYS_OPEN)('Olli: useCan(%s) bleibt nach dem Abschluss true (Positivliste)', (right) => {
    act(() => setTournamentClosed('cup', true));
    const { result } = renderHook(() => useCan(right, 'cup'));
    expect(result.current).toBe(true);
  });

  it('die Positivliste ist genau Helfer verwalten + Anzeige lesen (kein Recht rutscht heimlich hinein)', () => {
    expect([...PERMISSIONS_OPEN_AFTER_CLOSE].sort()).toEqual([...STAYS_OPEN].sort());
  });

  it('die öffentliche Ansicht (manageLifecycle) bleibt nur für den Aufrufer offen, der es ausdrücklich verlangt', () => {
    act(() => setTournamentClosed('cup', true));
    const plain = renderHook(() => useCan('manageLifecycle', 'cup'));
    const open = renderHook(() => useCan('manageLifecycle', 'cup', { openAfterClose: true }));
    expect(plain.result.current).toBe(false);
    expect(open.result.current).toBe(true);
  });

  it('openAfterClose öffnet kein Recht, das die Rolle gar nicht hat (Tom bleibt ohne Verwaltung)', () => {
    roleMock.current = 'collaborator';
    act(() => setTournamentClosed('cup', true));
    const { result } = renderHook(() => useCan('manageLifecycle', 'cup', { openAfterClose: true }));
    expect(result.current).toBe(false);
  });
});

describe('Startseite: canWithListedRole bei abgeschlossenem Turnier (@LZ-036: kein Papierkorb)', () => {
  it('Löschen ist offen angeboten, abgeschlossen nicht', () => {
    expect(canWithListedRole('owner', 'deleteTournament')).toBe(true);
    expect(canWithListedRole('owner', 'deleteTournament', true)).toBe(false);
  });
  it('Gegenbeispiel: Helfer verwalten bleibt auch abgeschlossen offen', () => {
    expect(canWithListedRole('owner', 'manageHelpers', true)).toBe(true);
  });
});
