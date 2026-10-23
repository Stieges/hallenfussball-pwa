/**
 * ExportsCategory -- @SL-022: „Eigentor SV Süd, Nr. 4, 5:40“.
 *
 * Gegeben Spiel m1 steht bei 5:40, Stand 1:0 · Wenn SV Süd (Team B) ein Eigentor mit der Nummer 4 erzielt
 * · Dann steht das Spiel bei 2:0 für FC Nord (Team A) · Und die Ereignisliste zeigt „Eigentor SV Süd, Nr. 4“
 * (Art „Eigentor“, Team = schießendes Team, Rückennummer 4) · Und ein normales Tor bleibt „Tor“ beim eigenen Team.
 *
 * Die Engine liefert das Eigentor als GOAL des begünstigten Teams mit `ownGoal` und `ownGoalTeamId`
 * (viewAdapters.ts). Der CSV-Export wertete das bisher nicht aus und zeigte „Tor“ für Team A.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// A-11: die Komponente fragt Rechte über useCan -- hier die Turnierleitung (alles erlaubt).
vi.mock('../../../../auth/hooks/useCan', () => ({ useCan: () => true }));
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../../../types/tournament';
import { ExportsCategory } from '../index';
import { looseVs } from '../../../../../test/matchSlotFixtures';

const mockLoadEngineEventsForExport = vi.hoisted(() => vi.fn());
vi.mock('../../../../../features/match-engine/loadEngineEventsForExport', () => ({
  loadEngineEventsForExport: mockLoadEngineEventsForExport,
}));

const mockExportStatisticsToPDF = vi.hoisted(() => vi.fn());
vi.mock('../../../../../lib/pdfStatisticsExporter', () => ({
  exportStatisticsToPDF: mockExportStatisticsToPDF,
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
    { id: 'm1', round: 1, field: 1, ...looseVs('a', 'b'), matchStatus: 'not_started' },
  ],
} as unknown as Tournament;

/** Ein normales Tor von Team A, Nr. 7, bei Minute 1:40 (Stand 1:0). */
const normalesTor = {
  id: 'g1', matchId: 'm1', timestampSeconds: 100, type: 'GOAL',
  payload: { teamId: 'a', playerNumber: 7 }, scoreAfter: { home: 1, away: 0 },
};

/** Eigentor von Team B (SV Süd), Nr. 4, bei 5:40 -- begünstigt Team A (FC Nord), Stand danach 2:0. */
const eigentor = {
  id: 'og1', matchId: 'm1', timestampSeconds: 340, type: 'GOAL',
  payload: { teamId: 'a', ownGoal: true, ownGoalTeamId: 'b', playerNumber: 4 },
  scoreAfter: { home: 2, away: 0 },
};

async function exportCsvRows(events: unknown[]): Promise<string[]> {
  mockLoadEngineEventsForExport.mockResolvedValue(new Map([['m1', events]]));
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
  await user.click(screen.getByText('admin:exports.downloadAs'));

  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  return (await capturedBlob!.text()).split('\n');
}

describe('ExportsCategory -- @SL-022 Eigentor in der Ereignisliste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.current = { engine: {} };
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('@SL-022 Eigentor von SV Süd (B) bei 5:40: Art „Eigentor“, Team „B“, Nr. #4, Stand 2:0 (nicht „Tor“ für Team A)', async () => {
    const rows = await exportCsvRows([eigentor]);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toBe('"m1";"1";"A";"B";"6\'";"Eigentor";"B";"#4";"Stand: 2:0"');
  });

  it('@SL-022 Gegenbeispiel: ein normales Tor zählt weiter als „Tor“ beim eigenen Team, neben einem Eigentor', async () => {
    const rows = await exportCsvRows([normalesTor, eigentor]);

    expect(rows).toHaveLength(3);
    expect(rows[1]).toBe('"m1";"1";"A";"B";"2\'";"Tor";"A";"#7";"Stand: 1:0"');
    expect(rows[2]).toBe('"m1";"1";"A";"B";"6\'";"Eigentor";"B";"#4";"Stand: 2:0"');
  });
});
