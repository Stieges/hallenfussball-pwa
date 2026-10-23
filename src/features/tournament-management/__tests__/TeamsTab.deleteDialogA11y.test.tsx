/**
 * G2 (Fixrunde 1 Teil b) — Der Team-Lösch-Dialog hängt nicht am ersten
 * fokussierbaren Element: explizites Start-Ziel (initialFocusRef) für
 * „Abbrechen", `aria-labelledby` auf die Überschrift, `data-testid` am Dialog.
 *
 * Test: Dialog ist a11y benannt (aria-labelledby → h3) und hat den Test-Bezug;
 *   der Fokus liegt explizit auf „Abbrechen".
 * Gegenprobe (manuell): aria-labelledby/data-testid entfernen macht den Test rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

// A-11: TeamsTab fragt Rechte über useCan -- hier die Turnierleitung (alles erlaubt).
vi.mock('../../auth/hooks/useCan', () => ({ useCan: () => true }));

import { TeamsTab } from '../TeamsTab';

function tournamentWithTeam(): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'ufer', name: 'VfB Ufer' }],
    matches: [],
  } as unknown as Tournament;
}

async function openTeamLoeschen() {
  const user = userEvent.setup();
  render(<TeamsTab tournament={tournamentWithTeam()} onTournamentUpdate={vi.fn()} />);
  await user.click(screen.getByTestId('team-expand-toggle-ufer'));
  await user.click(screen.getAllByRole('button', { name: /teams\.delete/ })[0]);
  return { user };
}

beforeEach(() => vi.clearAllMocks());

describe('TeamsTab — Team-Lösch-Dialog (G2)', () => {
  it('Dialog trägt data-testid und aria-labelledby, Fokus auf „Abbrechen“', async () => {
    const { user } = await openTeamLoeschen();

    const dialog = screen.getByTestId('team-delete-dialog');
    expect(dialog).toHaveAccessibleName(/teams\.deleteDialog\.title/);

    const cancel = within(dialog).getByRole('button', { name: /common\.cancel/ });
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    await user.keyboard('{Enter}');
    expect(screen.getByTestId('team-delete-dialog')).toBeInTheDocument();
  });
});
