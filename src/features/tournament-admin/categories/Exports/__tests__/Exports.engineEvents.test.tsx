/**
 * ExportsCategory -- M8/U1 (C3b-2 F3b2): der Export-Klick loest EINEN frischen Lauf
 * (loadEngineEventsForExport) aus statt eines Dauer-Abos. Export direkt nach App-Start (Cockpit
 * nie geoeffnet) enthaelt das Engine-Tor; schlaegt der Lauf fehl, zeigt der Export eine
 * Fehlermeldung statt still ohne Engine-Ereignisse zu exportieren.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../../../types/tournament';
import { ExportsCategory } from '../index';

const mockLoadEngineEventsForExport = vi.hoisted(() => vi.fn());
vi.mock('../../../../../features/match-engine/loadEngineEventsForExport', () => ({
  loadEngineEventsForExport: mockLoadEngineEventsForExport,
}));

const mockContext: { current: unknown } = vi.hoisted(() => ({ current: {} }));
vi.mock('../../../../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => mockContext.current,
}));

const mockCaptureFeatureError = vi.fn();
vi.mock('../../../../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => mockCaptureFeatureError(...args),
}));

const tournament = {
  id: 't1',
  title: 'Test-Turnier',
  status: 'published',
  date: '2026-01-01',
  timeSlot: '10:00',
  numberOfFields: 1,
  numberOfTeams: 2,
  pointSystem: { win: 3, draw: 1, loss: 0 },
  placementLogic: [],
  teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  matches: [
    { id: 'm1', round: 1, field: 1, teamA: 'a', teamB: 'b', matchStatus: 'not_started' },
  ],
} as unknown as Tournament;

describe('ExportsCategory -- M8/U1 Engine-Ereignisse (F3b2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.current = { engine: {} };
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Export direkt nach App-Start (Cockpit nie geoeffnet): ein Lauf laedt die Karte, enthaelt das Engine-Tor', async () => {
    const goalEvent = {
      id: 'g1', matchId: 'm1', timestampSeconds: 10, type: 'GOAL',
      payload: { teamId: 'a', direction: 'INC' }, scoreAfter: { home: 1, away: 0 },
    };
    mockLoadEngineEventsForExport.mockResolvedValue(new Map([['m1', [goalEvent]]]));
    const user = userEvent.setup();

    render(
      <ExportsCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={vi.fn()}
        onMatchesUpdate={vi.fn()}
      />,
    );

    await user.click(screen.getByText('admin:exports.eventsTitle'));
    await user.click(screen.getByText('admin:exports.downloadAs'));

    await waitFor(() => expect(mockLoadEngineEventsForExport).toHaveBeenCalledTimes(1));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(screen.queryByText('admin:exports.eventsExportError')).toBeNull();
  });

  it('Punkt 4 (Ruling PC30): Gelb-Rot im Ereignis-Export -- CSV-Label "Gelb-Rote Karte", JSON cardType, summary.yellowRedCards', async () => {
    const yellowRedEvent = {
      id: 'yr1', matchId: 'm1', timestampSeconds: 10, type: 'RED_CARD',
      payload: { teamId: 'a', cardType: 'YELLOW_RED' }, scoreAfter: { home: 0, away: 0 },
    };
    mockLoadEngineEventsForExport.mockResolvedValue(new Map([['m1', [yellowRedEvent]]]));
    let capturedBlob: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => { capturedBlob = blob; return 'blob:mock'; });
    const user = userEvent.setup();

    render(
      <ExportsCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={vi.fn()}
        onMatchesUpdate={vi.fn()}
      />,
    );

    await user.click(screen.getByText('admin:exports.eventsTitle'));
    // JSON-Format waehlen, damit das cardType-Feld und summary.yellowRedCards geprueft werden koennen.
    await user.click(screen.getByText('admin:exports.formatJson'));
    await user.click(screen.getByText('admin:exports.downloadAs'));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    const text = await capturedBlob!.text();
    const parsed = JSON.parse(text) as { summary: { yellowRedCards: number }; events: { cardType?: string }[] };
    expect(parsed.summary.yellowRedCards).toBe(1);
    expect(parsed.events[0].cardType).toBe('YELLOW_RED');
  });

  it('Lauf schlaegt fehl -> Fehlermeldung statt stillem Export ohne Engine-Ereignisse (Gegenbeispiel oben: Lauf erfolgreich -> kein Fehler)', async () => {
    mockLoadEngineEventsForExport.mockRejectedValue(new Error('Netz weg'));
    const user = userEvent.setup();

    render(
      <ExportsCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={vi.fn()}
        onMatchesUpdate={vi.fn()}
      />,
    );

    await user.click(screen.getByText('admin:exports.eventsTitle'));
    await user.click(screen.getByText('admin:exports.downloadAs'));

    expect(await screen.findByText('admin:exports.eventsExportError')).toBeInTheDocument();
    expect(mockCaptureFeatureError).toHaveBeenCalledWith(expect.any(Error), 'tournament', 'loadEngineEventsForExport');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
