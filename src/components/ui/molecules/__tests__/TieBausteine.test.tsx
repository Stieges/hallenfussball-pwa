/**
 * Paket TB-B, Task TB-6b/c/d: Bausteine der Gleichstands-Oberfläche (TieMarker, ShootoutScoreInput, OrderPicker,
 * PlacesToPlayOutPicker). Aus dem Gherkin: @W2A-061 (Feldmeldung, kein Sieger), @W2A-044 (Reihenfolge von drei Teams),
 * @W2A-047/@ET-025 (Marke mit Symbol und Wort), @W2A-066/@W2A-073 (angebotene Plätze, jeder an- und abhakbar, auch Platz 1).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TieMarker } from '../TieMarker';
import { ShootoutScoreInput } from '../ShootoutScoreInput';
import { OrderPicker } from '../OrderPicker';
import { PlacesToPlayOutPicker } from '../PlacesToPlayOutPicker';

describe('TieMarker (@ET-025, Daniel G5: Symbol und Wort, Farbe nie allein)', () => {
  it('zeigt das Wort, trägt Ton und Art, das Symbol ist für Bildschirmleser verborgen', () => {
    render(<TieMarker tone="warn" symbol="warn" data-kind="need">Strafstoßschießen nötig</TieMarker>);
    const marker = screen.getByTestId('tie-marker');
    expect(marker).toHaveTextContent('Strafstoßschießen nötig');
    expect(marker).toHaveAttribute('data-tone', 'warn');
    expect(marker).toHaveAttribute('data-kind', 'need');
    expect(marker.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('Gegenbeispiel: eine entschiedene Marke hat den Ton done und ein anderes Symbol', () => {
    const { container } = render(<><TieMarker tone="warn" symbol="warn">A</TieMarker><TieMarker tone="done" symbol="equal">B</TieMarker></>);
    const [warn, done] = Array.from(container.querySelectorAll('[data-testid="tie-marker"]'));
    expect(done).toHaveAttribute('data-tone', 'done');
    expect(done.querySelector('svg')?.innerHTML).not.toBe(warn.querySelector('svg')?.innerHTML);
  });
});

describe('ShootoutScoreInput (@W2A-061: ohne Sieger übernimmt die App nichts, die Meldung steht am Feld)', () => {
  const sides = [{ id: 'd', name: 'DJK Otting' }, { id: 'p', name: 'TSV Petting' }] as const;

  it('zwei beschriftete Felder (Name + Treffer), nur Ziffern werden angenommen', () => {
    const onChange = vi.fn();
    render(<ShootoutScoreInput legend="Ergebnis des Strafstoßschießens" hitsLabel="Treffer" sides={sides} values={['4', '3']} onChange={onChange} />);
    expect(screen.getByLabelText(/DJK Otting/)).toHaveValue('4');
    expect(screen.getByLabelText(/TSV Petting/)).toHaveValue('3');
    fireEvent.change(screen.getByTestId('tie-shootout-score-0'), { target: { value: 'a5x' } });
    expect(onChange).toHaveBeenCalledWith(0, '5'); // Gegenbeispiel: Buchstaben fallen weg
  });

  it('mit Fehler: Meldung als Alarm am Feld, beide Felder ungültig und mit der Meldung verbunden; Gegenbeispiel ohne Fehler', () => {
    const { rerender } = render(<ShootoutScoreInput legend="L" hitsLabel="Treffer" sides={sides} values={['4', '4']} onChange={vi.fn()} error="Das Strafstoßschießen braucht einen Sieger." />);
    expect(screen.getByRole('alert')).toHaveTextContent('braucht einen Sieger');
    for (const index of [0, 1]) {
      const field = screen.getByTestId(`tie-shootout-score-${String(index)}`);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    }
    rerender(<ShootoutScoreInput legend="L" hitsLabel="Treffer" sides={sides} values={['4', '3']} onChange={vi.fn()} hint="Der Sieger steht vorn." />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('tie-shootout-score-0')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByText('Der Sieger steht vorn.')).toBeInTheDocument();
  });
});

describe('OrderPicker (@W2A-044: Reihenfolge von drei Teams mit Pfeiltasten)', () => {
  const items = [{ id: 'u', label: 'VfB Ufer' }, { id: 'w', label: 'TSV West' }, { id: 'o', label: 'SC Ost' }];
  const labels = { moveUpLabel: (n: string) => `${n} nach oben`, moveDownLabel: (n: string) => `${n} nach unten` };

  it('zeigt Platzziffern ab dem ersten Platz des Blocks; erste Zeile ohne „nach oben“, letzte ohne „nach unten“', () => {
    render(<OrderPicker legend="Reihenfolge" items={items} firstPlace={3} onMove={vi.fn()} {...labels} />);
    expect(screen.getByTestId('tie-order-row-u')).toHaveTextContent('3. VfB Ufer');
    expect(screen.getByTestId('tie-order-row-o')).toHaveTextContent('5. SC Ost');
    expect(screen.getByTestId('tie-order-up-u')).toBeDisabled();
    expect(screen.getByTestId('tie-order-down-o')).toBeDisabled();
    expect(screen.getByTestId('tie-order-down-u')).toBeEnabled(); // Gegenbeispiel: mittlere Tasten sind frei
    expect(screen.getByTestId('tie-order-up-o')).toBeEnabled();
  });

  it('eine Taste ruft onMove mit Zeile und Richtung; Tasten haben Namen mit dem Team', () => {
    const onMove = vi.fn();
    render(<OrderPicker legend="Reihenfolge" items={items} firstPlace={3} onMove={onMove} {...labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'TSV West nach oben' }));
    expect(onMove).toHaveBeenCalledWith(1, -1);
    fireEvent.click(screen.getByTestId('tie-order-down-u'));
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });
});

describe('PlacesToPlayOutPicker (@W2A-066, @W2A-073)', () => {
  const props = { placeLabel: (p: number) => `Platz ${String(p)}`, legend: 'Auszuspielende Plätze' };

  it('bietet genau die angebotenen Plätze an (Gegenbeispiel: bei 5 Teams kein Platz 6), die Auswahl ist angehakt', () => {
    render(<PlacesToPlayOutPicker {...props} places={[1, 2, 3, 4, 5]} selected={[1]} onChange={vi.fn()} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(screen.queryByTestId('playout-place-6')).toBeNull();
    expect(screen.getByTestId('playout-place-1')).toBeChecked();
    expect(screen.getByTestId('playout-place-2')).not.toBeChecked();
    expect(screen.getByLabelText('Platz 3')).toBeInTheDocument();
  });

  it('Platz 3 anhaken ergibt [1, 3] aufsteigend; Platz 1 abhaken ergibt [] (auch Platz 1 ist abwählbar)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<PlacesToPlayOutPicker {...props} places={[1, 2, 3]} selected={[1]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('playout-place-3'));
    expect(onChange).toHaveBeenLastCalledWith([1, 3]);
    rerender(<PlacesToPlayOutPicker {...props} places={[1, 2, 3]} selected={[3]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('playout-place-1'));
    expect(onChange).toHaveBeenLastCalledWith([1, 3]); // Gegenbeispiel: anhaken sortiert, es verdrängt nichts
    rerender(<PlacesToPlayOutPicker {...props} places={[1, 2, 3]} selected={[1]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('playout-place-1'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('gesperrt: nichts lässt sich ändern', () => {
    const onChange = vi.fn();
    render(<PlacesToPlayOutPicker {...props} places={[1, 2]} selected={[1]} onChange={onChange} disabled />);
    expect(screen.getByTestId('playout-place-2')).toBeDisabled();
  });
});
