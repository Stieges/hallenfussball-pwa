/**
 * Paket M · Monitor-Seite bei eingefrorener Verbindung (@ZM-085, @ME-030, @ME-007, @ME-047, @ME-031) – ganzer Weg über die echte Quelle:
 * Antwort von `display_tournament` (hier der gefälschte Server) → nur ein Symbol mit Ausrufezeichen unten rechts, ohne Text; die Restzeit
 * läuft unverändert weiter, Bild nie leer; mit der nächsten Antwort verschwindet das Symbol (Entscheidung Daniel 08.11.).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('qrcode.react', () => ({ QRCodeSVG: () => <div data-testid="qr-code" /> }));

const { getForDisplay } = vi.hoisted(() => ({ getForDisplay: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getForDisplay }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: async () => null }; }),
}));
vi.mock('../../../core/realtime/displaySignal', () => ({ subscribeDisplaySignal: () => () => undefined }));

import { MonitorDisplayPage } from '../MonitorDisplayPage';
import { VERBINDUNG_NACH_MS } from '../useMonitorVerbindung';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';
import { looseVs } from '../../../test/matchSlotFixtures';
import type { Match } from '../../../types/tournament';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

/** 14:32 Ortszeit (Europe/Berlin, November) */
const SERVER = Date.UTC(2026, 10, 28, 13, 32, 0);

const spiel7: Match = {
  id: 'm7', matchNumber: 7, round: 1, field: 1, group: 'A', ...looseVs('team-nord', 'team-sued'), scoreA: 1, scoreB: 0, matchStatus: 'running',
  liveState: {
    status: 'running', phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, overtimeSeconds: 0,
    sectionStartMs: 0, elapsedMs: 0, anchorAt: SERVER - 4 * 60_000, breakStartedAt: null, breakSeconds: 120,
  },
};
const turnier = attachMonitor(
  buildTournament({ date: '2026-11-28', matches: [spiel7], groupPhaseGameDuration: 20 }),
  withMonitor({ id: 'mon-1', slides: [slide('live', { fieldId: 'field-1' })] }),
);

async function vor(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe('Paket M: Monitor-Seite bei eingefrorener Verbindung', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Die Uhr des Hallen-Rechners geht 7 Minuten nach (@ME-031)
    vi.setSystemTime(SERVER - 7 * 60_000);
    getForDisplay.mockReset();
    getForDisplay.mockResolvedValueOnce({ kind: 'full', version: 1, serverNowMs: SERVER, tournament: turnier });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('@ZM-085: nach 30 Sekunden ohne Antwort steht unten rechts nur ein Symbol, ohne Text; Spiel und Restzeit laufen unverändert weiter', async () => {
    getForDisplay.mockRejectedValue(new Error('kein Netz'));
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vor(0);
    expect(screen.getByTestId('monitor-clock')).toBeInTheDocument();
    expect(screen.queryByTestId('monitor-connection-hint')).toBeNull();

    await vor(VERBINDUNG_NACH_MS - 1_000);
    expect(screen.queryByTestId('monitor-connection-hint')).toBeNull();

    await vor(1_000);
    const symbol = screen.getByTestId('monitor-connection-hint');
    // kein Text am Monitor; der Name („Keine Verbindung seit 14:32“, Serverzeit in Ortszeit) nur für Vorlese-Programme
    expect(symbol.textContent).toBe('');
    expect(symbol).toHaveAttribute('aria-label', 'Keine Verbindung seit 14:32');
    expect(symbol.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText(/Stand von|keine Verbindung/i)).toBeNull();
    // Der Bildschirm wird nie leer, die Uhr trägt keine Kennzeichnung
    expect(screen.queryByTestId('monitor-waiting-state')).toBeNull();
    expect(screen.getByTestId('clock-label')).toHaveTextContent(/^Restzeit$/);
  });

  it('@ME-007 @ME-030: kommt wieder eine Antwort, verschwindet das Symbol ohne Neuladen', async () => {
    getForDisplay.mockRejectedValue(new Error('kein Netz'));
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vor(VERBINDUNG_NACH_MS);
    expect(screen.getByTestId('monitor-connection-hint')).toBeInTheDocument();

    getForDisplay.mockResolvedValue({ kind: 'unchanged', version: 1, serverNowMs: SERVER + 40_000 });
    await vor(2_000);
    expect(screen.queryByTestId('monitor-connection-hint')).toBeNull();
  });

  it('Gegenbeispiel: antwortet der Server regelmäßig mit „unverändert“, bleibt das Symbol aus', async () => {
    getForDisplay.mockResolvedValue({ kind: 'unchanged', version: 1, serverNowMs: SERVER });
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vor(VERBINDUNG_NACH_MS * 2);
    expect(screen.queryByTestId('monitor-connection-hint')).toBeNull();
  });

  it('@ZM-085: die Restzeit zählt ohne Antwort weiter, aber nie unter 0:00', async () => {
    getForDisplay.mockRejectedValue(new Error('kein Netz'));
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vor(7 * 60_000);
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('0:00');
    expect(screen.getByTestId('monitor-connection-hint')).toBeInTheDocument();
  });

  it('@ME-031: die Uhr des Rechners geht 7 Minuten nach – nach dem Netzausfall zählt die Restzeit ruhig weiter, ohne um die 7 Minuten zu springen', async () => {
    getForDisplay.mockRejectedValue(new Error('kein Netz'));
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" />);
    await vor(0);
    expect(['6:00', '5:59']).toContain(screen.getByTestId('monitor-clock').textContent);
    await vor(40_000);
    // 6:00 − 40 s = 5:20; ein Sprung um die Abweichung der Rechneruhr gäbe 12:20 bzw. −1:40
    expect(['5:20', '5:19']).toContain(screen.getByTestId('monitor-clock').textContent);
    expect(screen.getByTestId('monitor-connection-hint')).toBeInTheDocument();
  });
});
