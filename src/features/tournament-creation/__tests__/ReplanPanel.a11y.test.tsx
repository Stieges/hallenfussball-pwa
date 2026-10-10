/**
 * F6/F10 (GB1 Paket 2) — ReplanPanel über die echte Bedienung (echter Dialog,
 * kein Mock): Startfokus liegt auf „Abbrechen" (initialFocusRef), Enter löst
 * weder Bestätigen noch Abbrechen aus (suppressEnter). maxWidth nutzt den
 * Dialog-Standard, keinen px-Wert (F10).
 *
 * Mutationsprobe: suppressEnter entfernen macht den Enter-Test rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Match } from '../../../types/tournament';
import type { ReplanPreviewResult } from '../utils/replan';
import { ReplanPanel } from '../components/ReplanPanel';
import { looseVs } from '../../../test/matchSlotFixtures';

const previousMatches: Match[] = [
  { id: 'm1', round: 1, field: 1, ...looseVs('1', '2') },
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
    ],
    initialStandings: [],
    tournament: {} as never,
    endTime: new Date('2030-01-01T09:42:00Z'),
    numberOfFields: 1,
  } as unknown as Extract<ReplanPreviewResult, { status: 'preview' }>['schedule'],
  endTime: new Date('2030-01-01T09:42:00Z'),
  keptMatches: [{ ...previousMatches[0], scoreA: 2, scoreB: 1, matchStatus: 'finished' }],
  keptNotices: [],
  conflictMatchIds: [],
};

beforeEach(() => vi.clearAllMocks());

describe('ReplanPanel — Neuplanungs-Rückfrage (F6/F10)', () => {
  it('Startfokus auf „Abbrechen", Enter bestätigt nicht und bricht nicht ab', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ReplanPanel
        isOpen
        preview={previewResult}
        previousMatches={previousMatches}
        teams={[{ id: '1', name: 'Team A' }, { id: '2', name: 'Team B' }]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancel = screen.getByTestId('replan-cancel');
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    await user.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByTestId('replan-panel')).toBeInTheDocument();
  });
});
