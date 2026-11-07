/**
 * @OB-081 Ein heute abgeschlossenes Turnier steht bis zum Ende des Tages nur unter „Heute“ (Reiter Turniere), ab dem Folgetag nur im Archiv.
 * Darstellung im Reiter Archiv; die Aufteilung unter „Heute“ prüft DashboardTurniereTab.ob078.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../../../hooks/useTournamentStartState', () => ({ useTournamentStartState: () => ({ state: 'not-started' }) }));

import { DashboardArchivTab } from '../DashboardArchivTab';

const abgeschlossen = (id: string, startDate: string): Tournament => ({
  id, title: id, startDate, startTime: '08:30', teams: [], placementLogic: [], location: { name: 'Halle' },
  status: 'published', lifecycleStatus: 'finished', matches: [{ id: 'm1', matchStatus: 'finished' }],
} as unknown as Tournament);
const geraet = [abgeschlossen('F2', '2026-11-28'), abgeschlossen('Sommercup', '2026-07-11')];
const tab = () => <DashboardArchivTab activeTournaments={geraet} onTournamentClick={vi.fn()} />;

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterEach(() => vi.useRealTimers());

describe('@OB-081 Archiv und „Heute“ doppeln nichts', () => {
  it('Samstag 12:40: F2 steht noch nicht im Archiv, ein älteres Turnier schon', () => {
    vi.setSystemTime(new Date(2026, 10, 28, 12, 40));
    render(tab());
    expect(screen.queryByTestId('tournament-card-F2')).toBeNull();
    expect(screen.getByTestId('tournament-card-Sommercup')).toBeInTheDocument();
  });

  it('Sonntag: F2 steht nur noch im Archiv, mit „Abgeschlossen“', () => {
    vi.setSystemTime(new Date(2026, 10, 29, 8, 0));
    render(tab());
    expect(screen.getByTestId('tournament-card-F2')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-card-F2')).toHaveTextContent('dashboard:status.finished');
  });
});
