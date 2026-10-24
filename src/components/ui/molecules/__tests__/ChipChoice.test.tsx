/**
 * ChipChoice: fachfreie Chip-Reihe (Mockup „Altersklasse“ B2).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChipChoice } from '../ChipChoice';

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];

describe('ChipChoice', () => {
  it('der gewählte Chip trägt aria-pressed und ein Häkchen, die anderen nicht', () => {
    render(<ChipChoice legend="Wahl" options={options} value="b" onSelect={vi.fn()} testId="cc" />);
    expect(screen.getByTestId('cc-b')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('cc-b').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('cc-a')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('cc-a').querySelector('svg')).toBeNull();
  });

  it('Gegenbeispiel: ohne Wert (null) oder mit unbekanntem Wert ist nichts gewählt', () => {
    const { rerender } = render(<ChipChoice legend="Wahl" options={options} value={null} onSelect={vi.fn()} testId="cc" />);
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    rerender(<ChipChoice legend="Wahl" options={options} value="zzz" onSelect={vi.fn()} testId="cc" />);
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('Klick meldet den Wert, auch beim erneuten Antippen des gewählten Chips', () => {
    const onSelect = vi.fn();
    render(<ChipChoice legend="Wahl" options={options} value="b" onSelect={onSelect} testId="cc" />);
    fireEvent.click(screen.getByTestId('cc-c'));
    fireEvent.click(screen.getByTestId('cc-b'));
    expect(onSelect.mock.calls).toEqual([['c'], ['b']]);
  });

  it('Tastatur: Tab erreicht jeden Chip, Enter und Leertaste wählen', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ChipChoice legend="Wahl" options={options} value={null} onSelect={onSelect} testId="cc" />);
    await user.tab();
    expect(screen.getByTestId('cc-a')).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId('cc-b')).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onSelect.mock.calls).toEqual([['b'], ['b']]);
  });

  it('jeder Chip ist mindestens so breit wie ein Touch-Ziel (Token)', () => {
    render(<ChipChoice legend="Wahl" options={options} value={null} onSelect={vi.fn()} testId="cc" />);
    expect(screen.getByTestId('cc-a').style.minWidth).toBe('var(--touch-target-comfortable)');
    expect(screen.getByTestId('cc-a').style.minHeight).toBe('var(--touch-target-comfortable)');
  });
});
