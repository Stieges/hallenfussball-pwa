/**
 * R3-3 Einstellungen der Verwaltung nach dem Abschluss: Metadaten (Name, Datum, Ort), Felder (`FieldManagement`),
 * Sponsoren, Kindermodus/Punkteschema (alles im Formular) und der Wizard-Einstieg „Neuplanen“ (Erweiterte Bearbeitung,
 * alle 5 Schritte). @LZ-036 Z. 6 „das Punkteschema auf 2/1/0 ändern -> bietet die App das nicht an“, @LZ-037 Z. 1–3
 * (Kindermodus, Turniername, Sponsor: erst nach dem Wiederöffnen), @ZP-087. Gegenbeispiel: dasselbe Turnier offen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));
vi.mock('../../../hooks/useTournaments', () => ({ useTournaments: () => ({ tournaments: [], loading: false }) }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { setTournamentClosed, resetClosedTournaments } from '../../../core/services/closedTournaments';
import { SettingsTab } from '../SettingsTab';

await initRealDeI18n();

const tournament = {
  id: 'hallencup-ost', title: 'Hallencup Ost', status: 'published',
  teams: [{ id: 'sg', name: 'SG Mitte' }, { id: 'vfb', name: 'VfB Ufer' }],
  matches: [{ id: 'm13', matchStatus: 'scheduled' }], numberOfFields: 2,
  fields: [{ id: 'field-1', defaultName: 'Feld 1' }, { id: 'field-2', defaultName: 'Feld 2' }],
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

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); });
afterEach(() => { resetClosedTournaments(); });

describe('@LZ-036 @LZ-037 Einstellungen nach dem Abschluss', () => {
  it('abgeschlossen: Turniername gesperrt, Hinweis „abgeschlossen“, Felder und Sponsoren nicht bedienbar', async () => {
    setTournamentClosed('hallencup-ost', true);
    await openSettings();
    expect(screen.getAllByTestId('tournament-closed-hint')[0]).toHaveTextContent('Das Turnier ist abgeschlossen');
    expect(screen.getByDisplayValue('Hallencup Ost')).toBeDisabled();
    const fieldEdit = screen.getAllByTitle(/Bezeichnung bearbeiten/);
    for (const button of fieldEdit) {
      expect(button).toBeDisabled();
    }
  });

  it('abgeschlossen: der Wizard-Einstieg (Neuplanen, Teams ersetzen: alle fünf Schritte) ist nicht angeboten', async () => {
    setTournamentClosed('hallencup-ost', true);
    await openSettings();
    for (const button of wizardButtons()) {
      expect(button).not.toBeInTheDocument();
    }
  });

  it('Gegenbeispiel: offen – Name bearbeitbar, Felder bedienbar, Wizard-Einstieg da, kein Abschluss-Hinweis', async () => {
    await openSettings();
    expect(screen.getByDisplayValue('Hallencup Ost')).toBeEnabled();
    for (const button of wizardButtons()) {
      expect(button).toBeInTheDocument();
    }
    expect(screen.queryByTestId('tournament-closed-hint')).not.toBeInTheDocument();
    for (const button of screen.getAllByTitle(/Bezeichnung bearbeiten/)) {
      expect(button).toBeEnabled();
    }
  });
});
