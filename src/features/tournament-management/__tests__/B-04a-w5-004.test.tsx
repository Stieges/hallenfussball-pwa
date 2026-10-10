/**
 * B-04 Paket a — @W5-004 / @LZ-004: Bearbeiten setzt ein festgelegtes Turnier
 * NIE auf Entwurf zurück.
 *
 * Echter Bedienweg: Verwaltung (SettingsTab) → „Im Wizard bearbeiten" →
 * handleEditInWizard reicht das Turnier mit unverändertem Status an App weiter
 * (App.handleEditInWizard speichert genau dieses Objekt 1:1).
 * UI-Ort: src/features/tournament-management/SettingsTab.tsx
 * („Erweiterte Bearbeitung" / handleEditInWizard).
 *
 * @W5-004: festgelegtes Turnier bleibt festgelegt; Gegenbeispiel: Entwurf bleibt Entwurf.
 * @LZ-004: Turnier mit angepfiffenem Spiel (running): Bearbeiten wird nicht angeboten,
 *          der Status bleibt unverändert.
 * Mutation: `status = 'draft'` im Bearbeiten-Weg → @W5-004 rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
}));

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()), tournaments: [] }),
}));

import { SettingsTab } from '../SettingsTab';

function tournamentWith(status: 'published' | 'draft'): Tournament {
  return {
    id: 't1',
    title: 'Wintercup',
    status,
    publishedAt: status === 'published' ? '2026-10-01T08:00:00Z' : undefined,
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [{ id: 'm1' }, { id: 'm2' }],
    startDate: '2030-03-01',
    startTime: '10:00',
    date: '2030-03-01',
    timeSlot: '10:00',
    ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' },
    placementLogic: [],
  } as unknown as Tournament;
}

async function editInWizard(initial: Tournament): Promise<Tournament> {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const user = userEvent.setup();
  const onEditInWizard = vi.fn();
  render(
    <SettingsTab
      tournament={initial}
      onTournamentUpdate={vi.fn()}
      onEditInWizard={onEditInWizard}
    />
  );

  await user.click(
    screen.getByRole('button', { name: /settings\.advancedEditing\.editTeams/ })
  );

  // App.handleEditInWizard persistiert genau dieses Objekt und öffnet den Wizard.
  expect(onEditInWizard).toHaveBeenCalledTimes(1);
  return onEditInWizard.mock.calls[0][0] as Tournament;
}

beforeEach(() => vi.clearAllMocks());

describe('B-04a @W5-004/@LZ-004 — Bearbeiten setzt nie auf Entwurf', () => {
  it('@W5-004 festgelegtes Turnier bleibt nach „Im Wizard bearbeiten" festgelegt', async () => {
    const initial = tournamentWith('published');

    const wizardTournament = await editInWizard(initial);

    expect(wizardTournament.status).toBe('published');
    expect(wizardTournament.publishedAt).toBe(initial.publishedAt);
  });

  it('@W5-004 Gegenbeispiel: ein Entwurf bleibt Entwurf', async () => {
    const wizardTournament = await editInWizard(tournamentWith('draft'));

    expect(wizardTournament.status).toBe('draft');
  });

  it('@LZ-004 Stammdaten eines laufenden Turniers speichern lässt Status und laufendes Spiel unverändert', () => {
    const running = {
      ...tournamentWith('published'),
      matches: [
        { id: 'm1', matchStatus: 'running' },
        { id: 'm2', matchStatus: 'scheduled' },
      ],
    } as unknown as Tournament;
    const onEditInWizard = vi.fn();
    const onTournamentUpdate = vi.fn();

    render(
      <SettingsTab
        tournament={running}
        onTournamentUpdate={onTournamentUpdate}
        onEditInWizard={onEditInWizard}
      />
    );

    expect(
      screen.queryByRole('button', { name: /settings\.advancedEditing\.editTeams/ })
    ).not.toBeInTheDocument();
    expect(onEditInWizard).not.toHaveBeenCalled();
    expect(onTournamentUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('heading', { name: /settings\.editMetadata/ }));
    fireEvent.change(screen.getByDisplayValue('Wintercup'), { target: { value: 'Neuer Cup' } });
    fireEvent.click(screen.getByRole('button', { name: /common\.save/ }));

    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    const updated = onTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(updated.status).toBe('published');
    expect(updated.publishedAt).toBe(running.publishedAt);
    expect(updated.matches[0].matchStatus).toBe('running');
    expect(updated.title).toBe('Neuer Cup');

    expect(
      screen.queryByRole('button', { name: /settings\.advancedEditing\.editTeams/ })
    ).not.toBeInTheDocument();
  });

  it('@LZ-004 Gegenbeispiel: ohne Änderung ist Speichern deaktiviert und onTournamentUpdate bleibt ungerufen', () => {
    const running = {
      ...tournamentWith('published'),
      matches: [
        { id: 'm1', matchStatus: 'running' },
        { id: 'm2', matchStatus: 'scheduled' },
      ],
    } as unknown as Tournament;
    const onTournamentUpdate = vi.fn();

    render(
      <SettingsTab
        tournament={running}
        onTournamentUpdate={onTournamentUpdate}
        onEditInWizard={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('heading', { name: /settings\.editMetadata/ }));

    expect(screen.getByRole('button', { name: /common\.save/ })).toBeDisabled();
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });
});
