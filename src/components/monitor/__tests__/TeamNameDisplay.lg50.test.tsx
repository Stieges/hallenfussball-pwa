/**
 * MS1 / W3 – TeamNameDisplay in Größe `lg`: ein 50-Zeichen-Name steht als Text vollständig und ohne „…“
 * (B-06: aus dem Test der gelöschten Verwaltungs-Vorschau hierher umgezogen; die Komponente lebt am Monitor).
 * Prüft nur den Text. Ob die Namenszeile in Größe lg überläuft, misst jsdom nicht; das ist Befund
 * C-MONITOR-NAMENSZEILE-LG (BEFUNDE-HEUTIGER-CODE.md), nicht Teil dieses Tests.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamNameDisplay } from '../TeamNameDisplay';

/** 50 Zeichen, kein Listenwort (wie in @ZM-087 die Länge, die am Monitor vollständig bleibt). */
const LANG_50 = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';

describe('W3 Größe lg – 50-Zeichen-Name als Text vollständig, ohne „…“', () => {
  it('TeamNameDisplay size="lg": der Text ist vollständig (kein Überlauf geprüft, siehe Befund C-MONITOR-NAMENSZEILE-LG)', () => {
    expect(LANG_50).toHaveLength(50);
    render(<TeamNameDisplay name={LANG_50} size="lg" />);
    const el = screen.getByText(LANG_50);
    expect(el.textContent).toBe(LANG_50);
    expect(el.textContent).not.toContain('…');
    expect(el.style.textOverflow).not.toBe('ellipsis');
  });
});
