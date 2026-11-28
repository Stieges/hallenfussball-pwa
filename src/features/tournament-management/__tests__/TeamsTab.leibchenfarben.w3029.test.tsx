/**
 * @W3-029 / @W3-041 „Leibchenfarben dieses Turniers“ auch nach dem Veröffentlichen (Verwaltung → Teams).
 * Gherkin: docs/anforderungen/2026-09-27_wizard-turniertag-vorbereiten.md. Olli stellt Gelb + Neongrün ein, die Sperre bei der dritten
 * Farbe greift, „Bei gleicher Farbe zieht“ lässt sich auf Gast umstellen; Helfer und ein abgeschlossenes Turnier sehen die Eingabe nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import { palette } from '../../../design-tokens/colors/palette';

vi.unmock('i18next');
vi.unmock('react-i18next');

const role = vi.hoisted(() => ({ current: 'owner' }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: role.current, isLoading: false }),
}));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { setTournamentClosed, resetClosedTournaments } from '../../../core/services/closedTournaments';
import { TeamsTab } from '../TeamsTab';

await initRealDeI18n();

const J = palette.jersey;
const turnier = {
  id: 'hallencup-nord', title: 'Hallencup Nord', status: 'published',
  teams: [{ id: 'sg', name: 'SG Mitte' }, { id: 'vfb', name: 'VfB Ufer' }],
  matches: [],
} as unknown as Tournament;

beforeEach(() => { role.current = 'owner'; });
afterEach(() => { resetClosedTournaments(); });

describe('@W3-029 Leibchenfarben in der Verwaltung eines veröffentlichten Turniers', () => {
  it('@W3-029 Olli sieht „Leibchenfarben dieses Turniers“ bei den Teams', () => {
    render(<TeamsTab tournament={turnier} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByTestId('teams-bib-colors')).toHaveTextContent('Leibchenfarben dieses Turniers');
    expect(screen.getByTestId('wizard-bib-farbe-neongruen')).toBeInTheDocument();
  });

  it('@W3-029 Neongrün gewählt und gespeichert: bibColor und bibColors gesetzt, Rest des Turniers unverändert', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<TeamsTab tournament={turnier} onTournamentUpdate={onUpdate} />);
    expect(screen.getByTestId('teams-bib-save')).toBeDisabled();
    await user.click(screen.getByTestId('wizard-bib-farbe-neongruen'));
    expect(onUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('teams-bib-save'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'hallencup-nord', bibColor: J.neonGreen.toUpperCase(), bibColors: [J.neonGreen.toUpperCase()], teams: turnier.teams }));
  });

  it('@W3-029 eine dritte Farbe nimmt die App nicht an: Auswahl gesperrt, Hinweis „höchstens zwei“', async () => {
    const user = userEvent.setup();
    render(<TeamsTab tournament={{ ...turnier, bibColor: J.yellow, bibColors: [J.yellow] }} onTournamentUpdate={vi.fn()} />);
    await user.click(screen.getByTestId('wizard-bib-farbe-neongruen'));
    expect(screen.getByTestId('wizard-bib-max')).toHaveTextContent('Höchstens zwei Farben');
    expect(screen.getByTestId('wizard-bib-farbe-pink')).toBeDisabled();
  });

  it('@W3-041 „Bei gleicher Farbe zieht“ steht auf Heim und lässt sich auf Gast umstellen und speichern', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<TeamsTab tournament={turnier} onTournamentUpdate={onUpdate} />);
    expect(screen.getByTestId('wizard-bib-regel-heim')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByTestId('wizard-bib-regel-gast'));
    await user.click(screen.getByTestId('teams-bib-save'));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ bibRule: 'away' }));
  });

  it('Gegenbeispiel @W3-029: Helfer (Tom) sieht die Eingabe nicht', () => {
    role.current = 'collaborator';
    render(<TeamsTab tournament={turnier} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByTestId('lead-only-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('teams-bib-colors')).not.toBeInTheDocument();
  });

  it('Gegenbeispiel @W3-029: abgeschlossenes Turnier – nur lesen, keine Eingabe', () => {
    setTournamentClosed('hallencup-nord', true);
    render(<TeamsTab tournament={turnier} onTournamentUpdate={vi.fn()} />);
    expect(screen.getByTestId('tournament-closed-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('teams-bib-colors')).not.toBeInTheDocument();
  });
});
