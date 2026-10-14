/**
 * TeamNameDisplay in Größe xl (B-17 Fixrunde, @ZM-087): der volle Name steht im angezeigten Text, ohne Kürzel
 * und ohne „…“. Gegenbeispiel: die Kürzel (SFNS, GÜFÖ) erscheinen nur, wenn der volle Name nicht passt
 * (das prüft die Playwright-Spec mit echter Messung).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamNameDisplay } from '../TeamNameDisplay';

const LANGER = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';

describe('TeamNameDisplay xl – voller Name (@ZM-087)', () => {
  it('zeigt einen 50-Zeichen-Namen mit Umlauten und ß vollständig, ohne „…“', () => {
    render(<TeamNameDisplay name={LANGER} size="xl" />);
    const el = screen.getByText(LANGER);
    expect(el.textContent).toBe(LANGER);
    expect(el.textContent).not.toContain('…');
  });

  it('zeigt einen mittellangen Namen vollständig (kein Initialen-Kürzel)', () => {
    render(<TeamNameDisplay name="Sportfreunde Lotte" size="xl" />);
    expect(screen.getByText('Sportfreunde Lotte')).toBeInTheDocument();
  });
});
