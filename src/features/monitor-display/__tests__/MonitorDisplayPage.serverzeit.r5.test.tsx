/**
 * R5 PR 2 – die Monitor-Seite rechnet die Uhr in Serverzeit (@ZM-176, @ME-031, Befund C-MONITOR-UHR-RECHNER).
 * Ganzer Weg: Antwort von `display_tournament` mit `server_now` → Abstand → Ansicht und Uhr der Live-Folie.
 * Nur `Date` ist gefälscht, damit die Abfrage der Seite normal läuft.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('qrcode.react', () => ({ QRCodeSVG: () => <div data-testid="qr-code" /> }));

const { getForDisplay } = vi.hoisted(() => ({ getForDisplay: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getForDisplay }; }),
}));
vi.mock('../../../core/realtime/displaySignal', () => ({ subscribeDisplaySignal: () => () => undefined }));

import { MonitorDisplayPage } from '../MonitorDisplayPage';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';
import { looseVs } from '../../../test/matchSlotFixtures';
import type { Match } from '../../../types/tournament';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const SERVER = Date.UTC(2026, 10, 28, 14, 0, 0);

/** Spiel 7 läuft seit 4:00 (Serverzeit), Halbzeit 10 Minuten. */
const spiel7: Match = {
  id: 'm7', matchNumber: 7, round: 1, field: 1, group: 'A', ...looseVs('team-nord', 'team-sued'), scoreA: 1, scoreB: 0,
  matchStatus: 'running',
  liveState: {
    status: 'running', phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, overtimeSeconds: 0,
    sectionStartMs: 0, elapsedMs: 0, anchorAt: SERVER - 4 * 60_000, breakStartedAt: null, breakSeconds: 120,
  },
};

const turnier = attachMonitor(
  buildTournament({ date: '2026-11-28', matches: [spiel7], groupPhaseGameDuration: 20 }),
  withMonitor({ id: 'mon-1', slides: [slide('live', { fieldId: 'field-1' })] }),
);

afterEach(() => { vi.useRealTimers(); });

describe('@ME-031 @ZM-176 Monitor-Seite: Restzeit in Serverzeit', () => {
  it('die Uhr des Hallen-Rechners geht 7 Minuten nach: die Live-Folie zeigt 06:00, nicht 10:00', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(SERVER - 7 * 60_000);
    getForDisplay.mockResolvedValue({ kind: 'full', version: 1, serverNowMs: SERVER, tournament: turnier });
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('monitor-clock')).toBeInTheDocument());
    // Laufzeit der Antwort im Test ≈ 0 ms: Abweichung höchstens 1 s
    expect(['06:00', '05:59']).toContain(screen.getByTestId('monitor-clock').textContent);
    expect(screen.getByTestId('clock-label')).toHaveTextContent('Restzeit');
  });
});
