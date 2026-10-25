/**
 * R3-3 Spiel im Spielplan beenden / Ergebnis eintragen (#337, Schnelleingabe) nach dem Abschluss -- zweite Linie hinter dem
 * Spielplan, der die Eingabe schon nicht mehr anbietet (Abschluss.sperre.spielplan.test.tsx). @LZ-036 Z. 1 „ein Tor … eintragen
 * -> wird abgelehnt mit ‚Turnier ist abgeschlossen‘“: kommt die Eingabe doch an, wird nichts gesendet und die Person sieht den
 * Hinweis (nie still verworfen). Gegenbeispiel: offen -- die Eingabe läuft bis zur Engine (hier: ohne Engine „nicht verfügbar“).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';

const ensureMatch = vi.hoisted(() => vi.fn());
vi.mock('../../match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => ({ engine: { ensureMatch }, store: {}, sender: {}, accountId: 'olli' }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.mock('../hooks/useResultEntryAck', () => ({ useResultEntryAck: () => vi.fn() }));

import { setTournamentClosed, resetClosedTournaments } from '../../../core/services/closedTournaments';
import { useScheduleResultEntry } from '../hooks/useScheduleResultEntry';

const tournament = { id: 'cup', title: 'Live-Cup', matches: [], teams: [] } as unknown as Tournament;

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); });
afterEach(() => resetClosedTournaments());

describe('@LZ-036 Ergebnis im Spielplan nach dem Abschluss', () => {
  it('abgeschlossen: kein Eintrag, Hinweis „abgeschlossen“ statt stillem Verwerfen', async () => {
    setTournamentClosed('cup', true);
    const showWarning = vi.fn();
    const { result } = renderHook(() => useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false }));
    await expect(result.current.enterScore('m1', 2, 1)).resolves.toBe(false);
    expect(showWarning).toHaveBeenCalledWith('tournament:rights.closedSaveBlocked');
    expect(ensureMatch).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: offen – die Eingabe wird bearbeitet (Spiel unbekannt: anderer Hinweis, nie „abgeschlossen“)', async () => {
    const showWarning = vi.fn();
    const { result } = renderHook(() => useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false }));
    await expect(result.current.enterScore('m1', 2, 1)).resolves.toBe(false);
    expect(showWarning).toHaveBeenCalledTimes(1);
    expect(showWarning).not.toHaveBeenCalledWith('tournament:rights.closedSaveBlocked');
  });
});
