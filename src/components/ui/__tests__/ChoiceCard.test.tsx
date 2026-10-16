/**
 * B-28 C8 – Wahlkarte (fachfreies Molekül): Radio-Rolle, Auswahl, ausgegraut mit Grund, Touch-Mindesthöhe aus dem Token.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChoiceCard } from '../molecules';

const base = { title: 'Spielplan', description: 'Alle Spiele.', icon: <span>i</span>, selected: false, onSelect: vi.fn(), 'data-testid': 'karte' };

describe('ChoiceCard', () => {
  it('Radio mit Titel und Beschreibung; Klick wählt', () => {
    const onSelect = vi.fn();
    render(<ChoiceCard {...base} onSelect={onSelect} />);

    expect(screen.getByRole('radio', { name: /Spielplan/ })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('karte'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('gewählt: aria-checked true', () => {
    render(<ChoiceCard {...base} selected />);

    expect(screen.getByTestId('karte')).toHaveAttribute('aria-checked', 'true');
  });

  it('Gegenbeispiel ausgegraut: nennt den Grund, wählt nie, auch wenn selected gesetzt ist', () => {
    const onSelect = vi.fn();
    render(<ChoiceCard {...base} selected disabled reason="Erst nach dem Abschluss" onSelect={onSelect} />);

    expect(screen.getByTestId('karte-reason')).toHaveTextContent('Erst nach dem Abschluss');
    expect(screen.getByTestId('karte')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('karte'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel nicht ausgegraut: der Grund erscheint nicht', () => {
    render(<ChoiceCard {...base} reason="Erst nach dem Abschluss" />);

    expect(screen.queryByTestId('karte-reason')).toBeNull();
  });

  it('Mindesthöhe kommt aus dem Touch-Token (≥ 44 px, primär 56 px)', () => {
    render(<ChoiceCard {...base} />);

    expect(screen.getByTestId('karte').style.minHeight).toBe('var(--touch-target-primary)');
  });

  it('gewählt: innerer Schatten in Rahmenstärke aus Token, nicht gewählt und ausgegraut: keiner (VISUAL-DESIGN § 9)', () => {
    const { rerender } = render(<ChoiceCard {...base} selected />);
    expect(screen.getByTestId('karte').style.boxShadow).toContain('inset');

    rerender(<ChoiceCard {...base} />);
    expect(screen.getByTestId('karte').style.boxShadow).not.toContain('inset');

    rerender(<ChoiceCard {...base} selected disabled />);
    expect(screen.getByTestId('karte').style.boxShadow).not.toContain('inset');
  });
});
