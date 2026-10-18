/**
 * @OB-014 — Bei einer gefährlichen Aktion liegt der Fokus zuerst auf „Abbrechen",
 * ein Druck auf die Eingabetaste ändert nichts.
 *
 * Szenariogrundriss @OB-014: EIN parametrisierter Test, jede Beispielzeile der
 * Tabelle ein Fall (Turnier löschen / Spielplan zurücksetzen / Team löschen).
 * Zusätzlich hält der Gegenbeispiel-Test fest, dass der Bestätigen-Knopf
 * (Default-Label „Bestätigen") nie den Fokus bekommt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

const useAuthMock = vi.fn();
const useTournamentMembersMock = vi.fn();

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../features/auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => useTournamentMembersMock(),
}));

// A-08f3e4 Fixrunde 1: Turnier ohne Einträge -- ohne Spiel-Engine sperrte der Wächter schon das Öffnen der Rückfrage.
vi.mock('../../../hooks/useMatchEntryGuard', () => ({
  useMatchEntryGuard: () => ({ blocks: async () => false, read: async () => ({ matches: [], unreadable: false }), notify: () => undefined, isGuest: false }),
}));
import { DangerZoneCategory } from '../../../features/tournament-admin/categories/DangerZone/index';
import { TeamsTab } from '../../../features/tournament-management/TeamsTab';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

interface OpenedRueckfrage {
  cancelName: string;
  spies: ReturnType<typeof vi.fn>[];
}

function dangerTournament(matches: { id: string; matchStatus: string }[]): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches,
    startDate: '2026-03-01', startTime: '10:00',
  } as unknown as Tournament;
}

function renderDangerZone(opener: RegExp): OpenedRueckfrage & { button: HTMLElement } {
  useAuthMock.mockReturnValue({ isAuthenticated: false });
  useTournamentMembersMock.mockReturnValue({ myMembership: null, isLoading: false });
  const onTournamentUpdate = vi.fn();
  const onLocalTournamentUpdate = vi.fn();
  render(
    <DangerZoneCategory
      tournamentId="t1"
      tournament={dangerTournament([{ id: 'm1', matchStatus: 'scheduled' }])}
      onTournamentUpdate={onTournamentUpdate}
      onLocalTournamentUpdate={onLocalTournamentUpdate}
    />
  );
  return {
    cancelName: 'admin:dangerZone.cancel',
    spies: opener.source.includes('löschen')
      ? [onTournamentUpdate]
      : [onLocalTournamentUpdate],
    button: screen.getByRole('button', { name: opener }),
  };
}

async function openTeamLoeschen(user: UserEvent): Promise<OpenedRueckfrage> {
  const onTournamentUpdate = vi.fn();
  const tournament = {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'ufer', name: 'VfB Ufer' }],
    matches: [],
  } as unknown as Tournament;
  render(<TeamsTab tournament={tournament} onTournamentUpdate={onTournamentUpdate} />);
  await user.click(screen.getByTestId('team-expand-toggle-ufer'));
  await user.click(screen.getAllByRole('button', { name: /teams\.delete/ })[0]);
  return { cancelName: 'tournament:common.cancel', spies: [onTournamentUpdate] };
}

beforeEach(() => vi.clearAllMocks());

describe('@OB-014 Fokus bei gefährlichen Rückfragen', () => {
  it.each([
    ['@OB-014', 'Turnier-löschen'],
    ['@OB-014', 'Spielplan-zurücksetzen'],
    ['@OB-014', 'Team-löschen'],
  ] as [string, string][])('%s %s: Fokus auf „Abbrechen“, Enter ändert nichts', async (_kennung, zeile) => {
    const user = userEvent.setup();
    let opened: OpenedRueckfrage & { button?: HTMLElement };
    if (zeile === 'Team-löschen') {
      opened = await openTeamLoeschen(user);
    } else {
      const opener = zeile === 'Turnier-löschen' ? /Turnier löschen/i : /Spielplan zurücksetzen/i;
      const dangerZone = renderDangerZone(opener);
      await user.click(dangerZone.button);
      opened = dangerZone;
    }

    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: opened.cancelName });

    await waitFor(() => expect(document.activeElement).toBe(cancel));

    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(cancel);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    for (const spy of opened.spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('@OB-014 Gegenbeispiel: Fokus auf „Bestätigen“ wäre rot – die Rückfrage fokussiert „Abbrechen“', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Turnier löschen"
        message="Unwiederbringlich"
        variant="danger"
        confirmText="Bestätigen"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: 'common:actions.cancel' });
    const confirm = within(dialog).getByRole('button', { name: 'Bestätigen' });

    // Der Fokus muss auch nach der alten 50-ms-Verzögerung auf „Abbrechen“ liegen.
    await new Promise((resolve) => { setTimeout(resolve, 80); });
    expect(document.activeElement).toBe(cancel);
    expect(document.activeElement).not.toBe(confirm);

    await user.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.activeElement).toBe(cancel);
  });
});
