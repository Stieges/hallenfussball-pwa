/**
 * Reiter „Einstellungen“ → „Metadaten bearbeiten“: Feld „Regelwerk“ (@DR-057, Befund C-EINSTELLUNGEN-METADATEN-OHNE-REGELWERK).
 * Gherkin: docs/anforderungen/2026-10-15_drucken.md, „Das Regelwerk steht an jeder Stelle, an der die Stammdaten bearbeitet werden“.
 * Sinngleich zu @DR-016 (80 Zeichen, Hinweise) und zur Verwaltung unter „Meta-Daten“.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../auth/hooks/useTournamentMembers', () => ({ useTournamentMembers: () => ({ myMembership: null, isLoading: false }) }));
vi.mock('../../../hooks/useTournaments', () => ({ useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()), tournaments: [] }) }));

import { SettingsTab } from '../SettingsTab';

const NIKOLAUS = 'BFV Richtlinie für private Hallenturniere';
/** Bestandstext mit zerlegtem „ü“ (u + U+0308), wie in einem echten Turnier der Produktion. */
const ZERLEGT = 'BFV Richtlinie für private Hallenturniere';

function turnier(rulebook?: string): Tournament {
  return {
    id: 't1', title: 'Nikolaus-Turnier', organizer: 'TSV Nord', status: 'published', publishedAt: '2026-10-01T08:00:00Z', version: 3,
    rulebook,
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], matches: [],
    startDate: '2099-03-01', startTime: '10:00', date: '2099-03-01', timeSlot: '10:00',
    ageClass: 'U11', location: { name: 'Halle Süd', city: 'Musterstadt' }, placementLogic: [],
  } as unknown as Tournament;
}

const onTournamentUpdate = vi.fn();
const zeige = (t: Tournament) => {
  const view = render(<SettingsTab tournament={t} onTournamentUpdate={onTournamentUpdate} />);
  fireEvent.click(screen.getByText('Metadaten bearbeiten'));
  return (next: Tournament) => view.rerender(<SettingsTab tournament={next} onTournamentUpdate={onTournamentUpdate} />);
};
const regelwerk = () => screen.getByTestId<HTMLInputElement>('settings-rulebook');
const veranstalter = () => screen.getByLabelText<HTMLInputElement>(/^Veranstalter/);
const speichern = () => fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
const gespeichert = (): Tournament => onTournamentUpdate.mock.calls[0][0] as Tournament;

beforeEach(() => vi.clearAllMocks());

