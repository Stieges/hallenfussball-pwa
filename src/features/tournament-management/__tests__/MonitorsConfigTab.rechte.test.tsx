/**
 * A-11 @ZM-019 „das Folienprogramm des Hallenmonitor Feld 1 ändern“: Maria (Co-Admin) und Olli bekommen es angeboten,
 * Tom (Helfer an Feld 1) nicht (manageScreens). Anzeigen und Adresse kopieren bleiben für alle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';

vi.unmock('i18next');
vi.unmock('react-i18next');

const role = vi.hoisted(() => ({ current: 'collaborator' }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));
vi.mock('../../../hooks/useMonitorHeartbeats', () => ({ useMonitorHeartbeats: () => new Map() }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { MonitorsConfigTab } from '../MonitorsConfigTab';

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

beforeEach(() => vi.clearAllMocks());

describe('@ZM-019 Folienprogramm des Hallenmonitor Feld 1', () => {
  it('@ZM-019 Tom (Helfer an Feld 1): Folienprogramm ändern ist nicht angeboten', () => {
    role.current = 'collaborator';
    render(<MonitorsConfigTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    for (const button of changeButtons()) {
      expect(button).not.toBeInTheDocument();
    }
    expect(screen.getByText('Hallenmonitor Feld 1')).toBeInTheDocument();
  });

  it.each(['co-admin', 'owner'])('Gegenbeispiel %s (Maria/Olli): Folienprogramm ändern ist angeboten', (r) => {
    role.current = r;
    render(<MonitorsConfigTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    for (const button of changeButtons()) {
      expect(button).toBeInTheDocument();
    }
  });
});
