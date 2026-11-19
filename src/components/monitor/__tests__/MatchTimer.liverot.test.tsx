/**
 * Aufgabe 1.1 (Spielanzeige), Fixrunde A1: das Live-Rot gehört nur dem Abzeichen. Der Zeitbalken am Monitor ist seit R5 PR 2
 * der gemeinsame `ZeitBalken` der Tafel (@ZM-166: grün, grau, gedämpft, violett – nie Rot); früher ein Verlauf grün → grün. Seit @ZM-215 trägt er die Farben
 * `displayBar` (auf die Bahn abgestimmt, wie im Profil „Halle (sehr fern)“) statt der Tafel-Farben.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchTimer } from '../MatchTimer';
import { displayBar, monitorThemes } from '../../../design-tokens';
import { contrastRatio, MIN_TEXT_CONTRAST } from '../../../test/contrast';

const THEMES = ['dark', 'light'] as const;

function barBackground(theme: 'dark' | 'light'): string {
  render(<MatchTimer elapsedSeconds={180} durationSeconds={360} status="PAUSED" timerElapsedSeconds={180} size="xl" theme={theme} />);
  const fuellung = screen.getByTestId('monitor-zeitbalken').querySelector<HTMLElement>('div');
  expect(fuellung, 'Zeitbalken gefunden').not.toBeNull();
  return fuellung?.style.background ?? '';
}

describe('@OB-039 Fortschrittsbalken nutzt nicht das Live-Rot', () => {
  it.each(THEMES)('Monitor-Theme %s: der Verlauf enthält weder Live-Rot noch die Live-Fläche des Abzeichens', (theme) => {
    const background = barBackground(theme).toLowerCase();
    const colors = monitorThemes[theme];
    expect(background).not.toContain(colors.liveBadgeFill.toLowerCase());
    expect(background).not.toContain('251, 113, 133');
    expect(background).not.toContain('190, 18, 60');
  });

  it.each(THEMES)('Monitor-Theme %s: der Balken trägt den Ton des Zustands aus den Balken-Tokens (angehalten: grau), nie die Live-Farben', (theme) => {
    const background = barBackground(theme);
    const erwartet = displayBar.colors[theme].grau.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(erwartet.slice(i, i + 2), 16));
    expect(background).toBe(`rgb(${String(r)}, ${String(g)}, ${String(b)})`);
    expect(monitorThemes[theme].liveBadgeFill.toLowerCase()).not.toBe(background.toLowerCase());
  });

  it.each(THEMES)('@OB-066 Monitor-Theme %s: Schrift auf der Live-Fläche ≥ 4,5 : 1', (theme) => {
    const colors = monitorThemes[theme];
    expect(contrastRatio(colors.liveBadgeOn, colors.liveBadgeFill)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
