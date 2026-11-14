/**
 * @ZM-167 Am Monitor steht das Live-Abzeichen kompakt links in der Kopfzeile, dunkelrot (Rose 800) mit weißer Schrift (mindestens 7 : 1), mit weißem Punkt davor ·
 * @ZM-168 Gegenbeispiel: auf dem Handy (Zuschauer-Seite) und in der Verwaltung bleibt das Abzeichen im bisherigen Live-Rot.
 * Grund des neuen Tests: der alte Test bestätigte nur „Hintergrund = Token“ und „Breite = feste Spaltenbreite“ und fing deshalb weder das hellrosa Abzeichen mit
 * schwarzer Schrift noch den auf Spaltenbreite gezogenen Balken. Die gerenderte Breite (nur so breit wie das Wort) misst `tests/e2e/monitor-live-abzeichen-zm167.spec.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../test/realDeI18n';
import { LiveHeader } from '../LiveHeader';
import { MatchStatusBadge } from '../../ui/molecules/MatchStatusBadge';
import { monitorBadgeTone } from '../../ui/molecules/matchStatusBadgeStyle';
import { contrastRatio } from '../../../test/contrast';
import { cssVars, monitorThemes } from '../../../design-tokens';
import { palette } from '../../../design-tokens/colors/palette';

await initRealDeI18n();

const ROSE_800 = '#9F1239';

describe.each(['dark', 'light'] as const)('@ZM-167 Live-Abzeichen am Monitor (%s)', (thema) => {
  const farben = monitorThemes[thema];

  it('der Farbton ist Rose 800 aus dem Farbsystem (Eintrag der Palette), die Schrift weiß: mindestens 7 : 1', () => {
    expect(palette.special.liveMonitor.toLowerCase()).toBe(ROSE_800.toLowerCase());
    expect(farben.liveBadgeFill.toLowerCase()).toBe(ROSE_800.toLowerCase());
    expect(farben.liveBadgeOn.toLowerCase()).toBe('#ffffff');
    expect(contrastRatio(farben.liveBadgeOn, farben.liveBadgeFill)).toBeGreaterThanOrEqual(7);
  });

  it('Gegenbeispiel: das bisherige hellrosa Rose 400 mit schwarzer Schrift ist es nicht mehr', () => {
    expect(farben.liveBadgeFill.toLowerCase()).not.toBe('#fb7185');
    expect(farben.liveBadgeOn.toLowerCase()).not.toBe('#000000');
  });

  it('die Kopfzeile trägt „Live“ links, ohne feste Spaltenbreite: weder die Spalte noch das Abzeichen sind auf eine Breite gesetzt', () => {
    render(<LiveHeader badge={{ kind: 'badge', state: 'live' }} field={1} matchNumber={7} size="xl" themeColors={farben} />);
    const spalte = screen.getByTestId('live-badge');
    const abzeichen = screen.getByTestId('match-status-badge');
    expect(abzeichen).toHaveTextContent('Live');
    expect(spalte.style.justifySelf).toBe('start');
    expect(spalte.style.width).toBe('');
    expect(abzeichen.style.width).toBe('');
    expect(abzeichen.style.background).toBe('rgb(159, 18, 57)');
    expect(abzeichen.style.color).toBe('rgb(255, 255, 255)');
  });

  it('der Punkt davor ist weiß und pulsiert (Animation gesetzt; bei „Bewegung reduzieren“ nimmt die globale Regel sie weg)', () => {
    render(<LiveHeader badge={{ kind: 'badge', state: 'live' }} field={1} matchNumber={7} size="xl" themeColors={farben} />);
    const punkt = screen.getByTestId('match-status-badge-dot');
    expect(punkt.style.background).toBe('rgb(255, 255, 255)');
    expect(punkt.style.animation).not.toBe('');
  });
});

describe('@ZM-168 außerhalb des Monitors bleibt das Abzeichen „Live“ im bisherigen Live-Rot', () => {
  it('ohne Monitor-Ton (Zuschauer-Seite, Verwaltung) gilt das Token statusLive, nicht Rose 800', () => {
    render(<MatchStatusBadge model={{ kind: 'badge', state: 'live' }} size="card" />);
    const abzeichen = screen.getByTestId('match-status-badge');
    expect(abzeichen.style.background).toBe(cssVars.colors.statusLive);
    expect(abzeichen.style.color).toBe(cssVars.colors.statusLiveOn);
    expect(abzeichen.style.background).not.toBe('rgb(159, 18, 57)');
  });

  it('mit Monitor-Ton ist es Rose 800 (derselbe Baustein, nur der Ton unterscheidet)', () => {
    render(<MatchStatusBadge model={{ kind: 'badge', state: 'live' }} size="zeile" tone={monitorBadgeTone(monitorThemes.dark)} />);
    expect(screen.getByTestId('match-status-badge').style.background).toBe('rgb(159, 18, 57)');
  });
});
