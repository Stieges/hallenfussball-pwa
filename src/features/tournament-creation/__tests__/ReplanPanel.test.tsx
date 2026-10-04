import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Match } from '../../../types/tournament';
import type { ReplanPreviewResult } from '../utils/replan';
import { ReplanPanel } from '../components/ReplanPanel';

vi.mock('../../../components/dialogs/Dialog', () => ({
  Dialog: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

const previousMatches: Match[] = [
  { id: 'm1', round: 1, field: 1, teamA: '1', teamB: '2' },
  { id: 'm2', round: 1, field: 2, teamA: '3', teamB: '4' },
];

const previewResult: Extract<ReplanPreviewResult, { status: 'preview' }> = {
  status: 'preview',
  schedule: {
    allMatches: [
      {
        id: 'm1',
        field: 1,
        slot: 0,
        startTime: new Date('2030-01-01T09:00:00Z'),
        endTime: new Date('2030-01-01T09:42:00Z'),
        originalTeamA: '1',
        originalTeamB: '2',
        phase: 'groupStage',
      },
      {
        id: 'm3',
        field: 2,
        slot: 0,
        startTime: new Date('2030-01-01T09:00:00Z'),
        endTime: new Date('2030-01-01T09:42:00Z'),
        originalTeamA: '3',
        originalTeamB: '5',
        phase: 'groupStage',
      },
    ],
    initialStandings: [],
    tournament: {} as never,
    endTime: new Date('2030-01-01T09:42:00Z'),
    numberOfFields: 2,
  } as unknown as Extract<ReplanPreviewResult, { status: 'preview' }>['schedule'],
  endTime: new Date('2030-01-01T09:42:00Z'),
  keptMatches: [{ ...previousMatches[0], scoreA: 2, scoreB: 1, matchStatus: 'finished' }],
  keptNotices: [{ matchId: 'm1', willBeRemoved: false }],
  conflictMatchIds: ['m1'],
};

describe('ReplanPanel – Neuplanungs-Vorschau (@W5-005/007/008)', () => {
  it('@W5-005 – zeigt Endzeit, Zahl neuer und entfallender Spiele, Hinweise', () => {
    render(
      <ReplanPanel
        isOpen
        preview={previewResult}
        previousMatches={previousMatches}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('replan-end-time')).toBeInTheDocument();
    expect(screen.getByTestId('replan-counts')).toHaveTextContent('replan.newMatches');
    expect(screen.getByTestId('replan-counts')).toHaveTextContent('replan.removedMatches');
    expect(screen.getByTestId('replan-kept-notices')).toBeInTheDocument();
    expect(screen.getByTestId('replan-conflicts')).toBeInTheDocument();
    expect(screen.getByTestId('replan-confirm')).toBeEnabled();
  });

  it('@W5-008 – bei unmöglicher Neuplanung: Grund UND Lösungsvorschlag, Bestätigen gesperrt', () => {
    const impossible: ReplanPreviewResult = {
      status: 'impossible',
      reason: 'Zu wenig Felder für die Mindestpause',
      suggestion: 'Mindestpause senken oder ein Feld hinzufügen',
    };
    render(
      <ReplanPanel
        isOpen
        preview={impossible}
        previousMatches={previousMatches}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('replan-reason')).toHaveTextContent('Zu wenig Felder');
    expect(screen.getByTestId('replan-suggestion')).toHaveTextContent('Mindestpause senken');
    expect(screen.getByTestId('replan-not-confirmable')).toBeInTheDocument();
    expect(screen.getByTestId('replan-confirm')).toBeDisabled();
  });

  it('@W5-008 – bei refused: Bestätigen gesperrt, Grund sichtbar', () => {
    const refused: ReplanPreviewResult = {
      status: 'refused',
      reason: 'Das Turnier hat bereits angepfiffen',
    };
    render(
      <ReplanPanel
        isOpen
        preview={refused}
        previousMatches={previousMatches}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('replan-reason')).toHaveTextContent('angepfiffen');
    expect(screen.getByTestId('replan-confirm')).toBeDisabled();
  });

  it('@W5-007 – Abbrechen ruft onCancel, Bestätigen ruft onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ReplanPanel
        isOpen
        preview={previewResult}
        previousMatches={previousMatches}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByTestId('replan-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('replan-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
