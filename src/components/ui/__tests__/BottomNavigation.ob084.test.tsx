/**
 * @OB-084 Die untere Navigation der Turnierverwaltung ist deckend (Befund C-VERWALTUNG-NAV-DURCHSCHEINEND): `surface` ist im dunklen Thema
 * nur 5 % Weiß, Inhalt dahinter schien durch und senkte den Kontrast der Beschriftung. Gegenbeispiel: der aktive Reiter ist nicht nur an der Farbe
 * zu erkennen (Rand oben, `aria-current`).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cssVars } from '../../../design-tokens';
import { BottomNavigation } from '../BottomNavigation';

describe('@OB-084 BottomNavigation der Verwaltung', () => {
  it('@OB-084 die Leiste hat eine deckende Fläche (surfaceSolid), nie die halbdurchsichtige surface', () => {
    const { container } = render(<BottomNavigation activeTab="schedule" onTabChange={() => undefined} />);
    const nav = container.querySelector('nav');
    expect(nav?.style.background).toBe(cssVars.colors.surfaceSolid);
    expect(nav?.style.background).not.toBe(cssVars.colors.surface);
  });

  it('@OB-084 Gegenbeispiel: der aktive Reiter trägt Rand und aria-current, nicht nur die Farbe', () => {
    render(<BottomNavigation activeTab="schedule" onTabChange={() => undefined} />);
    const aktiv = screen.getByTestId('bottom-nav-schedule');
    const andere = screen.getByTestId('bottom-nav-tabellen');
    expect(aktiv).toHaveAttribute('aria-current', 'page');
    expect(andere).not.toHaveAttribute('aria-current');
    expect(aktiv.style.borderTop).toContain(cssVars.colors.primary);
    expect(andere.style.borderTop).toContain('transparent');
  });
});
