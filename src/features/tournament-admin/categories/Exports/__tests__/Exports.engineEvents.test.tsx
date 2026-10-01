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
      payload: { teamId: 'a', direction: 'INC', playerNumber: 7 }, scoreAfter: { home: 1, away: 0 },
    };
    mockLoadEngineEventsForExport.mockResolvedValue(new Map([['m1', [goalEvent]]]));
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

    await waitFor(() => expect(mockLoadEngineEventsForExport).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(screen.queryByText('admin:exports.eventsExportError')).toBeNull();
    // Aufgabe 4: der Blob-INHALT enthaelt das Engine-Tor (Torschuetze, Team, Minute, Stand) -- eine
    // CSV nur mit Kopfzeile wuerde hier rot werden.
    const text = await capturedBlob!.text();
    const rows = text.split('\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toBe('"m1";"1";"A";"B";"1\'";"Tor";"A";"#7";"Stand: 1:0"');
  });

  it('Aufgabe 4 Gegenbeispiel: ein Lauf OHNE Ereignisse liefert eine CSV nur mit Kopfzeile', async () => {
    mockLoadEngineEventsForExport.mockResolvedValue(new Map());
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
    const rows = (await capturedBlob!.text()).split('\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Match ID');
  });

  it('Fehlender Engine-Kontext: Fehler entsteht INNERHALB des Laufs -> Fehlermeldung + captureFeatureError, kein Export', async () => {
    mockContext.current = null;
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
    expect(mockLoadEngineEventsForExport).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
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
  it('Punkt 4: CSV-Label "Gelb-Rote Karte" fuer Gelb-Rot (Gegenbeispiel: RED_CARD ohne cardType = "Rote Karte")', async () => {
    const yellowRed = {
      id: 'yr1', matchId: 'm1', timestampSeconds: 10, type: 'RED_CARD',
      payload: { teamId: 'a', cardType: 'YELLOW_RED' }, scoreAfter: { home: 0, away: 0 },
    };
    const red = {
      id: 'r1', matchId: 'm1', timestampSeconds: 20, type: 'RED_CARD',
      payload: { teamId: 'b' }, scoreAfter: { home: 0, away: 0 },
    };
    mockLoadEngineEventsForExport.mockResolvedValue(new Map([['m1', [yellowRed, red]]]));
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
    const text = await capturedBlob!.text();
    const rows = text.split('\n');
    expect(rows.some((row) => row.includes('Gelb-Rote Karte'))).toBe(true);
    expect(rows.filter((row) => row.includes(';"Rote Karte";'))).toHaveLength(1);
    expect(rows.filter((row) => row.includes(';"Gelb-Rote Karte";'))).toHaveLength(1);
  });

  it('Knopf-Sperre: waehrend der Lauf laeuft, ist der Export-Knopf gesperrt (kein Doppelklick-Lauf)', async () => {
    let finishRun: (value: Map<string, never[]>) => void = () => undefined;
    mockLoadEngineEventsForExport.mockReturnValue(new Promise<Map<string, never[]>>((resolve) => { finishRun = resolve; }));
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

    // Jeder Knopf mit isExporting zeigt "exporting"/ist gesperrt -- der Ereignis-Export-Knopf auch.
    const busyButtons = await screen.findAllByText('admin:exports.exporting');
    for (const busy of busyButtons) {
      expect(busy.closest('button')).toBeDisabled();
    }
    await user.click(busyButtons[0]);
    expect(mockLoadEngineEventsForExport).toHaveBeenCalledTimes(1);

    finishRun(new Map());
    await waitFor(() => expect(screen.queryByText('admin:exports.exporting')).toBeNull());
  });

  it('Statistik-PDF: Lauf erfolgreich -> exportStatisticsToPDF erhaelt die Karte des Laufs', async () => {
    const goalEvent = {
      id: 'g1', matchId: 'm1', timestampSeconds: 10, type: 'GOAL',
      payload: { teamId: 'a', direction: 'INC' }, scoreAfter: { home: 1, away: 0 },
    };
    const run = new Map([['m1', [goalEvent]]]);
    mockLoadEngineEventsForExport.mockResolvedValue(run);
    mockExportStatisticsToPDF.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ExportsCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={vi.fn()}
        onMatchesUpdate={vi.fn()}
      />,
    );

    await user.click(screen.getByText('admin:exports.statisticsTitle'));
    await user.click(screen.getByText('admin:exports.exportPdf'));

    await waitFor(() => expect(mockExportStatisticsToPDF).toHaveBeenCalledTimes(1));
    expect(mockExportStatisticsToPDF).toHaveBeenCalledWith(tournament, run);
    expect(mockLoadEngineEventsForExport).toHaveBeenCalledTimes(1);
  });

  it('Statistik-PDF: Lauf schlaegt fehl -> Fehlermeldung, KEIN PDF ohne Engine-Ereignisse', async () => {
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

    await user.click(screen.getByText('admin:exports.statisticsTitle'));
    await user.click(screen.getByText('admin:exports.exportPdf'));

    expect(await screen.findByText('admin:exports.statisticsExportError')).toBeInTheDocument();
    expect(mockCaptureFeatureError).toHaveBeenCalledWith(expect.any(Error), 'tournament', 'loadEngineEventsForExport');
    expect(mockExportStatisticsToPDF).not.toHaveBeenCalled();
  });
  it('Aufgabe 10: Statistik-PDF-Knopf ist waehrend des Laufs gesperrt (Label "creating", kein zweiter Lauf)', async () => {
    let finishRun: (value: Map<string, never[]>) => void = () => undefined;
    mockLoadEngineEventsForExport.mockReturnValue(new Promise<Map<string, never[]>>((resolve) => { finishRun = resolve; }));
    mockExportStatisticsToPDF.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ExportsCategory
        tournamentId="t1"
        tournament={tournament}
        onTournamentUpdate={vi.fn()}
        onMatchesUpdate={vi.fn()}
      />,
    );

    await user.click(screen.getByText('admin:exports.statisticsTitle'));
    await user.click(screen.getByText('admin:exports.exportPdf'));

    const creating = await screen.findByText('admin:exports.creating');
    expect(creating.closest('button')).toBeDisabled();
    await user.click(creating);
    expect(mockLoadEngineEventsForExport).toHaveBeenCalledTimes(1);

    finishRun(new Map());
    await waitFor(() => expect(screen.queryByText('admin:exports.creating')).toBeNull());
    // Gegenbeispiel: nach dem Lauf ist der Knopf wieder bedienbar.
    expect(screen.getByText('admin:exports.exportPdf').closest('button')).toBeEnabled();
  });
});
