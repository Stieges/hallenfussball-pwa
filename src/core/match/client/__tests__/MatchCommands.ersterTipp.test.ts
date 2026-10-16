/**
 * B-07 (L1, @SL-084; S4/R4): Karte, Zeitstrafe und Tor tragen die Spielzeit des ersten Tipps
 * (`clockMs` in den Optionen); jeder Befehl liefert die Ereignis-ID des gespeicherten Eintrags
 * (`null`, wenn nichts gespeichert wurde).
 */
import { describe, it, expect } from 'vitest';
import { ERROR_CODES } from '../../';
import { MatchCommandRejectedError } from '../MatchCommands';
import { B07_CTX, KICKOFF_AT, kickoff, makeHarness, plain } from './commandHarness';

const ERSTER_TIPP_MS = 192_000; // 3:12
const NUMMER_DA_MS = 205_000; // 3:25

function laufendBei325() {
  return makeHarness([kickoff()], KICKOFF_AT + NUMMER_DA_MS);
}

describe('MatchCommands – @SL-084 Spielzeit des ersten Tipps (L1)', () => {
  it.each([
    {
      name: 'Gelbe Karte',
      send: (h: ReturnType<typeof laufendBei325>) =>
        h.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', 'YELLOW_CARD', {
          playerNumber: 7,
          clockMs: ERSTER_TIPP_MS,
        }),
      type: 'YELLOW_CARD',
    },
    {
      name: 'Zeitstrafe',
      send: (h: ReturnType<typeof laufendBei325>) =>
        h.commands.timePenalty(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', {
          playerNumber: 7,
          clockMs: ERSTER_TIPP_MS,
        }),
      type: 'TIME_PENALTY',
    },
    {
      name: 'Tor',
      send: (h: ReturnType<typeof laufendBei325>) =>
        h.commands.goal(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', false, {
          playerNumber: 7,
          clockMs: ERSTER_TIPP_MS,
        }),
      type: 'GOAL',
    },
    {
      name: 'Eigentor',
      send: (h: ReturnType<typeof laufendBei325>) =>
        h.commands.goal(B07_CTX.matchId, B07_CTX, 'helper', 'sv-sued', true, {
          playerNumber: 4,
          clockMs: ERSTER_TIPP_MS,
        }),
      type: 'OWN_GOAL',
    },
  ])('@SL-084 $name: gespeichert bei 3:12, obwohl erst bei 3:25 gesendet', async ({ send, type }) => {
    const harness = laufendBei325();

    await send(harness);

    expect(harness.stored).toHaveLength(1);
    expect(harness.stored[0].type).toBe(type);
    expect(harness.stored[0].clockMs).toBe(ERSTER_TIPP_MS);
    expect(harness.stored[0].at).toBe(KICKOFF_AT + NUMMER_DA_MS);
    // `clockMs` ist Spielzeit des Umschlags, nicht Teil der Payload.
    expect(harness.stored[0].payload).not.toHaveProperty('clockMs');
  });

  it('Gegenbeispiel: ohne `clockMs` gilt wie bisher die Spielzeit des Sendens (3:25)', async () => {
    const harness = laufendBei325();

    await harness.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', 'YELLOW_CARD', { playerNumber: 7 });

    expect(harness.stored[0].clockMs).toBe(NUMMER_DA_MS);
  });

  it('Fixrunde F2: Spielzeit des Tipps hinter der aktuellen (Offset sank um 2 s) -> geklemmt, nicht abgelehnt', async () => {
    const harness = laufendBei325();

    // Das Geraet sah beim Tipp 3:25, nach der Offset-Korrektur steht die Spielzeit bei 3:23.
    harness.setNow(KICKOFF_AT + NUMMER_DA_MS - 2_000);
    await harness.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', 'YELLOW_CARD', { clockMs: NUMMER_DA_MS });

    expect(harness.stored).toHaveLength(1);
    expect(harness.stored[0].clockMs).toBe(NUMMER_DA_MS - 2_000);
  });

  it('Fixrunde F2: Uhr zurueckgestellt, waehrend der Dialog offen war -> geklemmt auf die neue Spielzeit', async () => {
    const zurueck = plain('CLOCK_ADJUST', KICKOFF_AT + 200_000, 150_000, 1, { payload: { previousClockMs: 200_000 } });
    const harness = makeHarness([kickoff(), zurueck], KICKOFF_AT + 205_000);

    await harness.commands.timePenalty(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', { clockMs: ERSTER_TIPP_MS });

    expect(harness.stored[0].clockMs).toBe(155_000);
  });

  it.each([
    { name: 'negativ', clockMs: -1 },
    { name: 'keine ganze Zahl', clockMs: 192_000.5 },
    { name: 'NaN', clockMs: Number.NaN },
  ])('Gegenbeispiel: Spielzeit $name -> abgelehnt (INVALID_PAYLOAD, CLOCK_OUT_OF_RANGE), nichts gespeichert, kein kick', async ({ clockMs }) => {
    const harness = laufendBei325();

    const sending = harness.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', 'YELLOW_CARD', { clockMs });

    await expect(sending).rejects.toMatchObject({
      name: 'MatchCommandRejectedError',
      code: ERROR_CODES.INVALID_PAYLOAD,
      detail: { reason: 'CLOCK_OUT_OF_RANGE' },
    });
    expect(harness.stored).toHaveLength(0);
    expect(harness.kick).not.toHaveBeenCalled();
  });

  it('Grenze: genau die aktuelle Spielzeit ist erlaubt', async () => {
    const harness = laufendBei325();

    await harness.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', 'YELLOW_CARD', { clockMs: NUMMER_DA_MS });

    expect(harness.stored[0].clockMs).toBe(NUMMER_DA_MS);
  });
});

