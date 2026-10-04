/**
 * B-04 Paket a — @W5-004 / @LZ-004: Bearbeiten setzt ein festgelegtes Turnier
 * NIE auf Entwurf zurück.
 *
 * Echter Bedienweg: Verwaltung (SettingsTab) → „Im Wizard bearbeiten" →
 * Titel ändern → Speichern (TournamentCreationService.saveDraft).
 * UI-Ort: src/features/tournament-management/SettingsTab.tsx
 * („Erweiterte Bearbeitung" / handleEditInWizard).
 *
 * Test:    veröffentlichtes Turnier bleibt nach dem Bearbeiten veröffentlicht.
 * Gegenbeispiel: ein Entwurf bleibt Entwurf.
 * Mutation: `status = 'draft'` zurück → rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import type { ITournamentRepository } from '../../../core/repositories/ITournamentRepository';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, isLoading: false }),
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

class FakeRepository {
  private store = new Map<string, Tournament>();

  async get(id: string): Promise<Tournament | null> {
    return this.store.get(id) ?? null;
  }

  async save(tournament: Tournament): Promise<void> {
    this.store.set(tournament.id, tournament);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async getAll(): Promise<Tournament[]> {
    return [...this.store.values()];
  }
}

function createService(): { service: TournamentCreationService; repo: FakeRepository } {
  const repo = new FakeRepository();
  const service = new TournamentCreationService(
    repo as unknown as ITournamentRepository
  );
  return { service, repo };
}

async function editInWizardAndSave(
  initial: Tournament,
  service: TournamentCreationService
): Promise<Tournament> {
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

  // App.tsx persistiert das übergebene Turnier und öffnet den Wizard.
  const wizardTournament = onEditInWizard.mock.calls[0][0] as Tournament;
  expect(wizardTournament.status).toBe(initial.status);

  // Im Wizard: Titel ändern → Speichern (saveDraft wie im Bearbeiten-Modus).
  return service.saveDraft({ ...wizardTournament, title: 'Neuer Titel' });
}

beforeEach(() => vi.clearAllMocks());

describe('B-04a @W5-004/@LZ-004 — Bearbeiten setzt nie auf Entwurf', () => {
  it('veröffentlichtes Turnier bleibt nach „Im Wizard bearbeiten" → Titel ändern → Speichern veröffentlicht', async () => {
    const { service } = createService();

    const saved = await editInWizardAndSave(tournamentWith('published'), service);

    expect(saved.status).toBe('published');
    expect(saved.title).toBe('Neuer Titel');
  });

  it('Gegenbeispiel: ein Entwurf bleibt Entwurf', async () => {
    const { service } = createService();

    const saved = await editInWizardAndSave(tournamentWith('draft'), service);

    expect(saved.status).toBe('draft');
  });
});
