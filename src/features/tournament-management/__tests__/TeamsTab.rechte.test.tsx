/**
 * A-11 @HE-042 „ein Team umbenennen -> wird abgelehnt mit ‚nur Turnierleitung‘“ (L6, F4): Tom (Helfer) sieht die Teams
 * lesend mit „Ändern nur durch die Turnierleitung“; Umbenennen, Logo, Farbe, Löschen sind nicht angeboten.
 * Gegenbeispiel: Maria (Co-Admin) benennt „SG Mitte“ um.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

const role = vi.hoisted(() => ({ current: 'collaborator' }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { TeamsTab } from '../TeamsTab';

await initRealDeI18n();

const tournament = {
  id: 'hallencup-ost', title: 'Hallencup Ost', status: 'published',
  teams: [{ id: 'sg', name: 'SG Mitte' }, { id: 'vfb', name: 'VfB Ufer' }, { id: 'alt', name: 'FC Alt', isRemoved: true }],
  matches: [],
} as unknown as Tournament;

beforeEach(() => vi.clearAllMocks());

describe('@HE-042 Teams – nur die Turnierleitung ändert', () => {
  it('@HE-042 Tom sieht die Teams lesend mit Hinweis, Umbenennen/Logo/Farbe/Löschen/Wiederherstellen nicht angeboten', async () => {
    role.current = 'collaborator';
    const user = userEvent.setup();
    render(<TeamsTab tournament={tournament} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByTestId('lead-only-hint')).toHaveTextContent('Ändern nur durch die Turnierleitung');
    expect(screen.getByText('SG Mitte')).toBeInTheDocument();
    await user.click(screen.getByTestId('team-expand-toggle-sg'));
    expect(screen.queryByTestId('team-edit-button-sg')).not.toBeInTheDocument();
    for (const name of ['Logo hochladen', /Löschen/, /Wiederherstellen/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('Gegenbeispiel @HE-042: Maria benennt „SG Mitte“ um, kein Hinweis', async () => {
    role.current = 'co-admin';
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(<TeamsTab tournament={tournament} onTournamentUpdate={onTournamentUpdate} />);
    expect(screen.queryByTestId('lead-only-hint')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('team-expand-toggle-sg'));
    await user.click(screen.getByTestId('team-edit-button-sg'));
    await user.type(screen.getByTestId('team-rename-input-sg'), '{selectall}SG Mitte 2');
    await user.click(screen.getByTestId('team-rename-save-sg'));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
  });
});
