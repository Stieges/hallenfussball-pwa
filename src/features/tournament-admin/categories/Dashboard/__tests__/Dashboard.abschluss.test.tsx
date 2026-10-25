/**
 * R3-4 Die Verwaltung (Dashboard der Turnier-Verwaltung) trägt den Bereich „Turnier abschließen“ bzw. Zustand C. Der Bereich selbst
 * hat eigene Tests (`tournament-finish/__tests__`); hier nur: er ist eingebunden und bekommt das Neuladen der Ansicht (@LZ-009).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
const section = vi.hoisted<{ props: unknown }>(() => ({ props: undefined }));
vi.mock('../../../../tournament-finish/components/FinishTournamentSection', () => ({
  FinishTournamentSection: (props: unknown) => { section.props = props; return <div data-testid="finish-section-stub" />; },
}));

import { DashboardCategory } from '../index';

const turnier = {
  id: 't1', title: 'Nikolaus-Turnier', status: 'published', lifecycleStatus: 'fixed', teams: [], matches: [], numberOfTeams: 4, numberOfGroups: 1,
  numberOfFields: 1, groupSystem: 'roundRobin', location: { name: 'Halle' },
} as unknown as Tournament;

describe('@LZ-009 Verwaltung: Bereich „Turnier abschließen“', () => {
  it('mit Neuladen (aus der Verwaltung) ist der Bereich da und bekommt es', () => {
    const onReload = vi.fn();
    render(<DashboardCategory tournamentId="t1" tournament={turnier} onTournamentUpdate={vi.fn()} onReload={onReload} />);
    expect(screen.getByTestId('finish-section-stub')).toBeInTheDocument();
    expect((section.props as { onReload: unknown }).onReload).toBe(onReload);
  });

  it('Gegenbeispiel: ohne Neuladen (kein Verwaltungsrahmen) kein Bereich', () => {
    render(<DashboardCategory tournamentId="t1" tournament={turnier} onTournamentUpdate={vi.fn()} />);
    expect(screen.queryByTestId('finish-section-stub')).toBeNull();
  });
});
