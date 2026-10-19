import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NumberPicker, NUMBER_PICKER_SPERRE_MS, NUMBER_PICKER_ZEITABLAUF_MS, type NumberPickerProps } from '../NumberPicker';

const texte = { titel: 'Rückennummer – Tor FC Nord', ohneNummer: 'ohne Nummer', andereNummer: 'Andere Nr.', uebernehmen: 'Übernehmen', eingabeLabel: 'Rückennummer' };
function setup(overrides: Partial<NumberPickerProps> = {}) {
  const props: NumberPickerProps = { isOpen: true, texte, ausloeserSeite: 'links', onWaehle: vi.fn(), onSchliesse: vi.fn(), testId: 'number-picker', ...overrides };
  render(<NumberPicker {...props} />);
  return props;
}
const ms = (n: number) => { act(() => { vi.advanceTimersByTime(n); }); };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('NumberPicker (Plan 3.2 / Altplan 3.2)', () => {
  it('ein Tipp auf 7 übernimmt die Nummer (nach der Sperre)', () => {
    const p = setup();
    ms(NUMBER_PICKER_SPERRE_MS);
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    expect(p.onWaehle).toHaveBeenCalledWith(7);
  });

  it('@SL-021 ein Tipp innerhalb von 300 ms nach dem Öffnen zählt nicht', () => {
    const p = setup();
    ms(NUMBER_PICKER_SPERRE_MS - 1);
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    expect(p.onWaehle).not.toHaveBeenCalled();
  });

  it.each<[string, () => void, string]>([
    ['Esc', () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); }, 'schliessen'],
    ['Zurück-Taste', () => { fireEvent(window, new PopStateEvent('popstate')); }, 'schliessen'],
    ['Tipp auf die Abdunkelung', () => { fireEvent.click(screen.getByTestId('number-picker-scrim')); }, 'abdunkelung'],
    ['10 s ohne Eingabe', () => { ms(NUMBER_PICKER_ZEITABLAUF_MS); }, 'zeitablauf'],
    ['„ohne Nummer“', () => { fireEvent.click(screen.getByRole('button', { name: 'ohne Nummer' })); }, 'ohneNummer'],
  ])('@SL-083 Schließen über %s meldet den Grund', (_weg, aktion, grund) => {
    const p = setup();
    ms(NUMBER_PICKER_SPERRE_MS);
    aktion();
    expect(p.onSchliesse).toHaveBeenCalledWith(grund);
    expect(p.onWaehle).not.toHaveBeenCalled();
  });

  it('@SL-020 „ohne Nummer“ liegt gegenüber dem auslösenden Knopf und ist kein Hauptknopf', () => {
    setup({ ausloeserSeite: 'links' });
    const ohne = screen.getByRole('button', { name: 'ohne Nummer' });
    expect(ohne.closest('[data-lage]')).toHaveAttribute('data-lage', 'rechts');
    expect(ohne.style.minHeight).toBe('var(--touch-target-minimum)');
  });

  it('„Andere Nr.“: Feld mit ≥ 16 px, inputmode numeric, nimmt nur 1–99', () => {
    const p = setup();
    ms(NUMBER_PICKER_SPERRE_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Andere Nr.' }));
    const feld = screen.getByLabelText('Rückennummer');
    expect(feld).toHaveAttribute('inputmode', 'numeric');
    expect((feld as HTMLInputElement).style.fontSize).toBe('var(--font-size-lg)');
    fireEvent.change(feld, { target: { value: '100' } });
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeDisabled();
    fireEvent.change(feld, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeDisabled();
    fireEvent.change(feld, { target: { value: '17' } });
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(p.onWaehle).toHaveBeenCalledWith(17);
  });

  it('Gegenbeispiel: eine Eingabe im Feld startet den 10-s-Zeitablauf neu', () => {
    const p = setup();
    ms(NUMBER_PICKER_SPERRE_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Andere Nr.' }));
    ms(9_000);
    fireEvent.change(screen.getByLabelText('Rückennummer'), { target: { value: '1' } });
    ms(9_000);
    expect(p.onSchliesse).not.toHaveBeenCalled();
  });

  it('@SL-083 der Zeitablauf greift auch, wenn der Elternteil jede Sekunde mit neuem Callback neu rendert', () => {
    const props: NumberPickerProps = { isOpen: true, texte, ausloeserSeite: 'links', onWaehle: vi.fn(), onSchliesse: vi.fn(), testId: 'number-picker' };
    const { rerender } = render(<NumberPicker {...props} />);
    const spaeter = vi.fn();
    for (let i = 0; i < 10; i++) {
      // der Elternteil übergibt bei jedem Takt eine neue Funktion; die zuletzt übergebene muss am Ende gerufen werden
      rerender(<NumberPicker {...props} onSchliesse={i === 9 ? spaeter : vi.fn()} />);
      ms(1000);
    }
    expect(spaeter).toHaveBeenCalledWith('zeitablauf');
  });

  it('@SL-037 keine Felder für Torvorlagen; Eigentor nur, wenn übergeben, oberhalb des Rasters', () => {
    setup({ eigentor: { label: 'Eigentor (SV Süd)', onWaehle: vi.fn() } });
    expect(screen.queryByText(/Vorlage|Assist/i)).toBeNull();
    const eigentor = screen.getByRole('button', { name: 'Eigentor (SV Süd)' });
    expect(eigentor.compareDocumentPosition(screen.getByRole('button', { name: '1' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Gegenbeispiel: ohne Eigentor-Prop kein Eigentor-Knopf', () => {
    setup();
    expect(screen.queryByRole('button', { name: /Eigentor/ })).toBeNull();
  });

  it('Der Baustein rendert auf DialogSurface (aria-modal)', () => {
    setup();
    expect(screen.getByTestId('number-picker')).toHaveAttribute('aria-modal', 'true');
  });

  it('geschlossen rendert nichts', () => {
    setup({ isOpen: false });
    expect(screen.queryByTestId('number-picker')).toBeNull();
  });

  describe('Tastatur-Modus', () => {
    it('@SL-153 Feld hat beim Öffnen den Fokus, „7“ + Eingabetaste übernimmt 7', () => {
      const p = setup({ tastatur: true });
      const feld = screen.getByLabelText('Rückennummer');
      expect(document.activeElement).toBe(feld);
      ms(NUMBER_PICKER_SPERRE_MS);
      fireEvent.change(feld, { target: { value: '7' } });
      fireEvent.keyDown(feld, { key: 'Enter' });
      expect(p.onWaehle).toHaveBeenCalledWith(7);
    });

    it('@SL-021 Tastatur: Eingabetaste innerhalb 300 ms zählt nicht', () => {
      const p = setup({ tastatur: true });
      const feld = screen.getByLabelText('Rückennummer');
      ms(NUMBER_PICKER_SPERRE_MS - 1);
      fireEvent.change(feld, { target: { value: '7' } });
      fireEvent.keyDown(feld, { key: 'Enter' });
      expect(p.onWaehle).not.toHaveBeenCalled();
    });

    it('Gegenbeispiel: Eingabetaste bei ungültiger Nummer (100) übernimmt nichts', () => {
      const p = setup({ tastatur: true });
      const feld = screen.getByLabelText('Rückennummer');
      ms(NUMBER_PICKER_SPERRE_MS);
      fireEvent.change(feld, { target: { value: '100' } });
      fireEvent.keyDown(feld, { key: 'Enter' });
      expect(p.onWaehle).not.toHaveBeenCalled();
    });

    it('@SL-083 Tastatur: Esc meldet „schliessen“', () => {
      const p = setup({ tastatur: true });
      ms(NUMBER_PICKER_SPERRE_MS);
      fireEvent.keyDown(screen.getByLabelText('Rückennummer'), { key: 'Escape' });
      expect(p.onSchliesse).toHaveBeenCalledWith('schliessen');
      expect(p.onWaehle).not.toHaveBeenCalled();
    });

    it('Gegenbeispiel: ohne tastatur ist kein Feld fokussiert und „Andere Nr.“ zu', () => {
      setup();
      expect(document.activeElement?.tagName).not.toBe('INPUT');
      expect(screen.queryByLabelText('Rückennummer')).toBeNull();
      expect(screen.getByRole('button', { name: 'Andere Nr.' })).toBeInTheDocument();
    });
  });
});
