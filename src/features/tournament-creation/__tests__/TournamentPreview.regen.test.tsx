/**
 * B-02 Paket A – Pflicht-Mutationsziel: Die Neuplanung/Regeneration in
 * TournamentPreview muss sichtbar wirken. Vor dieser Lücke blieben bei einer
 * kaputten Neuplanung in TournamentPreview 48 Tests grün.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';

const generateFullScheduleMock = vi.fn();

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: (t: Tournament) => generateFullScheduleMock(t),
}));

vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: ({
    schedule,
    onFieldChange,
  }: {
    schedule: GeneratedSchedule;
    onFieldChange: (matchId: string, fieldNumber: number) => void;
  }) => (
    <div>
      <span data-testid="schedule-marker">
        {(schedule.allMatches[0]?.id) ?? 'leer'}
      </span>
      <button
        data-testid="change-field-stub"
        onClick={() => onFieldChange('m1', 2)}
      >
        feld
      </button>
    </div>
  ),
}));

vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

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
  location: { name: 'Halle' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
} as unknown as Tournament;

const scheduleWith = (id: string): GeneratedSchedule =>
  ({
    allMatches: [
      {
        id,
        field: 1,
        slot: 0,
        startTime: new Date('2030-01-01T09:00:00Z'),
        endTime: new Date('2030-01-01T09:10:00Z'),
        originalTeamA: '1',
        originalTeamB: '2',
        phase: 'groupStage',
      },
    ],
    initialStandings: [],
    tournament,
    endTime: new Date('2030-01-01T09:10:00Z'),
    numberOfFields: 1,
  }) as unknown as GeneratedSchedule;

describe('TournamentPreview – Regeneration des Spielplans (F-211)', () => {
  beforeEach(() => {
    generateFullScheduleMock.mockReset();
  });

  it('zeigt den neu generierten Plan nach einer Änderung', () => {
    generateFullScheduleMock.mockReturnValue(scheduleWith('neu-1'));
    render(
      <TournamentPreview
        tournament={tournament}
        schedule={scheduleWith('alt-1')}
        onEdit={() => undefined}
        onPublish={() => undefined}
      />
    );

    expect(screen.getByTestId('schedule-marker')).toHaveTextContent('alt-1');
    fireEvent.click(screen.getByTestId('change-field-stub'));
    expect(screen.getByTestId('schedule-marker')).toHaveTextContent('neu-1');
  });
});
