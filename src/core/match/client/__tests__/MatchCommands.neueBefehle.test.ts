/**
 * B-07 (Schnittstelle I3): die Befehle, die bisher fehlten -- Abschnittsende/-beginn, Uhr stellen,
 * Entscheidung waehlen, Schuss im Strafstossschiessen, Ende des Strafstossschiessens,
 * Wiedereroeffnen, Ergebnis direkt eintragen (@FU-080), Korrektur -- und `timing` fuer
 * automatische Enden (exakte Grenze, `at` auf das letzte `at` im Log geklemmt).
 */
import { describe, it, expect } from 'vitest';
import { ERROR_CODES, type EngineEvent, type MatchRules, reduceMatch } from '../../';
import { MatchCommandRejectedError, type MatchCommands } from '../MatchCommands';
import { B07_CTX, B07_RULES, KICKOFF_AT, kickoff, makeHarness, plain } from './commandHarness';

const K = KICKOFF_AT;
const ID = B07_CTX.matchId;
const KO_OPEN: MatchRules = { ...B07_RULES, knockout: true, tiebreak: null };
const KO_SHOOTOUT: MatchRules = { ...B07_RULES, knockout: true, tiebreak: 'shootout', shootersPerTeam: 1 };

const halbzeitPause = (): EngineEvent[] => [kickoff(), plain('SECTION_END', K + 600_000, 600_000, 1)];
const zweiteHalbzeit = (rules: MatchRules = B07_RULES): EngineEvent[] => [
  kickoff(rules),
  plain('SECTION_END', K + 600_000, 600_000, 1),
  plain('SECTION_START', K + 660_000, 600_000, 1),
];
const regulaerAus = (rules: MatchRules): EngineEvent[] => [
  ...zweiteHalbzeit(rules),
  plain('MATCH_END', K + 1_260_000, 1_200_000, 2),
];
const beendet = (): EngineEvent[] => [kickoff(), plain('MATCH_END', K + 400_000, 400_000, 1)];

interface Fall {
  name: string;
  pre: () => EngineEvent[];
  now: number;
  send: (commands: MatchCommands) => Promise<string | null>;
  type: EngineEvent['type'];
  teamId: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  clockMs: number;
  statusAfter: string;
}

