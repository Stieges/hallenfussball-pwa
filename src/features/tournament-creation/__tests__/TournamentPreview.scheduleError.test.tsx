import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';

const generateFullScheduleMock = vi.fn();

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: (t: Tournament) => generateFullScheduleMock(t),
}));

vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: () => <div data-testid="schedule-display-stub" />,
}));

vi.mock('../../../components/RefereeAssignmentEditor', () => ({
  RefereeAssignmentEditor: ({
    onResetAssignments,
  }: {
    onResetAssignments: () => void;
  }) => (
    <button data-testid="reset-referees-stub" onClick={onResetAssignments}>
      reset
    </button>
  ),
}));

vi.mock('../../../lib/pdfExporter', () => ({
  exportScheduleToPDF: vi.fn(),
}));

import { TournamentPreview } from '../TournamentPreview';

const tournament: Tournament = {
  id: 't1',
  title: 'Test Cup',
  ageClass: 'U13',
  sport: 'football',
  tournamentType: 'classic',
  mode: 'roundRobin',
  groupSystem: 'roundRobin',
  date: '2030-01-01',
  timeSlot: '09:00',
  startDate: '2030-01-01',
  startTime: '09:00',
  numberOfTeams: 4,
  numberOfFields: 1,
  numberOfGroups: 1,
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
  finalRoundGameDuration: 10,
  finalRoundBreakDuration: 2,
  breakBetweenPhases: 0,
  teams: [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
    { id: '4', name: 'D' },
  ],
  matches: [],
  status: 'draft',
  refereeConfig: {
    mode: 'fixedPerField',
    refereeNames: {},
    manualAssignments: {},
  },
  location: { name: 'Halle' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
} as unknown as Tournament;

const initialSchedule: GeneratedSchedule = {
  allMatches: [],
  initialStandings: [],
  tournament,
} as unknown as GeneratedSchedule;

describe('TournamentPreview — F-211 schedule generation error handling', () => {
  beforeEach(() => {
    generateFullScheduleMock.mockReset();
  });

  it('shows an error banner instead of crashing when regeneration throws', () => {
    generateFullScheduleMock.mockImplementation(() => {
      throw new Error('Konflikt: keine freien Slots für Finale');
    });

    render(
      <TournamentPreview
        tournament={tournament}
        schedule={initialSchedule}
        onEdit={() => undefined}
        onPublish={() => undefined}
      />
    );

    fireEvent.click(screen.getByTestId('reset-referees-stub'));

    const banner = screen.getByTestId('schedule-error-banner');
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText(/Konflikt: keine freien Slots/)).toBeInTheDocument();
  });

  it('clears the banner when the user dismisses it', () => {
    generateFullScheduleMock.mockImplementation(() => {
      throw new Error('boom');
    });

    render(
      <TournamentPreview
        tournament={tournament}
        schedule={initialSchedule}
        onEdit={() => undefined}
        onPublish={() => undefined}
      />
    );

    fireEvent.click(screen.getByTestId('reset-referees-stub'));
    expect(screen.getByTestId('schedule-error-banner')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Schließen'));
    expect(screen.queryByTestId('schedule-error-banner')).not.toBeInTheDocument();
  });

  it('keeps the previous schedule visible after a failed regeneration', () => {
    generateFullScheduleMock.mockImplementation(() => {
      throw new Error('fail');
    });

    render(
      <TournamentPreview
        tournament={tournament}
        schedule={initialSchedule}
        onEdit={() => undefined}
        onPublish={() => undefined}
      />
    );

    expect(screen.getByTestId('schedule-display-stub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reset-referees-stub'));
    // Schedule stub remains rendered — the failed regen did not replace state with garbage
    expect(screen.getByTestId('schedule-display-stub')).toBeInTheDocument();
  });
});
