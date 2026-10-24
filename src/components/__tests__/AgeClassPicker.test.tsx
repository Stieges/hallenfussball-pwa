/**
 * Altersklasse im Assistenten (Mockup B2). Szenarien: @W2B-010, @W2B-022, @W2B-023, @W2B-024, @W2B-025, @W2B-026.
 * Übersetzungen liefern im Test den Schlüssel.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { AgeClassPicker } from '../AgeClassPicker';


/** Der globale Setup ersetzt localStorage durch Attrappen; hier ein echter Speicher im Arbeitsspeicher. */
function speicherAnlegen() {
  const store = new Map<string, string>();
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => store.get(key) ?? null);
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => { store.set(key, value); });
}

const onChangeSpy = vi.fn<(value: string) => void>();

function Harness({ initial = '', sport }: { initial?: string; sport?: 'football' | 'other' }) {
  const [value, setValue] = useState(initial);
  return (
    <AgeClassPicker
      value={value}
      sport={sport}
      testId="ac"
      onChange={(v) => {
        onChangeSpy(v);
        setValue(v);
      }}
    />
  );
}

const chip = (name: string) => screen.getByTestId(`ac-chip-${name}`);
const group = (id: string) => screen.getByTestId(`ac-group-${id}`);
const preview = () => screen.getByTestId('ac-preview');

beforeEach(() => {
  onChangeSpy.mockClear();
  speicherAnlegen();
});