const FAELLE: Fall[] = [
  {
    name: 'endSection -> SECTION_END',
    pre: () => [kickoff()],
    now: K + 300_000,
    send: (c) => c.endSection(ID, B07_CTX, 'helper'),
    type: 'SECTION_END', teamId: null, targetId: null, payload: {}, clockMs: 300_000, statusAfter: 'section_break',
  },
  {
    name: 'startSection -> SECTION_START',
    pre: halbzeitPause,
    now: K + 660_000,
    send: (c) => c.startSection(ID, B07_CTX, 'helper'),
    type: 'SECTION_START', teamId: null, targetId: null, payload: {}, clockMs: 600_000, statusAfter: 'running',
  },
  {
    name: 'adjustClock -> CLOCK_ADJUST mit previousClockMs',
    pre: () => [kickoff()],
    now: K + 300_000,
    send: (c) => c.adjustClock(ID, B07_CTX, 'helper', 290_000, 300_000),
    type: 'CLOCK_ADJUST', teamId: null, targetId: null, payload: { previousClockMs: 300_000 }, clockMs: 290_000,
    statusAfter: 'running',
  },
  {
    name: 'adjustClock vorwaerts (ueber die aktuelle Spielzeit)',
    pre: () => [kickoff()],
    now: K + 300_000,
    send: (c) => c.adjustClock(ID, B07_CTX, 'helper', 310_000, 300_000),
    type: 'CLOCK_ADJUST', teamId: null, targetId: null, payload: { previousClockMs: 300_000 }, clockMs: 310_000,
    statusAfter: 'running',
  },
  {
    name: 'chooseTiebreak -> TIEBREAK_CHOICE',
    pre: () => regulaerAus(KO_OPEN),
    now: K + 1_300_000,
    send: (c) => c.chooseTiebreak(ID, B07_CTX, 'helper', 'shootout'),
    type: 'TIEBREAK_CHOICE', teamId: null, targetId: null, payload: { choice: 'shootout' }, clockMs: 1_200_000,
    statusAfter: 'shootout',
  },
  {
    name: 'recordShot -> SHOOTOUT_KICK mit Schuetze',
    pre: () => regulaerAus(KO_SHOOTOUT),
    now: K + 1_300_000,
    send: (c) => c.recordShot(ID, B07_CTX, 'helper', 'fc-nord', true, 7),
    type: 'SHOOTOUT_KICK', teamId: 'fc-nord', targetId: null, payload: { scored: true, shooterNumber: 7 },
    clockMs: 1_200_000, statusAfter: 'shootout',
  },
  {
    name: 'recordShot ohne Schuetze',
    pre: () => regulaerAus(KO_SHOOTOUT),
    now: K + 1_300_000,
    send: (c) => c.recordShot(ID, B07_CTX, 'helper', 'sv-sued', false),
    type: 'SHOOTOUT_KICK', teamId: 'sv-sued', targetId: null, payload: { scored: false }, clockMs: 1_200_000,
    statusAfter: 'shootout',
  },
  {
    name: 'endShootout -> SHOOTOUT_END',
    pre: () => [
      ...regulaerAus(KO_SHOOTOUT),
      plain('SHOOTOUT_KICK', K + 1_300_000, 1_200_000, 2, { teamId: 'fc-nord', payload: { scored: true } }),
      plain('SHOOTOUT_KICK', K + 1_310_000, 1_200_000, 2, { teamId: 'sv-sued', payload: { scored: false } }),
    ],
    now: K + 1_320_000,
    send: (c) => c.endShootout(ID, B07_CTX, 'helper'),
    type: 'SHOOTOUT_END', teamId: null, targetId: null, payload: {}, clockMs: 1_200_000, statusAfter: 'finished',
  },
  {
    name: 'reopen -> REOPEN',
    pre: beendet,
    now: K + 450_000,
    send: (c) => c.reopen(ID, B07_CTX, 'leitung'),
    type: 'REOPEN', teamId: null, targetId: null, payload: {}, clockMs: 400_000, statusAfter: 'running',
  },
  {
    name: '@FU-080 enterResult -> RESULT_ENTRY 3:1 (Spiel 9 beendet)',
    pre: () => [],
    now: K,
    send: (c) => c.enterResult(ID, B07_CTX, 'leitung', { 'fc-nord': 3, 'sv-sued': 1 }, undefined, false),
    type: 'RESULT_ENTRY', teamId: null, targetId: null, payload: { scores: { 'fc-nord': 3, 'sv-sued': 1 } }, clockMs: 0,
    statusAfter: 'finished',
  },
  {
    name: 'correct -> CORRECTION mit Grund und Basis',
    pre: beendet,
    now: K + 450_000,
    send: (c) => c.correct(ID, B07_CTX, 'leitung', { 'fc-nord': 2, 'sv-sued': 1 }, 'Eingabefehler', null),
    type: 'CORRECTION', teamId: null, targetId: null,
    payload: { scores: { 'fc-nord': 2, 'sv-sued': 1 }, reason: 'Eingabefehler', basedOn: null }, clockMs: 400_000,
    statusAfter: 'finished',
  },
  {
    // @FU-112: Abpfiff und Ergebnis in EINEM Eintrag -- Uhr steht beim Senden (clockMs), Stand der Turnierleitung als basedOn.
    name: 'endWithResult -> ein RESULT_ENTRY mit basedOn aus dem laufenden Spiel',
    pre: () => [kickoff()],
    now: K + 480_000,
    send: (c) => c.endWithResult(ID, B07_CTX, 'leitung', { 'fc-nord': 3, 'sv-sued': 1 }, undefined, false, null),
    type: 'RESULT_ENTRY', teamId: null, targetId: null,
    payload: { scores: { 'fc-nord': 3, 'sv-sued': 1 }, basedOn: null }, clockMs: 480_000,
    statusAfter: 'finished',
  },
  {
    // @FU-114 + @FU-094: K.-o. nach Ablauf mit offener Entscheidung, Unentschieden mit Strafstoß.
    name: 'endWithResult -> K.-o.-Unentschieden mit Strafstoß aus decision_pending',
    pre: () => regulaerAus(KO_OPEN),
    now: K + 1_270_000,
    send: (c) => c.endWithResult(ID, B07_CTX, 'leitung', { 'fc-nord': 1, 'sv-sued': 1 }, { 'fc-nord': 4, 'sv-sued': 3 }, true, null),
    type: 'RESULT_ENTRY', teamId: null, targetId: null,
    payload: { scores: { 'fc-nord': 1, 'sv-sued': 1 }, shootout: { 'fc-nord': 4, 'sv-sued': 3 }, basedOn: null }, clockMs: 1_200_000,
    statusAfter: 'finished',
  },
];

