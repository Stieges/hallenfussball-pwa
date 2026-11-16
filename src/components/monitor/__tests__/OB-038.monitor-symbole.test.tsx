/**
 * @OB-038 „den Monitor bei ‚kein Spiel‘ und beim Tor“ → gezeichnete Symbole (Pause, Ball), kein Emoji;
 * Größen aus den Monitor-Tokens. Die Plätze auf der Sponsor-Folie stehen in `SponsorSlide.platzring.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoMatchDisplay } from '../NoMatchDisplay';
import { GoalAnimation } from '../GoalAnimation';
import { MatchIcons } from '../../ui/IconsMatch';
import { MonitorIcons } from '../../ui/IconsMonitor';
import { displayNoMatch } from '../../../design-tokens';
import { OHNE_EMOJI } from '../../../test/symbolText';
import type { GoalEventInfo } from '../../../hooks/useLiveMatches';

const zeichnung = (el: Element | null): string => el?.querySelector('svg')?.innerHTML ?? '';
const erwartet = (Symbol: (p: { size?: number | string }) => React.ReactElement): string => {
  const { container, unmount } = render(<Symbol />);
  const d = container.querySelector('svg')!.innerHTML;
  unmount();
  return d;
};

describe('@OB-038 Monitor bei „kein Spiel“', () => {
  it('das kräftige Monitor-Pause-Symbol steht statt des Emoji, in der Größe des Tokens und in voller Textfarbe (nicht gedämpft)', () => {
    const { container } = render(<NoMatchDisplay size="xl" />);
    const symbol = screen.getByTestId('no-match-icon');
    expect(zeichnung(symbol)).toBe(erwartet(MonitorIcons.Pause));
    expect(zeichnung(symbol)).not.toBe(erwartet(MatchIcons.Pause));
    expect(symbol.style.opacity).toBe('');
    expect(symbol.querySelector('svg')!.getAttribute('width')).toBe(displayNoMatch.xl.icon);
    expect(container.textContent).not.toMatch(OHNE_EMOJI);
  });
});

describe('@OB-038 Monitor beim Tor', () => {
  it('die Grafik des Balls (Noto Emoji) steht statt des Emoji-Zeichens, ohne id und clipPath; Text und Stand bleiben', async () => {
    const tor: GoalEventInfo = { matchId: 'm1', teamId: 'a', teamName: 'VfB Ufer', side: 'home', timestamp: Date.now(), newScore: { home: 1, away: 0 } };
    const { container } = render(<GoalAnimation goalEvent={tor} onAnimationComplete={vi.fn()} />);
    expect(await screen.findByText('VfB Ufer')).toBeInTheDocument();
    const grafik = screen.getByTestId('tor-ball-grafik');
    expect(screen.getByTestId('goal-icon')).toContainElement(grafik);
    expect(grafik.querySelectorAll('path, rect').length).toBeGreaterThan(10);
    expect(grafik.querySelector('clipPath')).toBeNull();
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
    // nicht Ball G
    expect(zeichnung(screen.getByTestId('goal-icon'))).not.toBe(erwartet(MatchIcons.Ball));
    expect(container.textContent).not.toMatch(OHNE_EMOJI);
    expect(container.textContent).toContain('1 : 0');
  });
});
