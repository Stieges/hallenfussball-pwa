/**
 * Aufgabe 1.1 (Spielanzeige), Fixrunde A1: das Live-Rot gehört nur dem Abzeichen. Der Fortschrittsbalken am Monitor
 * bleibt wie vor 1.1 (Grün → Grün), @OB-039.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MatchTimer } from '../MatchTimer';
import { monitorThemes } from '../../../design-tokens';
import { contrastRatio, MIN_TEXT_CONTRAST } from '../../../test/contrast';

const THEMES = ['dark', 'light'] as const;

function barBackground(theme: 'dark' | 'light'): string {
  const { container } = render(<MatchTimer elapsedSeconds={180} durationSeconds={360} status="PAUSED" timerElapsedSeconds={180} size="xl" theme={theme} />);
  const bar = Array.from(container.querySelectorAll<HTMLElement>('div')).find((el) => el.style.background.includes('linear-gradient'));
  expect(bar, 'Fortschrittsbalken gefunden').toBeDefined();
  return bar?.style.background ?? '';
}

describe('@OB-039 Fortschrittsbalken nutzt nicht das Live-Rot', () => {
  it.each(THEMES)('Monitor-Theme %s: der Verlauf enthält weder Live-Rot noch die Live-Fläche des Abzeichens', (theme) => {
    const background = barBackground(theme).toLowerCase();
    const colors = monitorThemes[theme];
    expect(background).not.toContain(colors.liveBadgeFill.toLowerCase());
    expect(background).not.toContain('251, 113, 133');
    expect(background).not.toContain('190, 18, 60');
  });

  it.each(THEMES)('Monitor-Theme %s: der Balken läuft wie vor 1.1 von progressBar nach grün (liveBadgeText)', (theme) => {
    const colors = monitorThemes[theme];
    expect(colors.liveBadgeText.toLowerCase()).toBe(theme === 'dark' ? '#00e676' : '#047857');
    expect(colors.liveBadgeFill.toLowerCase()).not.toBe(colors.liveBadgeText.toLowerCase());
  });

  it.each(THEMES)('@OB-066 Monitor-Theme %s: Schrift auf der Live-Fläche ≥ 4,5 : 1', (theme) => {
    const colors = monitorThemes[theme];
    expect(contrastRatio(colors.liveBadgeOn, colors.liveBadgeFill)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