describe('MatchCommands – neue Befehle (B-07, I3)', () => {
  it.each(FAELLE)('$name: genau ein Eintrag mit type, teamId, targetId, Payload', async (fall) => {
    const harness = makeHarness(fall.pre(), fall.now);
    const actorOf = fall.type === 'REOPEN' || fall.type === 'RESULT_ENTRY' || fall.type === 'CORRECTION' ? 'leitung' : 'helper';

    const id = await fall.send(harness.commands);

    expect(harness.stored).toHaveLength(1);
    const event = harness.stored[0];
    expect(id).toBe(event.id);
    expect(event).toMatchObject({
      type: fall.type,
      teamId: fall.teamId,
      targetId: fall.targetId,
      actor: actorOf,
      clockMs: fall.clockMs,
      at: fall.now,
    });
    expect(event.payload).toEqual(fall.payload);
    expect(reduceMatch(harness.log, B07_CTX).state.status).toBe(fall.statusAfter);
    expect(harness.kick).toHaveBeenCalledWith(ID);
  });
});

describe('MatchCommands – Gegenbeispiele (@FU-081)', () => {
  // @FU-081 präzisiert (20261110_009): der einfache Eintrag kennt keinen Stand -- auf einem laufenden Spiel abgelehnt
  // (STALE_BASE, basedOn fehlt); beenden geht nur über `endWithResult` (@FU-112).
  it('@FU-081 enterResult (ohne Stand) auf laufendem Spiel -> abgelehnt, Store unveraendert, kein kick', async () => {
    const harness = makeHarness([kickoff()], K + 300_000);

    const sending = harness.commands.enterResult(ID, B07_CTX, 'leitung', { 'fc-nord': 3, 'sv-sued': 1 }, undefined, false);

    await expect(sending).rejects.toBeInstanceOf(MatchCommandRejectedError);
    await expect(sending).rejects.toMatchObject({ code: ERROR_CODES.STALE_BASE });
    expect(harness.stored).toHaveLength(0);
    expect(harness.kick).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: '@FU-113 Helfer -> FORBIDDEN_ACTOR',
      pre: () => [kickoff()],
      send: (c: MatchCommands) => c.endWithResult(ID, B07_CTX, 'helper', { 'fc-nord': 3, 'sv-sued': 1 }, undefined, false, null),
      code: ERROR_CODES.FORBIDDEN_ACTOR,
    },
    {
      name: '@FU-094 K.-o.-Unentschieden ohne Strafstoß -> INVALID_PAYLOAD',
      pre: () => regulaerAus(KO_OPEN),
      send: (c: MatchCommands) => c.endWithResult(ID, B07_CTX, 'leitung', { 'fc-nord': 1, 'sv-sued': 1 }, undefined, true, null),
      code: ERROR_CODES.INVALID_PAYLOAD,
    },
    {
      name: '@FU-116 veralteter Stand (basedOn nicht der letzte Eintrag) -> STALE_BASE',
      pre: () => [kickoff(), { ...plain('GOAL', K + 60_000, 60_000, 1), teamId: 'fc-nord' }],
      send: (c: MatchCommands) => c.endWithResult(ID, B07_CTX, 'leitung', { 'fc-nord': 3, 'sv-sued': 1 }, undefined, false, null),
      code: ERROR_CODES.STALE_BASE,
    },
    {
      name: '@FU-118 laufendes Strafstoßschießen -> INVALID_TRANSITION',
      pre: () => regulaerAus(KO_SHOOTOUT),
      send: (c: MatchCommands) => c.endWithResult(ID, B07_CTX, 'leitung', { 'fc-nord': 1, 'sv-sued': 1 }, { 'fc-nord': 4, 'sv-sued': 3 }, true, null),
      code: ERROR_CODES.INVALID_TRANSITION,
    },
  ])('endWithResult $name, nichts gespeichert, kein kick', async ({ pre, send, code }) => {
    const harness = makeHarness(pre(), K + 1_300_000);
    await expect(send(harness.commands)).rejects.toMatchObject({ code });
    expect(harness.stored).toHaveLength(0);
    expect(harness.kick).not.toHaveBeenCalled();
  });

  it('endSection im letzten Abschnitt -> abgelehnt {reason: LAST_SECTION}, nichts gespeichert', async () => {
    const harness = makeHarness(zweiteHalbzeit(), K + 900_000);

    await expect(harness.commands.endSection(ID, B07_CTX, 'helper')).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_TRANSITION,
      detail: { reason: 'LAST_SECTION' },
    });
    expect(harness.stored).toHaveLength(0);
    expect(harness.kick).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'adjustClock negativ', send: (c: MatchCommands) => c.adjustClock(ID, B07_CTX, 'helper', -1, 300_000) },
    { name: 'adjustClock keine ganze Zahl', send: (c: MatchCommands) => c.adjustClock(ID, B07_CTX, 'helper', 1.5, 300_000) },
    {
      name: 'Fixrunde F6: adjustClock mit negativem previousClockMs',
      send: (c: MatchCommands) => c.adjustClock(ID, B07_CTX, 'helper', 290_000, -1),
    },
    {
      name: 'Fixrunde F6: adjustClock mit previousClockMs NaN',
      send: (c: MatchCommands) => c.adjustClock(ID, B07_CTX, 'helper', 290_000, Number.NaN),
    },
    {
      name: 'timing mit negativer Spielzeit',
      send: (c: MatchCommands) => c.endSection(ID, B07_CTX, 'helper', { clockMs: -1, at: K + 300_000 }),
    },
  ])('$name -> INVALID_PAYLOAD {reason: CLOCK_OUT_OF_RANGE}, nichts gespeichert', async ({ send }) => {
    const harness = makeHarness([kickoff()], K + 300_000);

    await expect(send(harness.commands)).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_PAYLOAD,
      detail: { reason: 'CLOCK_OUT_OF_RANGE' },
    });
    expect(harness.stored).toHaveLength(0);
  });
});

