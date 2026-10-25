/**
 * R3-3 Monitor-Folien und Monitor-Editor (`MonitorsConfigTab`, `MonitorEditor`, `useMonitors`) nach dem Abschluss.
 * Der Editor selbst öffnet im Verwaltungsbildschirm nicht mehr (`editingMonitorId && !closed`, siehe Abschluss.sperre.verwaltung).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));
vi.mock('../../../hooks/useMonitorHeartbeats', () => ({ useMonitorHeartbeats: () => new Map() }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { MonitorsConfigTab } from '../MonitorsConfigTab';
import { setTournamentClosed, resetClosedTournaments } from '../../../core/services/closedTournaments';

await initRealDeI18n();

const feld1: TournamentMonitor = {
  id: 'feld-1', name: 'Hallenmonitor Feld 1', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
  theme: 'dark', performanceMode: 'auto', slides: [], createdAt: '2026-11-14T08:00:00Z', updatedAt: '2026-11-14T08:00:00Z',
};
const tournament = { id: 'hallencup-nord', title: 'Hallencup Nord', teams: [], matches: [], monitors: [feld1] } as unknown as Tournament;

const changeButtons = () => [
  screen.queryByRole('button', { name: /Neuer Monitor/ }),
  screen.queryByRole('button', { name: 'Monitor "Hallenmonitor Feld 1" bearbeiten' }),
  screen.queryByRole('button', { name: /Hallenmonitor Feld 1.*duplizieren/ }),
  screen.queryByRole('button', { name: /Hallenmonitor Feld 1.*löschen/ }),
];

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); });
afterEach(() => { resetClosedTournaments(); });

describe('@LZ-037 Z. 4 „eine Monitor-Folie ändern -> erst nach dem Wiederöffnen“ (reine App-Pflicht, der Server sperrt monitors nicht)', () => {
  it('abgeschlossen: Neuer Monitor, bearbeiten, duplizieren, löschen sind nicht angeboten; Anzeigen bleibt', () => {
    setTournamentClosed('hallencup-nord', true);
    render(<MonitorsConfigTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    for (const button of changeButtons()) {
      expect(button).not.toBeInTheDocument();
    }
    expect(screen.getByText('Hallenmonitor Feld 1')).toBeInTheDocument();
  });

  it('Gegenbeispiel: offen – Olli bekommt das Folienprogramm angeboten', () => {
    render(<MonitorsConfigTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    for (const button of changeButtons()) {
      expect(button).toBeInTheDocument();
    }
  });
});
