/**
 * C-VERLAENGERUNG-ENDET-SOFORT (Engine + Adapter): Die Engine-Uhr läuft über alle Abschnitte weiter.
 * Die Ansicht muss in der Verlängerung deshalb Regelzeit + Verlängerung als Dauer liefern, sonst ist die
 * Spielzeit beim Anpfiff der Verlängerung schon „abgelaufen“ (Countdown 00:00, Auto-Ende sofort).
 * Werte aus dem Gherkin: Halbfinale 1 FC Nord – DJK Berg 1:1 nach der regulären Spielzeit, Verlängerung
 * 3 Minuten (@SL-081), 2:1 in der Verlängerung (@TM-052), Golden Goal (@SL-082).
 */
import { describe, it, expect } from 'vitest';
import { activePenaltiesView } from '../viewAdapters';
import {
  BERG,
  NORD,
  OT_KICKOFF_AT,
  OVERTIME_S,
  REGULAR_S,
  T0,
  hfEvent,
  hookElapsed,
  overtimeRunningLog,
  regularTimeDrawLog,
  stateOf,
  viewAt,
} from './overtimeFixtures';

/** Restzeit und „Zeit abgelaufen“ genau so, wie `useMatchTimerExtended` sie aus der Ansicht ableitet. */
function clockOf(view: ReturnType<typeof viewAt>, deviceNow: number) {
  const elapsed = hookElapsed(view, deviceNow);
  return { elapsed, remaining: Math.max(0, view.durationSeconds - elapsed), expired: elapsed > view.durationSeconds };
}

describe('Verlängerung in der Ansicht (C-VERLAENGERUNG-ENDET-SOFORT)', () => {
  it('@SL-145 @TM-052: nach dem Anpfiff der Verlängerung läuft das Spiel, die Spielzeit ist nicht abgelaufen', () => {
    const log = overtimeRunningLog('overtime-then-shootout');
    for (const dt of [0, 2_000, 60_000]) {
      const now = OT_KICKOFF_AT + dt;
      const view = viewAt(log, now);
      expect(view.status).toBe('RUNNING');
      expect(view.playPhase).toBe('overtime');
      expect(clockOf(view, now).expired).toBe(false);
    }
  });

  it('@SL-081: die Uhr zählt die Verlängerung von 3 Minuten herunter (Anpfiff 3:00, bei Spielzeit 2:00 noch 1:00)', () => {
    const log = overtimeRunningLog('overtime-then-shootout');
    const atKickoff = viewAt(log, OT_KICKOFF_AT);
    expect(atKickoff.durationSeconds).toBe(REGULAR_S + OVERTIME_S);
    expect(clockOf(atKickoff, OT_KICKOFF_AT).remaining).toBe(180);

    const atTwoMinutes = viewAt(log, OT_KICKOFF_AT + 120_000);
    expect(clockOf(atTwoMinutes, OT_KICKOFF_AT + 120_000).remaining).toBe(60);
  });

  it('@TM-052: die Spielzeit gilt erst nach Ablauf der 3 Minuten Verlängerung als abgelaufen', () => {
    const log = overtimeRunningLog('overtime-then-shootout');
    const justBefore = OT_KICKOFF_AT + OVERTIME_S * 1000;
    expect(clockOf(viewAt(log, justBefore), justBefore).expired).toBe(false);
    const after = OT_KICKOFF_AT + (OVERTIME_S + 1) * 1000;
    expect(clockOf(viewAt(log, after), after).expired).toBe(true);
  });

  it('@TM-052: FC Nord trifft in der Verlängerung zum 2:1, nach dem Abpfiff der Verlängerung ist das Spiel beendet', () => {
    const log = [
      ...overtimeRunningLog('overtime-then-shootout'),
      hfEvent('GOAL', OT_KICKOFF_AT + 90_000, 3, 690_000, { teamId: NORD }),
      hfEvent('MATCH_END', OT_KICKOFF_AT + 181_000, 3, 781_000),
    ];
    const state = stateOf(log);
    expect(state.status).toBe('finished');
    expect(state.decidedBy).toBe('overtime');
    const view = viewAt(log, OT_KICKOFF_AT + 181_000);
    expect(view.status).toBe('FINISHED');
    expect([view.homeScore + (view.overtimeScoreA ?? 0), view.awayScore + (view.overtimeScoreB ?? 0)]).toEqual([2, 1]);
  });

  it('@SL-082: im Golden Goal endet das Spiel nicht mit der Zeit, sondern mit dem Tor', () => {
    const log = overtimeRunningLog('goldenGoal');
    const longAfter = OT_KICKOFF_AT + (OVERTIME_S + 30) * 1000;
    const running = viewAt(log, longAfter);
    expect(running.status).toBe('RUNNING');
    expect(running.playPhase).toBe('goldenGoal');

    const withGoal = [...log, hfEvent('GOAL', OT_KICKOFF_AT + 50_000, 3, 650_000, { teamId: NORD })];
    const state = stateOf(withGoal);
    expect(state.status).toBe('finished');
    expect(state.decidedBy).toBe('goldenGoal');
    expect(viewAt(withGoal, OT_KICKOFF_AT + 50_000).status).toBe('FINISHED');
  });

  it('@FU-074: eine 30 Sekunden vor Ende der regulären Spielzeit begonnene 2-Minuten-Strafe zeigt nach dem Anpfiff der Verlängerung noch 1:30', () => {
    const base = regularTimeDrawLog('overtime-then-shootout');
    const matchEnd = base[base.length - 1];
    const log = [
      ...base.slice(0, -1),
      hfEvent('TIME_PENALTY', T0 + 630_000, 2, 570_000, { teamId: BERG, payload: { durationSeconds: 120 } }),
      matchEnd,
      hfEvent('SECTION_START', OT_KICKOFF_AT, 3, null),
    ];
    const state = stateOf(log);
    expect(state.status).toBe('running');
    const penalties = activePenaltiesView(state, OT_KICKOFF_AT);
    expect(penalties).toHaveLength(1);
    expect(penalties[0].remainingMs).toBe(90_000);
  });

  it('Gegenbeispiel: in der regulären Spielzeit bleibt die Dauer die Regelzeit, nach 10:00 ist sie abgelaufen', () => {
    const log = regularTimeDrawLog('overtime-then-shootout').slice(0, -1);
    const after = T0 + 661_000;
    const view = viewAt(log, after);
    expect(view.playPhase).toBe('regular');
    expect(view.durationSeconds).toBe(REGULAR_S);
    expect(clockOf(view, after).expired).toBe(true);
  });
});
