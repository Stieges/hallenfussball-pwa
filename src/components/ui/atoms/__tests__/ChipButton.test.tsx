/**
 * ChipButton: ein wählbarer Chip (Baustein für ChipChoice, Gruppen-Auswahl und Filter-Blatt der Zuschauer-Seite, @OB-022).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChipButton } from '../ChipButton';

describe('ChipButton', () => {
  it('meldet das Antippen und trägt aria-pressed', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ChipButton selected={false} onClick={onClick} data-testid="c">Beendet</ChipButton>);
    expect(screen.getByTestId('c')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByTestId('c'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ChipButton selected onClick={onClick} data-testid="c">Beendet</ChipButton>);
    expect(screen.getByTestId('c')).toHaveAttribute('aria-pressed', 'true');
  });

  it('look „tint“: nur der gewählte Chip trägt ein Häkchen (die Wahl steht nie nur in der Farbe)', () => {
    const { rerender } = render(<ChipButton selected onClick={vi.fn()} data-testid="c">A</ChipButton>);
    expect(screen.getByTestId('c').querySelector('svg')).not.toBeNull();
    rerender(<ChipButton selected={false} onClick={vi.fn()} data-testid="c">A</ChipButton>);
    expect(screen.getByTestId('c').querySelector('svg')).toBeNull();
  });

  it('look „fill“: kein Häkchen, gewählt fett und in der Hauptfarbe gefüllt', () => {
    render(<ChipButton look="fill" selected onClick={vi.fn()} data-testid="c">A</ChipButton>);
    const chip = screen.getByTestId('c');
    expect(chip.querySelector('svg')).toBeNull();
    expect(chip.style.background).toContain('--color-primary');
    expect(chip.style.fontWeight).toContain('--font-weight-bold');
  });

  it('Tippfläche: Vorgabe 48, „minimum“ 44 Bildpunkte (Token), Rundung „full“', () => {
    const { rerender } = render(<ChipButton selected={false} onClick={vi.fn()} data-testid="c">A</ChipButton>);
    expect(screen.getByTestId('c').style.minHeight).toContain('--touch-target-comfortable');
    rerender(<ChipButton size="minimum" radius="full" selected={false} onClick={vi.fn()} data-testid="c">A</ChipButton>);
    expect(screen.getByTestId('c').style.minHeight).toContain('--touch-target-minimum');
    expect(screen.getByTestId('c').style.minWidth).toContain('--touch-target-minimum');
    expect(screen.getByTestId('c').style.borderRadius).toContain('--border-radius-full');
  });
});
