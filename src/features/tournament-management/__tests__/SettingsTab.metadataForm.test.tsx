/**
 * SettingsTab — Metadaten-Formular (Aufklappen, Änderung, Speichern/Zurücksetzen).
 *
 * Ergänzt die Gate-Tests (wizardEditGate) um den Formularweg.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
}));

// LocationForm zieht Ort-Vorschläge aus useTournaments (RepositoryContext) —
// für den Formular-Test reicht eine leere Liste.
vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({
    tournaments: [],
    loading: false,
    saveTournament: vi.fn(),
    deleteTournament: vi.fn(),
    softDeleteTournament: vi.fn(),
    restoreTournament: vi.fn(),
    permanentDeleteTournament: vi.fn(),
  }),
}));

import { SettingsTab } from '../SettingsTab';

function tournamentFixture(): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [{ id: 'm1', matchStatus: 'scheduled' }],
    startDate: '2026-03-01', startTime: '10:00',
    ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' },
    placementLogic: [],
  } as unknown as Tournament;
}

beforeEach(() => vi.clearAllMocks());

describe('SettingsTab — Metadaten-Formular', () => {
  it('ist eingeklappt und zeigt den Titel erst nach dem Aufklappen', async () => {
    const user = userEvent.setup();
    render(
      <SettingsTab tournament={tournamentFixture()} onTournamentUpdate={vi.fn()} />
    );

    expect(screen.queryByDisplayValue('Wintercup')).not.toBeInTheDocument();

    await user.click(screen.getByText('tournament:settings.editMetadata'));

    expect(screen.getByDisplayValue('Wintercup')).toBeInTheDocument();
  });

  it('Änderung markiert ungespeichert; Speichern übergibt den neuen Titel', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(
      <SettingsTab tournament={tournamentFixture()} onTournamentUpdate={onTournamentUpdate} />
    );

    await user.click(screen.getByText('tournament:settings.editMetadata'));
    const title = screen.getByDisplayValue('Wintercup');
    await user.clear(title);
    await user.type(title, 'Wintercup 2027');

    expect(screen.getByText('tournament:settings.unsavedChanges')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'tournament:common.save' }));

    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(onTournamentUpdate.mock.calls[0][0].title).toBe('Wintercup 2027');
  });

  it('Zurücksetzen verwirft die Änderung (Gegenbeispiel: Titel bleibt)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(
      <SettingsTab tournament={tournamentFixture()} onTournamentUpdate={onTournamentUpdate} />
    );

    await user.click(screen.getByText('tournament:settings.editMetadata'));
    const title = screen.getByDisplayValue('Wintercup');
    await user.clear(title);
    await user.type(title, 'Verworfener Titel');

    await user.click(screen.getByRole('button', { name: 'tournament:settings.reset' }));

    expect(screen.getByDisplayValue('Wintercup')).toBeInTheDocument();
    expect(screen.getByText('tournament:settings.saved')).toBeInTheDocument();
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('Zurücksetzen ohne Bestätigung behält die Änderung', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<SettingsTab tournament={tournamentFixture()} onTournamentUpdate={vi.fn()} />);

    await user.click(screen.getByText('tournament:settings.editMetadata'));
    const title = screen.getByDisplayValue('Wintercup');
    await user.clear(title);
    await user.type(title, 'Bleibt stehen');

    await user.click(screen.getByRole('button', { name: 'tournament:settings.reset' }));

    expect(screen.getByDisplayValue('Bleibt stehen')).toBeInTheDocument();
  });

  it('meldet den Dirty-State an den Parent und warnt vor dem Schließen', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    render(
      <SettingsTab
        tournament={tournamentFixture()}
        onTournamentUpdate={vi.fn()}
        onDirtyChange={onDirtyChange}
      />
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByText('tournament:settings.editMetadata'));
    const title = screen.getByDisplayValue('Wintercup');
    await user.clear(title);
    await user.type(title, 'Unspeicherter Titel');

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);

    expect(beforeUnload.defaultPrevented).toBe(true);
  });

  it('weitere Felder sind editierbar (Veranstalter, Altersklasse)', async () => {
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn();
    render(
      <SettingsTab tournament={tournamentFixture()} onTournamentUpdate={onTournamentUpdate} />
    );

    await user.click(screen.getByText('tournament:settings.editMetadata'));
    const organizer = screen.getByPlaceholderText('tournament:settings.organizerPlaceholder');
    await user.type(organizer, 'Muster-SC');

    expect(screen.getByText('tournament:settings.unsavedChanges')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'tournament:common.save' }));
    expect(onTournamentUpdate.mock.calls[0][0].organizer).toBe('Muster-SC');
  });
});
