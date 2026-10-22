/**
 * Zahlknöpfe (A-18a, S-1): vier gleichwertige Knöpfe, ein Tipp wählt, keiner ist hervorgehoben.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
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

  it('genau eine Möglichkeit ist gewählt; die Wahl steht nicht nur in der Farbe: gefüllt und fett, die anderen leer und normal', () => {
    render(<SegmentedChoice legend="Feld" options={options} value="2" onChange={vi.fn()} testId="seg" />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios[1]?.style.fontWeight).toContain('bold');
    expect(radios[0]?.style.fontWeight).not.toContain('bold');
    expect(radios[1]?.style.background).not.toBe(radios[0]?.style.background);
  });

  it('ab fünf Möglichkeiten stehen sie einzeln und umbrechend statt verbunden (Beschriftungen werden nie gekürzt)', () => {
    const many = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: `Feld ${v}` }));
    render(<SegmentedChoice legend="Feld" options={many} value="1" onChange={vi.fn()} testId="seg" />);
    expect(screen.getByRole('radiogroup').style.flexWrap).toBe('wrap');
  });

  it('ein Tipp meldet den Wert', async () => {
    const onChange = vi.fn();
    render(<SegmentedChoice legend="Feld" options={options} value="1" onChange={onChange} testId="seg" />);
    await userEvent.click(screen.getByTestId('seg-none'));
    expect(onChange).toHaveBeenCalledWith('none');
  });

  describe('Tastatur (Radiogroup-Muster, Review N-9)', () => {
    const three = [{ value: '1', label: 'Feld 1' }, { value: '2', label: 'Feld 2' }, { value: 'none', label: 'Ohne Feld' }] as const;
    function Harness({ start }: { start: string }) {
      const [value, setValue] = useState(start);
      return <SegmentedChoice legend="Feld" options={three} value={value} onChange={setValue} testId="seg" />;
    }

    it('ein Tab-Stopp für die Gruppe: nur der gewählte Knopf ist per Tab erreichbar', () => {
      render(<Harness start="2" />);
      expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    });

    it('Pfeil rechts/links wählt den nächsten/vorherigen und holt den Fokus, am Rand rundum', async () => {
      render(<Harness start="2" />);
      const user = userEvent.setup();
      screen.getByTestId('seg-2').focus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByTestId('seg-none')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('seg-none')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByTestId('seg-1')).toHaveAttribute('aria-checked', 'true');
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByTestId('seg-none')).toHaveAttribute('aria-checked', 'true');
    });

    it('Pos1 und Ende wählen den ersten und letzten', async () => {
      render(<Harness start="2" />);
      const user = userEvent.setup();
      screen.getByTestId('seg-2').focus();
      await user.keyboard('{End}');
      expect(screen.getByTestId('seg-none')).toHaveAttribute('aria-checked', 'true');
      await user.keyboard('{Home}');
      expect(screen.getByTestId('seg-1')).toHaveAttribute('aria-checked', 'true');
    });

    it('Gegenbeispiel: gesperrt ändert die Pfeiltaste nichts; andere Tasten ändern nichts', async () => {
      const onChange = vi.fn();
      render(<SegmentedChoice legend="Feld" options={three} value="2" onChange={onChange} disabled testId="seg" />);
      const user = userEvent.setup();
      screen.getByTestId('seg-2').focus();
      await user.keyboard('{ArrowRight}');
      expect(onChange).not.toHaveBeenCalled();
      const free = vi.fn();
      render(<SegmentedChoice legend="Feld2" options={three} value="2" onChange={free} testId="seg2" />);
      screen.getByTestId('seg2-2').focus();
      await user.keyboard('a');
      expect(free).not.toHaveBeenCalled();
    });
  });
});
