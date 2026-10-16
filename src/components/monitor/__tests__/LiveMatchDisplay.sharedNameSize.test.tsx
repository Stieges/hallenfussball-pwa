/** B3 (@ZM-087, Ruhe): LiveMatchDisplay gibt beiden Teamnamen die kleinere der beiden gemeldeten Größen vor. */
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import type { LiveMatch } from '../../../hooks/useLiveMatches';

interface NameProps { name: string; sizePx?: number; onFitPx?: (px: number) => void }
const seen: Record<string, NameProps> = {};
vi.mock('../TeamNameDisplay', () => ({
  TeamNameDisplay: (p: NameProps) => { seen[p.name] = p; return null; },
}));
vi.mock('../../../hooks', () => ({
  useMonitorTheme: vi.fn(() => ({
    resolvedTheme: 'dark',
    themeColors: new Proxy({}, { get: () => '#ffffff' }),
  })),
}));

const match: LiveMatch = {
  id: 'm1', number: 1, phaseLabel: 'A', fieldId: 'f1', field: 1, scheduledKickoff: '',
  homeTeam: { id: 'h', name: 'Heim' }, awayTeam: { id: 'a', name: 'Gast' }, homeScore: 0, awayScore: 0,
  status: 'RUNNING', elapsedSeconds: 0, durationSeconds: 600, events: [],
};

describe('gemeinsame Namensgröße im LiveMatchDisplay', () => {
  it('ohne Messung keine Vorgabe, nach beiden Messungen die kleinere für beide', () => {
    render(<LiveMatchDisplay match={match} />);
    expect(seen.Heim.sizePx).toBeUndefined();
    act(() => { seen.Heim.onFitPx?.(72); });
    expect(seen.Gast.sizePx).toBeUndefined();
    act(() => { seen.Gast.onFitPx?.(44); });
    expect(seen.Heim.sizePx).toBe(44);
    expect(seen.Gast.sizePx).toBe(44);
  });

  it('Gegenbeispiel: wird der kleinere Name größer, folgt die Vorgabe dem Minimum', () => {
    render(<LiveMatchDisplay match={match} />);
    act(() => { seen.Heim.onFitPx?.(60); seen.Gast.onFitPx?.(50); });
    expect(seen.Heim.sizePx).toBe(50);
    act(() => { seen.Gast.onFitPx?.(80); });
    expect(seen.Heim.sizePx).toBe(60);
    expect(seen.Gast.sizePx).toBe(60);
  });
});
