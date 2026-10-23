/**
 * Aufgabe 1.1 (Spielanzeige): Molekül `MatchStatusBadge` – ein Abzeichen mit Wort, ohne Uhr (@OB-065, @OB-066, @OB-039).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchStatusBadge } from '../MatchStatusBadge';
import type { MatchBadgeModel, MatchBadgeState } from '../../../../core/view/badge';

await initRealDeI18n();

const badge = (state: MatchBadgeState): MatchBadgeModel => ({ kind: 'badge', state });

describe('MatchStatusBadge', () => {
  it.each([
    ['live', 'Live'],
    ['pause', 'Pause'],
    ['halftime', 'Halbzeit'],
    ['overtime', 'Verlängerung'],
    ['shootout', 'Strafstoßschießen'],
    ['ended', 'Ende'],
    ['cancelled', 'ausgefallen'],
  ] as const)('@OB-066 Abzeichen %s trägt das Wort „%s“', (state, wort) => {
    render(<MatchStatusBadge model={badge(state)} size="card" />);
    const el = screen.getByTestId('match-status-badge');
    expect(el).toHaveTextContent(wort);
    expect(el.textContent).toBe(wort);
    expect(el).toHaveAttribute('data-state', state);
  });

  it.each(['live', 'pause', 'halftime', 'overtime', 'shootout', 'ended', 'cancelled'] as const)(
    '@OB-065 das Abzeichen %s enthält keine Uhrzeit oder Spielzeit',
    (state) => {
      render(<MatchStatusBadge model={badge(state)} size="card" />);
      expect(screen.getByTestId('match-status-badge').textContent).not.toMatch(/\d{1,2}:\d{2}/);
    },
  );

  it('@OB-065 geplantes Spiel: „15:05“ statt Abzeichen', () => {
    render(<MatchStatusBadge model={{ kind: 'kickoff', time: '15:05' }} size="card" />);
    expect(screen.getByTestId('match-kickoff')).toHaveTextContent('15:05');
    expect(screen.queryByTestId('match-status-badge')).toBeNull();
  });

  it('@OB-065 Gegenbeispiel: ohne Abzeichen und ohne Anstoßzeit wird nichts gezeichnet', () => {
    const { container } = render(<MatchStatusBadge model={{ kind: 'none' }} size="card" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('@OB-039 Live trägt den Puls-Punkt, die übrigen nicht', () => {
    const { rerender } = render(<MatchStatusBadge model={badge('live')} size="card" />);
    expect(screen.getByTestId('match-status-badge')).toHaveAttribute('data-pulse', 'true');
    expect(screen.getByTestId('match-status-badge').querySelector('[data-testid="match-status-badge-dot"]')).not.toBeNull();
    for (const state of ['pause', 'halftime', 'overtime', 'shootout', 'ended', 'cancelled'] as const) {
      rerender(<MatchStatusBadge model={badge(state)} size="card" />);
      expect(screen.getByTestId('match-status-badge')).not.toHaveAttribute('data-pulse');
      expect(screen.getByTestId('match-status-badge').querySelector('[data-testid="match-status-badge-dot"]')).toBeNull();
    }
  });

  it('@OB-039 Live steht im Live-Rot (statusLive als Fläche, statusLiveOn als Schrift), Pause nicht', () => {
    const { rerender } = render(<MatchStatusBadge model={badge('live')} size="card" />);
    const live = screen.getByTestId('match-status-badge');
    expect(live.style.background).toContain('--color-status-live');
    expect(live.style.color).toContain('--color-status-live-on');
    rerender(<MatchStatusBadge model={badge('pause')} size="card" />);
    expect(screen.getByTestId('match-status-badge').style.background).not.toContain('--color-status-live');
  });

  it('@OB-066 Monitor-Themes: tone überschreibt die Farben von Live und Zuständen', () => {
    const tone = { liveBg: 'rgb(1, 2, 3)', liveFg: 'rgb(4, 5, 6)', neutralBg: 'rgb(7, 8, 9)', neutralFg: 'rgb(10, 11, 12)' };
    const { rerender } = render(<MatchStatusBadge model={badge('live')} size="display" tone={tone} />);
    expect(screen.getByTestId('match-status-badge')).toHaveStyle({ background: tone.liveBg, color: tone.liveFg });
    rerender(<MatchStatusBadge model={badge('ended')} size="display" tone={tone} />);
    expect(screen.getByTestId('match-status-badge')).toHaveStyle({ background: tone.neutralBg, color: tone.neutralFg });
  });

  it('@OB-066 Gegenbeispiel: jedes Abzeichen hat Text, nie nur Punkt oder Farbe', () => {
    for (const state of ['live', 'pause', 'halftime', 'overtime', 'shootout', 'ended', 'cancelled'] as const) {
      const { unmount } = render(<MatchStatusBadge model={badge(state)} size="row" />);
      expect(screen.getByTestId('match-status-badge').textContent?.trim().length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('@OB-065 die Größen card, row und display tragen dasselbe Wort', () => {
    for (const size of ['card', 'row', 'display'] as const) {
      const { unmount } = render(<MatchStatusBadge model={badge('halftime')} size={size} />);
      expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Halbzeit');
      unmount();
    }
  });

  it('@OB-065 eigene testId wird übernommen', () => {
    render(<MatchStatusBadge model={badge('live')} size="card" testId="live-badge" />);
    expect(screen.getByTestId('live-badge')).toHaveAttribute('data-state', 'live');
  });
});
