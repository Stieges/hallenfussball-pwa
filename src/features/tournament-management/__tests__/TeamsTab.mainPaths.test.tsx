/**
 * Abdeckung (Fixrunde 1 Teil b) — TeamsTab-Hauptpfade außerhalb des
 * Lösch-Dialogs (den deckt TeamsTab.deleteDialogA11y ab): Umbenennen
 * (Speichern/Abbrechen), Logo entfernen, Teamfarbe, Wiederherstellen und
 * Löschen mit Ergebnissen („Als entfernt markieren").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

import { TeamsTab } from '../TeamsTab';

function tournamentWith(teams: Array<{ id: string; name: string; isRemoved?: boolean; logo?: unknown; color?: string }>, matches: Array<{ id: string; teamA?: string; teamB?: string; scoreA?: number; scoreB?: number }> = []): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams,
    matches,
  } as unknown as Tournament;
}

beforeEach(() => vi.clearAllMocks());

describe('TeamsTab — Hauptpfade (Abdeckung)', () => {
  it('Umbenennen speichert und bricht ab', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(<TeamsTab tournament={tournamentWith([{ id: 'ufer', name: 'VfB Ufer' }])} onTournamentUpdate={onTournamentUpdate} />);

    await user.click(screen.getByTestId('team-expand-toggle-ufer'));
    await user.click(screen.getByTestId('team-edit-button-ufer'));
    await user.type(screen.getByTestId('team-rename-input-ufer'), '{selectall}FC Neu');
    await user.click(screen.getByTestId('team-rename-save-ufer'));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('team-edit-button-ufer'));
    await user.click(within(screen.getByTestId('team-card-ufer')).getByRole('button', { name: /common\.cancel/ }));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
  });

  it('Logo entfernen aktualisiert das Turnier', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(
      <TeamsTab
        tournament={tournamentWith([{ id: 'ufer', name: 'VfB Ufer', logo: { type: 'url', value: 'https://example.org/l.png' }, color: '#112233' }])}
        onTournamentUpdate={onTournamentUpdate}
      />
    );

    await user.click(screen.getByTestId('team-expand-toggle-ufer'));
    await user.click(within(screen.getByTestId('team-card-ufer')).getByRole('button', { name: /teams\.logo\.remove/ }));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
  });

  it('Logo-Dialog öffnet über den Avatar und schließt ohne Änderung', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(
      <TeamsTab
        tournament={tournamentWith([{ id: 'ufer', name: 'VfB Ufer', logo: { type: 'url', value: 'https://example.org/l.png' } }])}
        onTournamentUpdate={onTournamentUpdate}
      />
    );

    await user.click(screen.getByAltText('VfB Ufer Logo'));
    // Dialog im Portal — Schließen ohne Update (eigener Dialog mit aria-label).
    const close = await screen.findByRole('button', { name: 'Schließen' });
    await user.click(close);
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('Wiederherstellen und Löschen mit Ergebnissen laufen über onTournamentUpdate', async () => {
    // H1: handleRestoreTeam fragt über window.confirm — hier bestätigt.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(
      <TeamsTab
        tournament={tournamentWith(
          [{ id: 'alt', name: 'Alt FC', isRemoved: true }, { id: 'ufer', name: 'VfB Ufer' }],
          [{ id: 'm1', teamA: 'ufer', teamB: 'alt', scoreA: 2, scoreB: 1 }]
        )}
        onTournamentUpdate={onTournamentUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /teams\.restore/ }));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('team-expand-toggle-ufer'));
    await user.click(screen.getAllByRole('button', { name: /teams\.delete/ })[0]);
    const dialog = screen.getByTestId('team-delete-dialog');
    await user.click(within(dialog).getByRole('button', { name: /teams\.deleteDialog\.markAsRemoved/ }));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(2);
  });
});
