/**
 * B-44b Mehrere Felder (F2): Die Live-Folie ohne eigenes Feld zeigt alle laufenden Spiele nebeneinander (bis 4).
 * Zone-1 „Live-Spiel“ in docs/anforderungen/2026-10-02_zuschauer-und-monitor.md · @ZM-087 Namen vollständig.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LiveSlide } from '../../../features/monitor-display/slides/LiveSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import type { Match, Team } from '../../../types/tournament';
import { buildTournament, slide } from '../../../features/monitor-display/__tests__/monitorFixture';

const performanceSettings = {} as PerformanceSettings;
const LANGER = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';

function mitFeldern(anzahl: number, langerName = false): ReturnType<typeof buildTournament> {
  const teams: Team[] = [];
  const matches: Match[] = [];
  for (let f = 1; f <= anzahl; f++) {
    teams.push({ id: `a${f}`, name: langerName && f === 1 ? LANGER : `Heim ${f}`, group: 'A' }, { id: `b${f}`, name: `Gast ${f}`, group: 'A' });
    matches.push({
      id: `m${f}`, matchNumber: f, round: 1, field: f, group: 'A', teamA: `a${f}`, teamB: `b${f}`,
      scoreA: f, scoreB: 0, matchStatus: 'running', timerStartTime: new Date().toISOString(), timerElapsedSeconds: 0,
    });
  }
  return buildTournament({
    teams, matches, numberOfFields: anzahl,
    fields: Array.from({ length: anzahl }, (_, i) => ({ id: `field-${i + 1}`, defaultName: `Feld ${i + 1}` })),
  });
}

function renderLive(tournament: ReturnType<typeof buildTournament>, fieldId?: string) {
  return render(
    <LiveSlide
      slide={slide('live', fieldId ? { fieldId } : {})}
      tournament={tournament}
      performanceSettings={performanceSettings}
      theme="dark"
      style={{}}
    />,
  );
}

describe('Live-Folie ohne eigenes Feld: mehrere laufende Spiele nebeneinander', () => {
  it('zwei laufende Spiele: zwei Karten in einer gemeinsamen Reihe, mit Namen, Stand und Feld', () => {
    renderLive(mitFeldern(2));
    const cards = screen.getAllByTestId('monitor-multi-field-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].parentElement).toBe(cards[1].parentElement);
    expect(cards[0].parentElement?.style.display).toBe('grid');
    expect(within(cards[0]).getByText('Heim 1')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Gast 2')).toBeInTheDocument();
    expect(within(cards[1]).getByTestId('multi-field-score').textContent).toContain('2');
    expect(within(cards[1]).getByText(/Feld 2/)).toBeInTheDocument();
  });

  it('vier laufende Spiele: vier Karten, fünf: höchstens vier', () => {
    const { unmount } = renderLive(mitFeldern(4));
    expect(screen.getAllByTestId('monitor-multi-field-card')).toHaveLength(4);
    unmount();
    renderLive(mitFeldern(5));
    expect(screen.getAllByTestId('monitor-multi-field-card')).toHaveLength(4);
  });

  it('ein 50-Zeichen-Name steht vollständig in der Karte, ohne „…“ (@ZM-087)', () => {
    const { container } = renderLive(mitFeldern(2, true));
    expect(within(screen.getAllByTestId('monitor-multi-field-card')[0]).getByText(LANGER)).toBeInTheDocument();
    expect(container.textContent).not.toContain('…');
  });

  it('Gegenbeispiel: Folie mit eigenem Feld zeigt nur dieses Spiel, keine Mehrfeld-Karten', () => {
    renderLive(mitFeldern(2), 'field-2');
    expect(screen.queryAllByTestId('monitor-multi-field-card')).toHaveLength(0);
    expect(screen.getByText('Heim 2')).toBeInTheDocument();
    expect(screen.queryByText('Heim 1')).toBeNull();
  });

  it('Gegenbeispiel: ohne eigenes Feld und mit nur einem laufenden Spiel die volle Einzelansicht', () => {
    const t = mitFeldern(2);
    t.matches[1] = { ...t.matches[1], matchStatus: 'scheduled' };
    renderLive(t);
    expect(screen.queryAllByTestId('monitor-multi-field-card')).toHaveLength(0);
    expect(screen.getByText('Heim 1')).toBeInTheDocument();
  });

  it('Kindermodus: keine Stände in den Karten', () => {
    const t = { ...mitFeldern(2), hideScoresForPublic: true };
    renderLive(t);
    expect(screen.queryAllByTestId('multi-field-score')).toHaveLength(0);
    expect(screen.getAllByTestId('monitor-multi-field-card')).toHaveLength(2);
  });
});