describe('@DR-057 Reiter „Einstellungen“: Regelwerk bei den Stammdaten', () => {
  it('@DR-057 das Feld „Regelwerk“ steht unter „Veranstalter“ und zeigt den gespeicherten Text', () => {
    zeige(turnier(NIKOLAUS));
    expect(regelwerk()).toHaveValue(NIKOLAUS);
    expect(screen.getByLabelText(/^Regelwerk/)).toBe(regelwerk());
    // Reihenfolge: Veranstalter vor Regelwerk
    expect(veranstalter().compareDocumentPosition(regelwerk()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Höchstens 80 Zeichen.')).toBeInTheDocument();
    // Gegenbeispiel: ohne Regelwerk ist das Feld leer, nicht „undefined“
    expect(document.querySelectorAll('[data-testid="settings-rulebook"]')).toHaveLength(1);
  });

  it('Gegenbeispiel: ohne eingetragenes Regelwerk ist das Feld leer', () => {
    zeige(turnier(undefined));
    expect(regelwerk()).toHaveValue('');
  });

  it('@DR-057 Ändern und Speichern übergibt den neuen Text; Gegenbeispiel: vorher nicht „ungespeichert“', () => {
    zeige(turnier(NIKOLAUS));
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' })).toBeDisabled();

    fireEvent.change(regelwerk(), { target: { value: 'BFV-Richtlinien für Futsal' } });
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
    speichern();

    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    expect(gespeichert().rulebook).toBe('BFV-Richtlinien für Futsal');
    expect(gespeichert().organizer).toBe('TSV Nord');
  });

  it('@DR-057 leeren speichert „kein Regelwerk“ (undefined, nicht „“)', () => {
    zeige(turnier(NIKOLAUS));
    fireEvent.change(regelwerk(), { target: { value: '' } });
    speichern();
    expect(gespeichert().rulebook).toBeUndefined();
  });

  it.each([
    ['normaler Text', NIKOLAUS],
    ['zerlegtes „ü“ (u + U+0308)', ZERLEGT],
    ['kein Regelwerk', undefined],
  ])('@DR-057 nur ein anderes Feld geändert: Regelwerk bleibt unverändert (%s)', (_name, text) => {
    zeige(turnier(text));
    expect(regelwerk()).toHaveValue(text ?? '');
    fireEvent.change(veranstalter(), { target: { value: 'SV Süd' } });
    speichern();
    expect(gespeichert().organizer).toBe('SV Süd');
    expect(gespeichert().rulebook).toBe(text);
    if (text !== undefined) { expect(gespeichert().rulebook?.length).toBe(text.length); }
  });

  it('@DR-057 zerlegter Umlaut wird unverändert angezeigt und ist nicht „ungespeichert“', () => {
    zeige(turnier(ZERLEGT));
    expect(regelwerk().value).toBe(ZERLEGT);
    expect(regelwerk().value).not.toBe(ZERLEGT.normalize('NFC'));
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument();
  });

  it('@DR-057 Grenze 80: Einfügen von 81 Zeichen nimmt 80 an und sagt das; Gegenbeispiel: genau 80 ohne Hinweis', async () => {
    const user = userEvent.setup();
    zeige(turnier(undefined));
    await user.click(regelwerk());
    await user.paste('b'.repeat(80));
    expect(regelwerk()).toHaveValue('b'.repeat(80));
    expect(screen.queryByText('Auf 80 Zeichen gekürzt.')).not.toBeInTheDocument();

    await user.clear(regelwerk());
    await user.paste('c'.repeat(81));
    expect(regelwerk()).toHaveValue('c'.repeat(80));
    expect(screen.getByText('Auf 80 Zeichen gekürzt.')).toBeInTheDocument();
    speichern();
    expect(gespeichert().rulebook).toBe('c'.repeat(80));
  });

  it('@DR-057 Verwerfen stellt den alten Text her und nimmt „ungespeichert“ zurück', async () => {
    const user = userEvent.setup();
    zeige(turnier(NIKOLAUS));
    fireEvent.change(regelwerk(), { target: { value: 'Etwas anderes' } });
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    await user.click(await screen.findByRole('button', { name: 'Verwerfen' }));

    expect(regelwerk()).toHaveValue(NIKOLAUS);
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument();
  });

  it('@DR-057 Änderung zurück auf den gespeicherten Text: nicht mehr „ungespeichert“', () => {
    zeige(turnier(NIKOLAUS));
    fireEvent.change(regelwerk(), { target: { value: 'x' } });
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
    fireEvent.change(regelwerk(), { target: { value: NIKOLAUS } });
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument();
  });

  it('@DR-057 neuer Stand vom Server (anderes Feld geändert): Regelwerk bleibt stehen und wird beim Speichern nicht gelöscht', () => {
    const neuerStand = zeige(turnier(NIKOLAUS));
    fireEvent.change(veranstalter(), { target: { value: 'SV Süd' } });
    neuerStand({ ...turnier(NIKOLAUS), version: 4, startTime: '11:00' });
    expect(regelwerk()).toHaveValue(NIKOLAUS);
    speichern();
    expect(gespeichert().rulebook).toBe(NIKOLAUS);
  });

  it('@DR-057 Regelwerk auf einem anderen Gerät geändert: das Feld zieht nach, wenn es unangefasst ist', () => {
    const neuerStand = zeige(turnier(NIKOLAUS));
    neuerStand({ ...turnier('Neuer Text vom anderen Gerät'), version: 4 });
    expect(regelwerk()).toHaveValue('Neuer Text vom anderen Gerät');
  });

  it('@DR-057 Gegenbeispiel: eigene Eingabe im Regelwerk überlebt einen neuen Stand mit anderem Feld', () => {
    const neuerStand = zeige(turnier(NIKOLAUS));
    fireEvent.change(regelwerk(), { target: { value: 'Mein Entwurf' } });
    neuerStand({ ...turnier(NIKOLAUS), version: 4, title: 'Nikolaus-Turnier 2' });
    expect(regelwerk()).toHaveValue('Mein Entwurf');
  });
});
