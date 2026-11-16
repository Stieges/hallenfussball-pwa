/**
 * @OB-038 „den Monitor bei ‚kein Spiel‘ und beim Tor“ → gezeichnete Symbole (Pause, Ball), kein Emoji;
 * Größen aus den Monitor-Tokens. Die Plätze auf der Sponsor-Folie stehen in `SponsorSlide.platzring.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoMatchDisplay } from '../NoMatchDisplay';
import { GoalAnimation } from '../GoalAnimation';
import { MatchIcons } from '../../ui/IconsMatch';
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
  it('das Pause-Symbol aus den Spiel-Symbolen steht statt des Emoji, in der Größe des Tokens', () => {
    const { container } = render(<NoMatchDisplay size="xl" />);
    const symbol = screen.getByTestId('no-match-icon');
    expect(zeichnung(symbol)).toBe(erwartet(MatchIcons.Pause));
    expect(symbol.querySelector('svg')!.getAttribute('width')).toBe(displayNoMatch.xl.icon);
    expect(container.textContent).not.toMatch(OHNE_EMOJI);
  });
});

describe('@OB-038 Monitor beim Tor', () => {
  it('der gezeichnete Ball steht statt des Emoji; Text und Stand bleiben', async () => {
    const tor: GoalEventInfo = { matchId: 'm1', teamId: 'a', teamName: 'VfB Ufer', side: 'home', timestamp: Date.now(), newScore: { home: 1, away: 0 } };
    const { container } = render(<GoalAnimation goalEvent={tor} onAnimationComplete={vi.fn()} />);
    expect(await screen.findByText('VfB Ufer')).toBeInTheDocument();
    expect(zeichnung(screen.getByTestId('goal-icon'))).toBe(erwartet(MatchIcons.Ball));
    expect(container.textContent).not.toMatch(OHNE_EMOJI);
    expect(container.textContent).toContain('1 : 0');
  });
});
