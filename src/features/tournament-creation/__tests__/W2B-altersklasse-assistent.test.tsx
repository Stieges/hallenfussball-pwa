/**
 * Assistent: Altersklasse (Record Wizard-Regelprofile @W2B-022, @W2B-010, @W2B-024, @W2B-025).
 * Ursache des alten Befunds: createDraft setzte 'U11' vor, der Assistent zeigte sie als Wert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { DEFAULT_VALUES } from '../../../constants/tournamentOptions';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../components/LocationForm', () => ({ LocationForm: () => null }));
vi.mock('../../../components/ContactForm', () => ({ ContactForm: () => null }));

import { Step3_Metadata } from '../Step3_Metadata';
import { Step5_Overview } from '../Step5_Overview';


/** Der globale Setup ersetzt localStorage durch Attrappen; hier ein echter Speicher im Arbeitsspeicher. */
function speicherAnlegen() {
  const store = new Map<string, string>();
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => store.get(key) ?? null);
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => { store.set(key, value); });
}

beforeEach(() => speicherAnlegen());

function schritt3(ageClass: string | undefined, onUpdate = vi.fn()) {
  const formData = {
    status: 'draft', title: 'Wintercup', startDate: '2099-01-11', date: '2099-01-11', startTime: '10:00',
    sport: 'football', location: { name: 'Halle' }, ...(ageClass === undefined ? {} : { ageClass }),
  } as unknown as Partial<Tournament>;
  render(<Step3_Metadata formData={formData} onUpdate={onUpdate} />);
  return onUpdate;
}

describe('@W2B-022 Altersklasse startet leer', () => {
  it('ein neuer Entwurf trägt keine Altersklasse (Ursache U11 behoben)', () => {
    const draft = new TournamentCreationService({} as never).createDraft();
    expect(draft.ageClass).toBe('');
    expect(DEFAULT_VALUES.ageClass).toBe('');
  });

  it('Schritt „Stammdaten“: freiwillig beschriftet, nichts gewählt, Hinweis statt Vorschau', () => {
    schritt3('');
    expect(screen.getByText('Altersklasse (freiwillig)')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(screen.getByTestId('wizard-age-class-preview')).toHaveTextContent('Ohne Auswahl steht auf Aushang');
  });

  it('Zusammenfassung zeigt ohne Altersklasse keine Box, mit Angabe den Wert', () => {
    const { unmount } = render(<Step5_Overview formData={{ ageClass: '', title: 'Cup', teams: [] }} onSave={vi.fn()} />);
    expect(screen.queryByTestId('step5-age-class')).toBeNull();
    unmount();
    render(<Step5_Overview formData={{ ageClass: 'U11', title: 'Cup', teams: [] }} onSave={vi.fn()} />);
    expect(screen.getByTestId('step5-age-class')).toHaveTextContent('U11');
  });
});

describe('@W2B-010 @W2B-023 Auswahl im Schritt „Stammdaten“ (echte Texte)', () => {
  it('Jugend: E-Jugend wählen schreibt „E-Jugend“ ins Turnier', () => {
    const onUpdate = schritt3('');
    fireEvent.click(screen.getByTestId('wizard-age-class-chip-E-Jugend'));
    expect(onUpdate).toHaveBeenLastCalledWith('ageClass', 'E-Jugend');
  });

  it('@W2B-023 Stufe 2 bei vorhandener E-Jugend schreibt „E2-Jugend“ ins Turnier', () => {
    const onUpdate = schritt3('E-Jugend');
    fireEvent.click(screen.getByTestId('wizard-age-class-level-2'));
    expect(onUpdate).toHaveBeenLastCalledWith('ageClass', 'E2-Jugend');
  });

  it('@W2B-025 die zuletzt gewählte Schreibweise ist beim nächsten Turnier vorgewählt, das Feld bleibt leer', () => {
    const first = schritt3('');
    fireEvent.click(screen.getByTestId('wizard-age-class-group-uClasses'));
    fireEvent.click(screen.getByTestId('wizard-age-class-chip-U11'));
    expect(first).toHaveBeenLastCalledWith('ageClass', 'U11');
    document.body.innerHTML = '';
    schritt3('');
    expect(screen.getByTestId('wizard-age-class-group-uClasses')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });
});
