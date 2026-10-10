/**
 * B-13d1: Schwelle des Pull-to-refresh.
 *
 * Gegenbeispiel: 150 px Zug (gedämpft 75 px) liegt zwischen 10 und 80 → nichts.
 * Grenze: 159 px (79,5 px) → nichts; 160 px (80 px) → genau einmal.
 * Mutationen: PULL_THRESHOLD 80→10 (75 px-Fall rot); >= → > (80 px-Fall rot);
 * PULL_DAMPENING 0.5→1 (75 px-Fall rot).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { usePullToRefresh } from '../usePullToRefresh';

function Harness({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const { containerRef, handlers } = usePullToRefresh(onRefresh);
  return <div data-testid="ptr" ref={containerRef} {...handlers} />;
}

function ziehe(onRefresh: () => Promise<void>, endY: number) {
  const { getByTestId } = render(<Harness onRefresh={onRefresh} />);
  const div = getByTestId('ptr');
  fireEvent.touchStart(div, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(div, { touches: [{ clientY: endY }] });
  fireEvent.touchEnd(div);
}

describe('usePullToRefresh Schwelle (B-13d1)', () => {
  it('Gegenbeispiel: 150 px Zug (75 px gedämpft) löst nichts aus', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    ziehe(onRefresh, 150);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('knapp unter der Schwelle: 159 px (79,5 px) löst nichts aus', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    ziehe(onRefresh, 159);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('genau an der Schwelle: 160 px (80 px) löst genau einmal aus', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    ziehe(onRefresh, 160);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