describe('MatchCommands – Ereignis-ID (S4/R4)', () => {
  it('goal liefert die ID des gespeicherten Eintrags', async () => {
    const harness = laufendBei325();

    const id = await harness.commands.goal(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', false);

    expect(id).toBe(harness.stored[0].id);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('jeder Befehl liefert seine eigene ID (zwei Tore -> zwei IDs in Reihenfolge)', async () => {
    const harness = laufendBei325();

    const [first, second] = await Promise.all([
      harness.commands.goal(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', false),
      harness.commands.goal(B07_CTX.matchId, B07_CTX, 'helper', 'sv-sued', false),
    ]);

    expect([first, second]).toEqual(harness.stored.map((event) => event.id));
    expect(first).not.toBe(second);
  });

  it('Gegenbeispiel noop: zweites Spielende speichert nichts und liefert null', async () => {
    const harness = makeHarness([kickoff(), plain('MATCH_END', KICKOFF_AT + 1_200_000, 1_200_000, 1)], KICKOFF_AT + 1_300_000);

    const id = await harness.commands.finish(B07_CTX.matchId, B07_CTX, 'helper');

    expect(id).toBeNull();
    expect(harness.stored).toHaveLength(0);
    expect(harness.kick).not.toHaveBeenCalled();
  });

  it('Ablehnung liefert keine ID, sondern wirft MatchCommandRejectedError', async () => {
    const harness = makeHarness([], KICKOFF_AT);

    await expect(harness.commands.goal(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', false)).rejects.toThrow(
      MatchCommandRejectedError,
    );
  });
});

describe('MatchCommands – Fixrunde F5: Abschnitt des ersten Tipps', () => {
  const nachWiederanpfiff = () =>
    makeHarness(
      [kickoff(), plain('SECTION_END', KICKOFF_AT + 600_000, 600_000, 1), plain('SECTION_START', KICKOFF_AT + 660_000, 600_000, 1)],
      KICKOFF_AT + 670_000,
    );

  it('Tipp in Abschnitt 1 (9:58), gesendet nach dem Wiederanpfiff -> section 1, clockMs 598 000', async () => {
    const harness = nachWiederanpfiff();

    await harness.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', 'YELLOW_CARD', {
      playerNumber: 7,
      clockMs: 598_000,
      section: 1,
    });

    expect(harness.stored[0]).toMatchObject({ section: 1, clockMs: 598_000 });
    expect(harness.stored[0].payload).not.toHaveProperty('section');
  });

  it('Gegenbeispiel: ohne Abschnitt des Tipps gilt der aktuelle Abschnitt (2)', async () => {
    const harness = nachWiederanpfiff();

    await harness.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', 'YELLOW_CARD', { clockMs: 605_000 });

    expect(harness.stored[0].section).toBe(2);
  });

  it.each([
    { name: 'nach dem aktuellen Abschnitt (3)', section: 3 },
    { name: '0', section: 0 },
    { name: 'keine ganze Zahl', section: 1.5 },
  ])('Abschnitt $name -> abgelehnt (INVALID_PAYLOAD, SECTION_OUT_OF_RANGE), nichts gespeichert', async ({ section }) => {
    const harness = nachWiederanpfiff();

    await expect(
      harness.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', 'YELLOW_CARD', { clockMs: 598_000, section }),
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_PAYLOAD, detail: { reason: 'SECTION_OUT_OF_RANGE' } });
    expect(harness.stored).toHaveLength(0);
  });
});

describe('MatchCommands – Fixrunde F4: Anzeige-Fehler nach dem Speichern', () => {
  it('notifyStoreChange wirft -> der Befehl liefert trotzdem die ID, der Eintrag ist gespeichert und wird gesendet', async () => {
    const harness = makeHarness([kickoff()], KICKOFF_AT + NUMMER_DA_MS, 'acc-b07', { notifyFails: true });

    const id = await harness.commands.goal(B07_CTX.matchId, B07_CTX, 'helper', 'fc-nord', false);

    expect(harness.stored).toHaveLength(1);
    expect(id).toBe(harness.stored[0].id);
    expect(harness.kick).toHaveBeenCalledWith(B07_CTX.matchId);
  });

  it('Gegenbeispiel: scheitert das Speichern selbst, wirft der Befehl weiter (keine ID)', async () => {
    const harness = makeHarness([kickoff()], KICKOFF_AT + NUMMER_DA_MS, 'acc-b07', { notifyFails: true });

    await expect(harness.commands.goal(B07_CTX.matchId, B07_CTX, 'helper', 'nicht-im-spiel', false)).rejects.toThrow(
      MatchCommandRejectedError,
    );
    expect(harness.kick).not.toHaveBeenCalled();
  });
});
