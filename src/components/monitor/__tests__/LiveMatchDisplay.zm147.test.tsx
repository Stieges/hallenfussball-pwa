/**
 * @ZM-147 „Ist nur das Ergebnis eingetragen, zeigt der Monitor den Endstand ohne Verlauf“ (Record zuschauer-und-monitor),
 * Darstellungsteil von C-MONITOR-OHNE-STRAFSTOSS (A-36c, Mockup K5g): Halbfinale 1 „FC Nord – SG Mitte“ wurde auf Papier
 * geleitet, Olli trägt 2:2 und das Strafstoßschießen 4:3 für FC Nord ein, ohne einzelne Tore oder Schüsse.
 * Dann zeigt der Hallenmonitor Feld 1 „2:2“, „Strafstoßschießen 4 : 3“ und FC Nord als Sieger, ohne Schützen-Punktreihen
 * und ohne leere Platzhalter. Der Datenteil (Ansicht aus der Cloud-Zeile) steht in `core/view/__tests__/zm147.test.ts`;
 * der Engine-Weg (Direkteintrag mit Strafstoß) bleibt dort `it.fails` bis @FU-094.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { LiveMatchDisplay } from '../LiveMatchDisplay';
import { LiveSlide } from '../../../features/monitor-display/slides/LiveSlide';
import { buildMonitorView } from '../../../features/monitor-display/monitorView';
import { liveMatchOf, withView } from '../../../features/monitor-display/__tests__/monitorViewHelper';
import { slide } from '../../../features/monitor-display/__tests__/monitorFixture';
import { GAME, hf1Besetzt, NORD, withCloudColumns, type Hallencup } from '../../../core/view/__fixtures__/hallencupNord';

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({ liveMatches: new Map(), lastGoalEvent: null, lastCardEvent: null }),
}));

/** Halbfinale 1 nur als Ergebnis: Cloud-Zeile mit 2:2 und Strafstoß 4:3, kein Ereignis (Ruling Datenebene wie zm147.test.ts). */
async function nurErgebnis(spalten: Parameters<typeof withCloudColumns>[2] = {}): Promise<Hallencup> {
  return withCloudColumns(await hf1Besetzt(), GAME.HF1, {
    score_a: 2, score_b: 2, penalty_score_a: 4, penalty_score_b: 3, match_status: 'finished', decided_by: 'penalty', ...spalten,
  });
}

function zeigeLive(cup: Hallencup, tournament = cup.tournament) {
  const match = tournament.matches[GAME.HF1];
  const view = buildMonitorView(tournament);
  return render(
    <LiveMatchDisplay match={liveMatchOf(match, tournament)} finalScore={view.byId.get(match.id)?.score} />,
  );
}

describe('@ZM-147 Monitor: Endstand ohne Verlauf nach dem Strafstoßschießen', () => {
  it('@ZM-147 zeigt 2:2, „Strafstoßschießen 4 : 3“ und FC Nord als Sieger', async () => {
    const cup = await nurErgebnis();
    zeigeLive(cup);
    expect(screen.getByLabelText(/^Heim: 2/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Gast: 2/)).toBeInTheDocument();
    expect(screen.getByTestId('live-penalty').textContent).toBe('Strafstoßschießen 4 : 3');
    expect(screen.getByTestId('live-winner').textContent).toBe('FC Nord gewinnt');
  });

  it('@ZM-087 @ZM-147 Siegerzeile in der Monitor-Form: der 50-Zeichen-Sieger steht wie in der Namenszeile als „SG FF Nordheim-Süd 1921“, ohne „…“', async () => {
    const cup = await nurErgebnis();
    const lang = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
    const teams = cup.tournament.teams.map((t) => (t.id === NORD ? { ...t, name: lang } : t));
    const tournament = { ...cup.tournament, teams };
    const match = tournament.matches[GAME.HF1];
    render(<LiveMatchDisplay match={liveMatchOf(match, tournament)} finalScore={buildMonitorView(tournament).byId.get(match.id)?.score} />);
    expect(screen.getByTestId('live-winner').textContent).toBe('SG FF Nordheim-Süd 1921 gewinnt');
    expect(screen.getByTestId('live-winner').textContent).not.toContain(lang);
    expect(screen.getByTestId('live-winner').textContent).not.toContain('…');
  });

  it('@ZM-147 ohne Schützen-Punktreihen und ohne leere Platzhalter, statt Verlauf nur der Endstand', async () => {
    const cup = await nurErgebnis();
    const { container } = zeigeLive(cup);
    expect(container.querySelectorAll('[data-testid*="shootout"], [data-testid*="schuetze"], [data-testid*="dots"]')).toHaveLength(0);
    // aus main (A-25a): auch keine Torschützen
    expect(container.querySelector('[data-testid*="scorer"], [data-testid*="kick"]')).toBeNull();
    expect(screen.queryByText(/Torschütze|Schütze/)).toBeNull();
    expect(container.textContent).not.toMatch(/[○●✓✗]/);
    expect(screen.getByTestId('live-winner').textContent).not.toMatch(/–|\?/);
  });

  it('@ET-013 Gegenbeispiel: das Strafstoßergebnis wird nicht zu den Toren addiert (nicht 6:5)', async () => {
    const cup = await nurErgebnis();
    zeigeLive(cup);
    expect(screen.queryByLabelText('Heim: 6')).toBeNull();
    expect(screen.queryByLabelText('Gast: 5')).toBeNull();
    expect(screen.queryByLabelText('Heim: 4')).toBeNull();
  });

  it('@ZM-147 Gegenbeispiel: ohne Strafstoßschießen steht kein Strafstoßergebnis und kein Sieger, nur „Endstand“', async () => {
    const cup = await nurErgebnis({ penalty_score_a: null, penalty_score_b: null, decided_by: 'regular', score_a: 3, score_b: 1 });
    zeigeLive(cup);
    expect(screen.queryByTestId('live-penalty')).toBeNull();
    expect(screen.queryByTestId('live-winner')).toBeNull();
    expect(screen.getByTestId('live-endstand').textContent).toBe('Endstand');
  });

  it('@W2A-031 Kindermodus: weder Strafstoßergebnis noch Sieger (kein Stand wird verraten)', async () => {
    const cup = await nurErgebnis();
    const kinder = { ...cup.tournament, hideScoresForPublic: true };
    const match = kinder.matches[GAME.HF1];
    render(<LiveMatchDisplay match={liveMatchOf(match, kinder)} finalScore={buildMonitorView(kinder).byId.get(match.id)?.score} hideScore />);
    expect(screen.queryByTestId('live-penalty')).toBeNull();
    expect(screen.queryByTestId('live-winner')).toBeNull();
  });

  it('@ZM-147 Live-Folie Feld: das festgehaltene beendete Spiel (Pin, 30 s nach Abpfiff) zeigt Strafstoßschießen und Sieger', async () => {
    const cup = await nurErgebnis();
    const match = cup.tournament.matches[GAME.HF1];
    render(
      <LiveSlide slide={slide('live', { fieldId: `field-${match.field}` })} {...withView(cup.tournament)}
        performanceSettings={{} as never} theme="dark" style={{}} pinnedMatchId={match.id} />,
    );
    expect(screen.getByTestId('live-penalty').textContent).toBe('Strafstoßschießen 4 : 3');
    expect(screen.getByTestId('live-winner').textContent).toBe('FC Nord gewinnt');
  });
});
