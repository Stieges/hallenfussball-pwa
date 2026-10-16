/**
 * @ZM-138 Vor dem Anpfiff zeigt die Live-Folie das nächste Spiel des Felds mit Anstoßzeit.
 * Mit dem Anpfiff wechselt die Folie auf Stand und Uhr ohne Logos.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import { buildTournament, slide, FIXTURE_MATCHES } from './monitorFixture';

const performanceSettings = {} as PerformanceSettings;

describe('@ZM-138 Vor dem Anpfiff: nächstes Spiel mit Anstoßzeit', () => {
  it('Feld 2 ohne laufendes Spiel zeigt das nächste Spiel mit Anstoßzeit 14:20', () => {
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-2' })}
        tournament={buildTournament()}
        performanceSettings={performanceSettings}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.getByText(/slides\.live\.nextMatch/)).toBeInTheDocument();
    expect(screen.getByText(/14:20/)).toBeInTheDocument();
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
  });

  it('Gegenbeispiel: läuft auf dem Feld ein Spiel, steht keine Anstoßzeit und kein „Nächstes Spiel“ da', () => {
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-1' })}
        tournament={buildTournament()}
        performanceSettings={performanceSettings}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.queryByText(/slides\.live\.nextMatch/)).toBeNull();
    expect(screen.queryByText(/Anstoß/)).toBeNull();
    expect(FIXTURE_MATCHES.some(m => m.matchStatus === 'running')).toBe(true);
  });

  it('whenIdle „skip“ wirkt: keine Anstoßzeit, sondern der Leerlauf-Text (Einstellung whenIdle muss wirken)', () => {
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-2', whenIdle: { type: 'skip' } })}
        tournament={buildTournament()}
        performanceSettings={performanceSettings}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.getByText(/slides\.live\.idleSkip/)).toBeInTheDocument();
    expect(screen.queryByText(/14:20/)).toBeNull();
  });
});
