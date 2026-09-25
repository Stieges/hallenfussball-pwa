/**
 * B1b (B-U5): Zeitstrafen laufen nur mit der Spieluhr -- Rest = Dauer minus gespielte Zeit seit
 * Strafbeginn, in Ganzzahl-ms. Zusätzlich der Neulade-Nachweis (Szenario „Laufende Strafe übersteht
 * Neuladen“): derselbe Log zweimal reduziert ergibt denselben Zustand und denselben Rest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { reduceMatch } from '../reduceMatch';
import { activePenalties, elapsedAt, penaltyRemainingMs } from '../penalties';
import type { EngineEvent, MatchContext, PenaltyRecord } from '../types';

const penalty: PenaltyRecord = { id: 'p1', teamId: 'teamA', startMs: 300000, durationMs: 120000 };

describe('penaltyRemainingMs', () => {
  it('liefert die volle Dauer vor und bei Strafbeginn', () => {
    expect(penaltyRemainingMs(penalty, 0)).toBe(120000);
    expect(penaltyRemainingMs(penalty, 300000)).toBe(120000);
  });

  it('zieht gespielte Zeit ab und klemmt bei 0', () => {
    expect(penaltyRemainingMs(penalty, 360000)).toBe(60000);
    expect(penaltyRemainingMs(penalty, 420000)).toBe(0);
    expect(penaltyRemainingMs(penalty, 999999)).toBe(0);
  });
});

describe('elapsedAt', () => {
  it('rechnet bei laufender Uhr ab dem Anker weiter, bei gestoppter Uhr nicht', () => {
    expect(elapsedAt({ running: true, elapsedMs: 1000, anchorAt: 5000 }, 7000)).toBe(3000);
    expect(elapsedAt({ running: false, elapsedMs: 1000, anchorAt: null }, 7000)).toBe(1000);
  });
});

describe('Laufende Strafe übersteht Neuladen', () => {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '__fixtures__', '24-penalty-survives-reload.json'), 'utf-8'),
  ) as { ctx: MatchContext; events: EngineEvent[] };

  it('ergibt bei zweimaligem Reduzieren denselben Zustand und denselben Rest', () => {
    const first = reduceMatch(fixture.events, fixture.ctx);
    const second = reduceMatch(fixture.events, fixture.ctx);
    expect(second.state).toEqual(first.state);

    const reloadAt = 361000; // Spielminute 6:00 (Anpfiff bei at=1000)
    const restFirst = activePenalties(first.state, elapsedAt(first.state.clock, reloadAt)).map((p) =>
      penaltyRemainingMs(p, elapsedAt(first.state.clock, reloadAt)),
    );
    const restSecond = activePenalties(second.state, elapsedAt(second.state.clock, reloadAt)).map((p) =>
      penaltyRemainingMs(p, elapsedAt(second.state.clock, reloadAt)),
    );
    expect(restFirst).toEqual([60000]);
    expect(restSecond).toEqual(restFirst);
  });

  it('läuft nur weiter, solange die Spieluhr läuft (Pause bei 6:00 friert den Rest ein)', () => {
    const pause: EngineEvent = {
      id: 'pause-1',
      type: 'PAUSE',
      actor: 'helper',
      at: 361000,
      section: 1,
      clockMs: 360000,
      payload: {},
    };
    const { state } = reduceMatch([...fixture.events, pause], fixture.ctx);
    const [active] = activePenalties(state, elapsedAt(state.clock, 999999));
    expect(penaltyRemainingMs(active, elapsedAt(state.clock, 999999))).toBe(60000);
  });

  it('zählt zurückgenommene Strafen nicht als aktiv', () => {
    const retract: EngineEvent = {
      id: 'retract-1',
      type: 'RETRACT',
      actor: 'helper',
      at: 320000,
      section: 1,
      clockMs: 319000,
      targetId: fixture.events[1].id,
      payload: {},
    };
    const { state } = reduceMatch([...fixture.events, retract], fixture.ctx);
    expect(activePenalties(state, 320000)).toEqual([]);
  });
});
