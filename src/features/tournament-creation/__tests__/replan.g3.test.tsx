import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Match, Team } from '../../../types/tournament';
import type { ReplanPreviewResult } from '../utils/replan';
import { ReplanPanel } from '../components/ReplanPanel';
import { looseVs } from '../../../test/matchSlotFixtures';

vi.mock('../../../components/dialogs/Dialog', () => ({
  Dialog: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

const teams: Team[] = [
  { id: '1', name: 'Eins' },
  { id: '2', name: 'Zwei' },
  { id: '3', name: 'Drei' },
  { id: '4', name: 'Vier' },
];

const gen = (id: string, teamA: string, teamB: string) => ({
  id,
  field: 1,
  slot: 0,
  startTime: new Date('2030-01-01T09:00:00Z'),
  endTime: new Date('2030-01-01T09:42:00Z'),
  originalTeamA: teamA,
  originalTeamB: teamB,
  ...looseVs(teamA, teamB),
  phase: 'groupStage',
});

describe('G3 + E3 – Paarung je Hinweis, Zählung nach Paarung und Phase', () => {
  it('zählt neu/entfallen nach Paarung und Phase, nicht nach ID', () => {
    const previousMatches: Match[] = [
      { id: 'alt-1', round: 1, field: 1, ...looseVs('1', '2'), phase: 'groupStage' },
      { id: 'alt-2', round: 1, field: 2, ...looseVs('3', '4'), phase: 'groupStage' },
    ];
    const preview: Extract<ReplanPreviewResult, { status: 'preview' }> = {
      status: 'preview',
      schedule: {
        allMatches: [gen('neu-1', '1', '2'), gen('neu-2', '3', '5')],
        initialStandings: [],
        tournament: {} as never,
        endTime: new Date('2030-01-01T09:42:00Z'),
        numberOfFields: 2,
      } as unknown as Extract<ReplanPreviewResult, { status: 'preview' }>['schedule'],
      endTime: new Date('2030-01-01T09:42:00Z'),
      keptMatches: [],
      keptNotices: [],
      conflictMatchIds: [],
    };

    render(
      <ReplanPanel
        isOpen
        preview={preview}
        previousMatches={previousMatches}
        teams={teams}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const counts = screen.getByTestId('replan-counts');
    expect(counts).toHaveAttribute('data-new-count', '1');
    expect(counts).toHaveAttribute('data-dropped-count', '1');
  });

  it('zeigt die Paarung je Hinweis über matchSides', () => {
    const kept: Match = {
      id: 'k1',
      round: 1,
      field: 1,
      ...looseVs('1', '2'),
      phase: 'groupStage',
      scoreA: 2,
      scoreB: 1,
      matchStatus: 'finished',
    };
    const preview: Extract<ReplanPreviewResult, { status: 'preview' }> = {
      status: 'preview',
      schedule: {
        allMatches: [gen('neu-1', '1', '2')],
        initialStandings: [],
        tournament: {} as never,
        endTime: new Date('2030-01-01T09:42:00Z'),
        numberOfFields: 1,
      } as unknown as Extract<ReplanPreviewResult, { status: 'preview' }>['schedule'],
      endTime: new Date('2030-01-01T09:42:00Z'),
      keptMatches: [kept],
      keptNotices: [{ matchId: 'k1', willBeRemoved: false }],
      conflictMatchIds: ['k1'],
    };

    render(
      <ReplanPanel
        isOpen
        preview={preview}
        previousMatches={[kept]}
        teams={teams}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const notices = screen.getByTestId('replan-kept-notices');
    expect(notices).toHaveTextContent('Eins');
    expect(notices).toHaveTextContent('Zwei');
    const conflicts = screen.getByTestId('replan-conflicts');
    expect(conflicts).toHaveTextContent('Eins');
    expect(conflicts).toHaveTextContent('Zwei');
  });
});
