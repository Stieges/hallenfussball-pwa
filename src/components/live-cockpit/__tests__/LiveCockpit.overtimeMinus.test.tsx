/**
 * LiveCockpit — Minus-Button-Guard in der Verlängerung (M2-Cockpit-Abschluss, 2026-09-17)
 *
 * Vorher: `handleMinusHome`/`handleMinusAway` prüften unabhängig von der Phase
 * `currentMatch.homeScore`/`awayScore` (die reguläre Anzeige). Während der
 * Verlängerung ist aber `overtimeScoreA`/`overtimeScoreB` maßgeblich. Bei
 * `homeScore: 1` (Tor in der regulären Spielzeit) und `overtimeScoreA: 0` blieb
 * der "−1"-Button aktiv (das Button-`disabled`-Attribut selbst — gesteuert über
 * `canDecrementHome`/`canDecrementAway`, LiveCockpit.tsx ~Zeile 661f. — richtete
 * sich vorher unabhängig von der Phase nach dem regulären Spielstand): ein Klick
 * rief `onGoal(..., -1)` auf und setzte (vor dem Floor-Fix in
 * MatchExecutionService.recordGoal) `overtimeScoreA` auf -1 — ein einzelner
 * Fehlklick ohne Löschung/Undo. Der Fix (Commit ef5833a) macht sowohl das
 * `disabled`-Attribut als auch den Klick-Handler selbst phasenbewusst: in der
 * Verlängerung zählt `overtimeScoreA`/`overtimeScoreB`, nicht `homeScore`/`awayScore`
 * — der Button ist jetzt gesperrt UND der Klick bliebe zusätzlich wirkungslos,
 * falls die Sperre je wegfiele.
 *
 * Selektor: TeamBlock/index.tsx setzt `data-testid={`goal-minus-button-${teamSide}`}`
 * (index.tsx:216) — stabil, unabhängig von i18n. Das "−1"-Label selbst ist kein
 * `t()`-Aufruf (index.tsx:218: literaler Text "−1"), aber wir verwenden trotzdem
 * die data-testid, weil sie eindeutig pro Seite (home/away) ist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Finale', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 1, awayScore: 0, status: 'RUNNING', elapsedSeconds: 650, events: [],
    playPhase: 'regular',
    ...overrides,
  };
}

function baseProps(match: unknown, handlers: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: 'tour-1',
    currentMatch: match as never, upcomingMatches: [],
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
}

describe('LiveCockpit — Minus-Button-Guard in der Verlängerung', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PIN: overtime, homeScore 1 / overtimeScoreA 0 — "−1" ruft onGoal NICHT auf (der gemeldete Fehlklick)', async () => {
    const onGoal = vi.fn();
    const user = userEvent.setup();
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'overtime', homeScore: 1, overtimeScoreA: 0 }), { onGoal })}
      />
    );

    const minusHome = screen.getByTestId('goal-minus-button-home');
    // Zwei Absicherungen, bewusst beide: Der Knopf ist gesperrt (es gibt kein
    // Verlängerungstor zu entfernen), UND der Klick-Handler bliebe wirkungslos,
    // falls die Sperre je wegfiele.
    expect(minusHome).toBeDisabled();
    await user.click(minusHome);

    expect(onGoal).not.toHaveBeenCalled();
  });

  it('Regression: overtime, homeScore 1 / overtimeScoreA 2 — "−1" ruft onGoal weiterhin auf', async () => {
    const onGoal = vi.fn();
    const user = userEvent.setup();
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'overtime', homeScore: 1, overtimeScoreA: 2 }), { onGoal })}
      />
    );

    await user.click(screen.getByTestId('goal-minus-button-home'));

    expect(onGoal).toHaveBeenCalledWith('match-1', 'team-a', -1);
  });

  it('Regression: reguläre Phase unverändert — homeScore 1 erlaubt "−1"', async () => {
    const onGoal = vi.fn();
    const user = userEvent.setup();
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'regular', homeScore: 1 }), { onGoal })}
      />
    );

    await user.click(screen.getByTestId('goal-minus-button-home'));

    expect(onGoal).toHaveBeenCalledWith('match-1', 'team-a', -1);
  });

  it('PIN: 0:0-Finale in der Verlängerung — "−1" ist bedienbar, obwohl der reguläre Stand 0 ist', async () => {
    // Der gefährlichere Zwilling des gemeldeten Fehlklicks: So entsteht eine Verlängerung
    // überhaupt am häufigsten. Mit der alten Sperre (`homeScore > 0`) war der Knopf hier
    // dauerhaft gesperrt — ein irrtümlich erfasstes Golden Goal war damit nicht zurücknehmbar.
    const onGoal = vi.fn();
    const user = userEvent.setup();
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'goldenGoal', homeScore: 0, overtimeScoreA: 2 }), { onGoal })}
      />
    );

    const minusHome = screen.getByTestId('goal-minus-button-home');
    expect(minusHome).not.toBeDisabled();
    await user.click(minusHome);

    expect(onGoal).toHaveBeenCalledWith('match-1', 'team-a', -1);
  });

  it('Regression: reguläre Phase unverändert — homeScore 0 bleibt gesperrt (Button disabled, kein onGoal)', async () => {
    const onGoal = vi.fn();
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'regular', homeScore: 0 }), { onGoal })}
      />
    );

    expect(screen.getByTestId('goal-minus-button-home')).toBeDisabled();
  });
});

describe('LiveCockpit — Effektiver Spielstand (getEffectiveScore)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Golden Goal: homeScore 1 + overtimeScoreA 1 → score-home zeigt "2"', () => {
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'goldenGoal', homeScore: 1, awayScore: 1, overtimeScoreA: 1, overtimeScoreB: 0 }))}
      />
    );

    expect(screen.getByTestId('score-home')).toHaveTextContent('2');
  });

  it('Verlängerung beide Seiten: 1 + 1 : 1 + 2 → score-home zeigt "2", score-away zeigt "3"', () => {
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'overtime', homeScore: 1, awayScore: 1, overtimeScoreA: 1, overtimeScoreB: 2 }))}
      />
    );

    expect(screen.getByTestId('score-home')).toHaveTextContent('2');
    expect(screen.getByTestId('score-away')).toHaveTextContent('3');
  });

  it('Regression: reguläre Phase — homeScore 2, awayScore 1 → zeigt "2" und "1" (keine overtime)', () => {
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'regular', homeScore: 2, awayScore: 1 }))}
      />
    );

    expect(screen.getByTestId('score-home')).toHaveTextContent('2');
    expect(screen.getByTestId('score-away')).toHaveTextContent('1');
  });

  it('Regression: nach „Seiten tauschen" bleibt Spielstand korrekt (Effektivstand)', async () => {
    const user = userEvent.setup();
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'goldenGoal', homeScore: 1, awayScore: 0, overtimeScoreA: 2, overtimeScoreB: 0 }))}
      />
    );

    // Vor dem Tausch: score-home zeigt 1+2=3 (Heim-Effektivstand), score-away zeigt 0 (Gast-Effektivstand)
    expect(screen.getByTestId('score-home')).toHaveTextContent('3');
    expect(screen.getByTestId('score-away')).toHaveTextContent('0');

    // Seiten tauschen
    await user.click(screen.getByRole('button', { name: 'Seiten tauschen' }));

    // Nach dem Tausch: Testids ändern sich nicht, aber die visuellen Positionen sind getauscht.
    // Die Effektivstände bleiben erhalten (sie hängen vom teamSide ab, nicht vom sidesSwapped).
    expect(screen.getByTestId('score-home')).toHaveTextContent('3');
    expect(screen.getByTestId('score-away')).toHaveTextContent('0');
  });
});