describe('@W2B-022 startet leer, freiwillig', () => {
  it('nichts gewählt, keine Stufe, Hinweis statt Vorschau, kein Platzhalterwert', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
    expect(screen.queryByTestId('ac-level')).toBeNull();
    expect(preview()).toHaveTextContent('ageClassPicker.previewEmpty');
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: kein Eintrag „Keine Angabe“ und kein „U11“ vorbelegt', () => {
    render(<Harness />);
    expect(screen.queryByText(/keine angabe/i)).toBeNull();
    fireEvent.click(group('uClasses'));
    expect(chip('U11')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('@W2B-010 Umschalter und Einträge', () => {
  it('Jugend zeigt G- bis A-Jugend und Sonstiges, sonst nichts', () => {
    render(<Harness />);
    const names = ['G-Jugend', 'F-Jugend', 'E-Jugend', 'D-Jugend', 'C-Jugend', 'B-Jugend', 'A-Jugend', 'custom'];
    names.forEach((n) => expect(chip(n)).toBeInTheDocument());
    expect(screen.queryByTestId('ac-chip-U11')).toBeNull();
    expect(screen.queryByTestId('ac-chip-Herren')).toBeNull();
  });

  it('U-Klassen zeigt U7 bis U19 ohne U18', () => {
    render(<Harness />);
    fireEvent.click(group('uClasses'));
    expect(chip('U7')).toBeInTheDocument();
    expect(chip('U19')).toBeInTheDocument();
    expect(screen.queryByTestId('ac-chip-U18')).toBeNull();
    expect(screen.queryByTestId('ac-chip-E-Jugend')).toBeNull();
  });

  it('Erwachsene zeigt Herren, Frauen, Senioren, Ü32, Ü40, Ü50', () => {
    render(<Harness />);
    fireEvent.click(group('adults'));
    ['Herren', 'Frauen', 'Senioren', 'Ü32', 'Ü40', 'Ü50'].forEach((n) => expect(chip(n)).toBeInTheDocument());
    expect(screen.queryByTestId('ac-chip-Damen')).toBeNull();
  });

  it('Sonstiges öffnet ein freies Feld, der Text wird ohne Umrechnung übernommen', () => {
    render(<Harness />);
    fireEvent.click(group('adults'));
    fireEvent.click(chip('custom'));
    fireEvent.change(screen.getByTestId('ac-custom-input'), { target: { value: 'Firmenteams' } });
    expect(onChangeSpy).toHaveBeenLastCalledWith('Firmenteams');
    expect(preview()).toHaveTextContent('Firmenteams');
  });

  it('Gegenbeispiel: Sonstiges ohne Text bleibt leer (keine Regelvorbelegung, kein Platzhalter)', () => {
    render(<Harness />);
    fireEvent.click(chip('custom'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('');
    expect(preview()).toHaveTextContent('ageClassPicker.previewEmpty');
  });

  it('der Wechsel der Schreibweise hebt eine unsichtbar gewordene Wahl auf, „Sonstiges“ bleibt', () => {
    render(<Harness />);
    fireEvent.click(chip('E-Jugend'));
    fireEvent.click(group('uClasses'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('');
    expect(preview()).toHaveTextContent('ageClassPicker.previewEmpty');
    fireEvent.click(chip('custom'));
    fireEvent.change(screen.getByTestId('ac-custom-input'), { target: { value: 'Firma' } });
    fireEvent.click(group('adults'));
    expect(screen.getByTestId('ac-custom-input')).toHaveValue('Firma');
  });

  it('erneutes Antippen der Auswahl hebt sie auf', () => {
    render(<Harness />);
    fireEvent.click(chip('E-Jugend'));
    fireEvent.click(chip('E-Jugend'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('');
  });
});

describe('@W2B-023 Stufe nur bei Jugend', () => {
  it('E-Jugend + Stufe 2 ergibt „E2-Jugend“, ohne Stufe „E-Jugend“', () => {
    render(<Harness />);
    fireEvent.click(chip('E-Jugend'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('E-Jugend');
    fireEvent.click(screen.getByTestId('ac-level-2'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('E2-Jugend');
    expect(preview()).toHaveTextContent('E2-Jugend');
    fireEvent.click(screen.getByTestId('ac-level-2'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('E-Jugend');
  });

  it('Gegenbeispiel: bei Jugend ohne gewählten Eintrag, U-Klassen und Erwachsenen gibt es keine Stufe', () => {
    render(<Harness />);
    expect(screen.queryByTestId('ac-level')).toBeNull();
    fireEvent.click(group('uClasses'));
    fireEvent.click(chip('U11'));
    expect(screen.queryByTestId('ac-level')).toBeNull();
    fireEvent.click(group('adults'));
    fireEvent.click(chip('Herren'));
    expect(screen.queryByTestId('ac-level')).toBeNull();
  });

  it('die Stufe bleibt beim Wechsel zu einer anderen Jugend erhalten', () => {
    render(<Harness initial="E2-Jugend" />);
    fireEvent.click(chip('D-Jugend'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('D2-Jugend');
  });
});

describe('@W2B-024 genau wie gewählt', () => {
  it('U11 bleibt „U11“', () => {
    render(<Harness />);
    fireEvent.click(group('uClasses'));
    fireEvent.click(chip('U11'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('U11');
    expect(preview()).toHaveTextContent('U11');
    expect(preview()).not.toHaveTextContent('E-Jugend');
  });
});

describe('@W2B-025 zuletzt genutzte Schreibweise', () => {
  it('beim nächsten Mal ist „U-Klassen“ vorgewählt, das Feld bleibt leer', () => {
    const first = render(<Harness />);
    fireEvent.click(group('uClasses'));
    fireEvent.click(chip('U11'));
    first.unmount();
    render(<Harness />);
    expect(group('uClasses')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
    expect(preview()).toHaveTextContent('ageClassPicker.previewEmpty');
  });

  it('Gegenbeispiel: ohne Vorgeschichte ist „Jugend“ gewählt; ein gesperrter Speicher stört nicht', () => {
    vi.mocked(window.localStorage.getItem).mockImplementation(() => {
      throw new Error('gesperrt');
    });
    render(<Harness />);
    expect(group('youth')).toHaveAttribute('aria-checked', 'true');
  });

  it('ein vorhandener Wert hat Vorrang vor der letzten Schreibweise', () => {
    window.localStorage.setItem('hallenfussball.ageClassGroup', 'adults');
    render(<Harness initial="U9" />);
    expect(group('uClasses')).toHaveAttribute('aria-checked', 'true');
    expect(chip('U9')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('@W2B-026 alter Wert „AH“', () => {
  it('bleibt unverändert, steht unter Sonstiges und wird erklärt', () => {
    render(<Harness initial="AH" />);
    expect(chip('custom')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('ac-custom-input')).toHaveValue('AH');
    expect(screen.getByTestId('ac-adopted')).toBeInTheDocument();
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(preview()).toHaveTextContent('AH');
  });

  it('Gegenbeispiel: ein Wert aus der Liste braucht keine Erklärung', () => {
    render(<Harness initial="Herren" />);
    expect(screen.queryByTestId('ac-adopted')).toBeNull();
    expect(chip('Herren')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Sportart „andere“', () => {
  it('hat ihre eigene Liste mit derselben Bedienung', () => {
    render(<Harness sport="other" />);
    fireEvent.click(chip('U12'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('U12');
    fireEvent.click(group('general'));
    expect(chip('Mixed')).toBeInTheDocument();
    expect(screen.queryByTestId('ac-group-youth')).toBeNull();
  });
});
