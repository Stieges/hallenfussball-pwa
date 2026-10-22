/**
 * Zahlknöpfe (A-18a, S-1): vier gleichwertige Knöpfe, ein Tipp wählt, keiner ist hervorgehoben.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberChoiceRow } from '../NumberChoiceRow';
import { SegmentedChoice } from '../SegmentedChoice';

describe('NumberChoiceRow', () => {
  const setup = (over: Partial<Parameters<typeof NumberChoiceRow>[0]> = {}) => {
    const onChoose = vi.fn();
    render(<NumberChoiceRow legend="Welche Zahl?" values={[19, 47, 63, 82]} onChoose={onChoose} valueLabel={(n) => `Zahl ${n}`} testId="nums" {...over} />);
    return onChoose;
  };

  it('zeigt jede Zahl als Knopf in der gelieferten Reihenfolge, Knopf spricht „Zahl 47“', () => {
    setup();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['19', '47', '63', '82']);
    expect(screen.getByRole('button', { name: 'Zahl 47' })).toBeInTheDocument();
  });

  it('ein Tipp wählt genau diese Zahl', async () => {
    const onChoose = setup();
    await userEvent.click(screen.getByTestId('nums-63'));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(63);
  });

  it('Touch-Ziel: jeder Knopf mindestens so hoch wie touchTargets.primary (56 px)', () => {
    setup();
    screen.getAllByRole('button').forEach((b) => expect(b.style.minHeight).toContain('touch-target'));
  });

  it('Gegenbeispiel: gesperrt löst nichts aus', async () => {
    const onChoose = setup({ disabled: true });
    await userEvent.click(screen.getByTestId('nums-19'));
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe('SegmentedChoice', () => {
  const options = [{ value: '1', label: 'Feld 1' }, { value: '2', label: 'Feld 2' }, { value: 'none', label: 'Ohne Feld' }] as const;

  it('genau eine Möglichkeit ist gewählt; die Wahl trägt ein Häkchen, nicht nur Farbe', () => {
    render(<SegmentedChoice legend="Feld" options={options} value="2" onChange={vi.fn()} testId="seg" />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios[1]?.querySelector('svg')).not.toBeNull();
    expect(radios[0]?.querySelector('svg')).toBeNull();
  });

  it('ein Tipp meldet den Wert', async () => {
    const onChange = vi.fn();
    render(<SegmentedChoice legend="Feld" options={options} value="1" onChange={onChange} testId="seg" />);
    await userEvent.click(screen.getByTestId('seg-none'));
    expect(onChange).toHaveBeenCalledWith('none');
  });
});
