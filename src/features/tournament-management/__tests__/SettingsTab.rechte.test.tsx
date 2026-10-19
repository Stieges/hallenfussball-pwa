/**
 * A-11 @W5-017 (Wizard nach dem Anlegen) und @HE-042 „Turniereinstellungen ändern -> nur Turnierleitung“ (L6, F4):
 * Tom (Helfer) sieht die Einstellungen lesend mit dem Hinweis „Ändern nur durch die Turnierleitung“; Bearbeiten,
 * Neuplanen und Teams ersetzen (Erweiterte Bearbeitung) sind nicht angeboten. Gegenbeispiel: Maria (Co-Admin).
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
// LocationForm (Stammdaten) liest die Orte bisheriger Turniere -- hier ohne Bestand.
vi.mock('../../../hooks/useTournaments', () => ({ useTournaments: () => ({ tournaments: [], loading: false }) }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { SettingsTab } from '../SettingsTab';

await initRealDeI18n();

const tournament = {
  id: 'hallencup-ost', title: 'Hallencup Ost', status: 'published',
  teams: [{ id: 'sg', name: 'SG Mitte' }, { id: 'vfb', name: 'VfB Ufer' }],
  matches: [{ id: 'm13', matchStatus: 'scheduled' }],
  startDate: '2026-11-14', startTime: '09:00', ageClass: 'U11',
  location: { name: 'Halle Ost', city: 'Musterstadt' }, placementLogic: [],
} as unknown as Tournament;

async function openSettings() {
  const user = userEvent.setup();
  render(<SettingsTab tournament={tournament} onTournamentUpdate={vi.fn()} onEditInWizard={vi.fn()} />);
  await user.click(screen.getByText('Metadaten bearbeiten'));
}

const wizardButtons = () => ['Teams bearbeiten', 'Spielmodus ändern', 'Gruppen & Felder']
  .map((name) => screen.queryByRole('button', { name }));

beforeEach(() => vi.clearAllMocks());

describe('@W5-017 Nur berechtigte Personen bearbeiten – Einstellungen der Verwaltung', () => {
  it('@W5-017 Helfer: Bearbeiten, Neuplanen und Teams ersetzen sind nicht angeboten', async () => {
    role.current = 'collaborator';
    await openSettings();
    for (const button of wizardButtons()) {
      expect(button).not.toBeInTheDocument();
    }
    expect(screen.getByDisplayValue('Hallencup Ost')).toBeDisabled();
  });

  it('@HE-042 Helfer: Turniereinstellungen lesend mit „Ändern nur durch die Turnierleitung“', async () => {
    role.current = 'collaborator';
    await openSettings();
    expect(screen.getAllByTestId('lead-only-hint')[0]).toHaveTextContent('Ändern nur durch die Turnierleitung');
    expect(screen.getByDisplayValue('Hallencup Ost')).toBeInTheDocument();
  });

  it('Gegenbeispiel @W5-017: Co-Admin bekommt Bearbeiten, Neuplanen und Teams ersetzen angeboten, kein Hinweis', async () => {
    role.current = 'co-admin';
    await openSettings();
    for (const button of wizardButtons()) {
      expect(button).toBeInTheDocument();
    }
    expect(screen.getByDisplayValue('Hallencup Ost')).toBeEnabled();
    expect(screen.queryByTestId('lead-only-hint')).not.toBeInTheDocument();
  });
});
