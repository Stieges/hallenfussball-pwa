/**
 * B-44b-F2 (T1): Live-Folie ohne fieldId zeigt nur das Spiel auf Feld 1, nie irgendein laufendes Spiel (@ZM-074).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import { buildTournament, slide, withMatch } from './monitorFixture';
import { withView } from './monitorViewHelper';

const performanceSettings = {} as PerformanceSettings;

function renderOhneFeld(matches: ReturnType<typeof withMatch>) {
  return render(
    <LiveSlide slide={slide('live', {})} {...withView(buildTournament({ matches }))} performanceSettings={performanceSettings} theme="dark" style={{}} />,
  );
}

describe('Live-Folie ohne fieldId', () => {
  it('läuft ein Spiel auf Feld 1, zeigt sie dieses Spiel', () => {
    renderOhneFeld(withMatch('match-8', { matchStatus: 'running' }));
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.queryByText('DJK Berg')).toBeNull();
  });

  it('Gegenbeispiel: läuft ein Spiel nur auf Feld 2, wird es nicht gezeigt', () => {
    const matches = withMatch('match-8', { matchStatus: 'running' }).map(m => (m.id === 'match-7' ? { ...m, matchStatus: 'scheduled' as const } : m));
    renderOhneFeld(matches);
    expect(screen.queryByText('DJK Berg')).toBeNull();
    expect(screen.queryByText('TuS Mitte', { selector: '[data-testid="live-name-away"] *' })).toBeNull();
    expect(screen.queryByTestId('live-grid')).toBeNull();
  });
});