describe('MatchCommands – timing fuer automatische Enden (§ B-08b)', () => {
  it.each([
    {
      name: 'endSection',
      pre: () => [kickoff()],
      send: (c: MatchCommands) => c.endSection(ID, B07_CTX, 'helper', { clockMs: 600_000, at: K + 600_000 }),
      clockMs: 600_000,
      at: K + 600_000,
    },
    {
      name: 'finish',
      pre: () => zweiteHalbzeit(),
      send: (c: MatchCommands) => c.finish(ID, B07_CTX, 'helper', { clockMs: 1_200_000, at: K + 1_260_000 }),
      clockMs: 1_200_000,
      at: K + 1_260_000,
    },
    {
      name: 'reopen',
      pre: beendet,
      send: (c: MatchCommands) => c.reopen(ID, B07_CTX, 'leitung', { clockMs: 400_000, at: K + 420_000 }),
      clockMs: 400_000,
      at: K + 420_000,
    },
  ])('$name: clockMs und at woertlich statt Spielzeit/Serverzeit des Sendens', async ({ pre, send, clockMs, at }) => {
    // Gesendet wird spaeter (Serverzeit + 2 s), die Grenze liegt davor.
    const harness = makeHarness(pre(), at + 2_000);

    await send(harness.commands);

    expect(harness.stored).toHaveLength(1);
    expect(harness.stored[0].clockMs).toBe(clockMs);
    expect(harness.stored[0].at).toBe(at);
  });

  it('at wird auf das letzte at im Log geklemmt (Server klemmt ebenso)', async () => {
    const tor = plain('GOAL', K + 599_900, 599_900, 1, { teamId: 'fc-nord' });
    const harness = makeHarness([kickoff(), tor], K + 600_500);

    await harness.commands.endSection(ID, B07_CTX, 'helper', { clockMs: 600_000, at: K + 599_800 });

    expect(harness.stored[0].at).toBe(K + 599_900);
    expect(harness.stored[0].clockMs).toBe(600_000);
  });

  it('Fixrunde F3: timing.at in der Zukunft -> auf die Serverzeit begrenzt (Server: least(at, now))', async () => {
    const harness = makeHarness([kickoff()], K + 600_000);

    await harness.commands.endSection(ID, B07_CTX, 'helper', { clockMs: 600_000, at: K + 600_900 });

    expect(harness.stored[0].at).toBe(K + 600_000);
    expect(harness.stored[0].clockMs).toBe(600_000);
  });

  it('Fixrunde F5: timing traegt den Abschnitt des Endes -> section daraus, nicht aus dem Zustand', async () => {
    const harness = makeHarness(zweiteHalbzeit(), K + 1_262_000);

    await harness.commands.finish(ID, B07_CTX, 'helper', { clockMs: 1_200_000, at: K + 1_260_000, section: 2 });

    expect(harness.stored[0].section).toBe(2);
  });

  it('Gegenbeispiel: ohne timing gelten Spielzeit und Serverzeit des Sendens', async () => {
    const harness = makeHarness([kickoff()], K + 600_400);

    await harness.commands.endSection(ID, B07_CTX, 'helper');

    expect(harness.stored[0].at).toBe(K + 600_400);
    expect(harness.stored[0].clockMs).toBe(600_400);
  });
});
