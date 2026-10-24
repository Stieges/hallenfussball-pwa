/**
 * @W5-036 — Der Erklärtext im Block „Nicht änderbare Einstellungen“ ist in jedem Zustand wahr:
 * vor dem Anpfiff mit Recht „über Erweiterte Bearbeitung“ (und der Weg ist da), ohne Recht neutral (kein Weg),
 * nach dem Anpfiff „seit dem ersten Anpfiff fest“, bei unbekanntem Zustand neutral.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { MatchStartState } from '../../../utils/matchStartState';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const startState = vi.hoisted((): { value: MatchStartState; restructure: boolean } => ({ value: 'not-started', restructure: true }));
vi.mock('../../../hooks/useTournamentStartState', () => ({ useTournamentStartState: () => ({ state: startState.value }) }));
vi.mock('../../auth/hooks/useCan', () => ({ useCan: (action: string) => (action === 'restructure' ? startState.restructure : true) }));
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../auth/hooks/useTournamentMembers', () => ({ useTournamentMembers: () => ({ myMembership: null, isLoading: false }) }));
vi.mock('../../../hooks/useTournaments', () => ({ useTournaments: () => ({ tournaments: [], loading: false, saveTournament: vi.fn() }) }));

import { SettingsTab } from '../SettingsTab';

const turnier = {
  id: 't1', title: 'Nikolaus-Turnier', status: 'published',
  teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  matches: [{ id: 'm1', field: 1, matchStatus: 'scheduled' }],
  numberOfTeams: 2, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'roundRobin', mode: 'classic', tournamentType: 'classic',
  startDate: '2026-12-06', startTime: '10:00', ageClass: 'U11', location: { name: 'Halle', city: 'Ort' }, placementLogic: [],
} as unknown as Tournament;

function open(state: MatchStartState, restructure: boolean) {
  startState.value = state; startState.restructure = restructure;
  render(<SettingsTab tournament={turnier} onTournamentUpdate={vi.fn()} onEditInWizard={vi.fn()} />);
  fireEvent.click(screen.getByRole('heading', { level: 2 }));
}
const editButton = () => screen.queryByRole('button', { name: /Teams bearbeiten/ });

beforeEach(() => vi.clearAllMocks());

describe('@W5-036 Erklärtext je Zustand', () => {
  it('vor dem Anpfiff mit Recht: „über Erweiterte Bearbeitung“, und der Weg ist da', () => {
    open('not-started', true);
    expect(screen.getByText(/änderst du sie über „Erweiterte Bearbeitung“/)).toBeInTheDocument();
    expect(editButton()).toBeInTheDocument();
  });
  it('vor dem Anpfiff ohne Recht: neutral, kein Weg angekündigt', () => {
    open('not-started', false);
    expect(screen.getByText(/lassen sich hier nicht ändern/)).toBeInTheDocument();
    expect(screen.queryByText(/Erweiterte Bearbeitung“:/)).not.toBeInTheDocument();
    expect(editButton()).not.toBeInTheDocument();
  });
  it('nach dem Anpfiff: „seit dem ersten Anpfiff fest“', () => {
    open('started', true);
    expect(screen.getByText(/seit dem ersten Anpfiff fest/)).toBeInTheDocument();
  });
  it('unbekannter Zustand (offline, lädt): neutral, behauptet keinen Anpfiff', () => {
    open('unknown', true);
    expect(screen.getByText(/lassen sich hier nicht ändern/)).toBeInTheDocument();
    expect(screen.queryByText(/seit dem ersten Anpfiff/)).not.toBeInTheDocument();
  });
});
