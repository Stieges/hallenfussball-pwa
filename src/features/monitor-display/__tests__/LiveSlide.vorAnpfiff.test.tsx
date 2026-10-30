/**
 * @ZM-138 Vor dem Anpfiff zeigt die Live-Folie das nächste Spiel des Felds mit Anstoßzeit.
 * Mit dem Anpfiff wechselt die Folie auf Stand und Uhr; Logo bzw. Initialen stehen dann klein vor dem Namen (@ZM-157).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import { buildTournament, slide, FIXTURE_MATCHES } from './monitorFixture';
import { withView } from './monitorViewHelper';

const performanceSettings = {} as PerformanceSettings;

describe('@ZM-138 Vor dem Anpfiff: nächstes Spiel mit Anstoßzeit', () => {
  it('Feld 2 ohne laufendes Spiel zeigt das nächste Spiel mit Anstoßzeit 14:20', () => {
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-2' })}
        {...withView(buildTournament())}
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
        {...withView(buildTournament())}
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
        {...withView(buildTournament())}
        performanceSettings={performanceSettings}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.getByText(/slides\.live\.idleSkip/)).toBeInTheDocument();
    expect(screen.queryByText(/14:20/)).toBeNull();
  });

  it('@ZM-138 nach dem Anpfiff stehen Logo bzw. Initialen klein vor dem Namen', () => {
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-1' })}
        {...withView(buildTournament())}
        performanceSettings={performanceSettings}
        theme="dark"
        style={{}}
      />,
    );
    // Spiel 7 läuft: FC Nord (ohne Logo) gegen SV Süd; Initialen stehen im Avatar vor dem Namen, nicht im Kasten
    const avatar = screen.getByTestId('live-team-home-avatar');
    expect(avatar).toHaveTextContent('FN');
    expect(avatar.compareDocumentPosition(screen.getByText('FC Nord')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('live-box-home').contains(avatar)).toBe(false);
    expect(screen.queryByText(/slides\.live\.nextMatch/)).toBeNull();
  });
});
