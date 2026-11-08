/**
 * Eine Zeitstrafe trägt ihre Dauer im Eintrag (@ZM-182, @ZM-184, @W2A-029): Monitor und Zuschauer-Seite kennen die
 * Spielregel nicht (Positivliste: aus den Cockpit-Einstellungen nur Uhr-Art und Schlussphase) und rechnen die Restzeit
 * aus der Dauer des öffentlichen Eintrags. Die Dauer kommt aus der Regel beim Anpfiff, nie aus einer Auswahl im Cockpit
 * (@SL-029); die Engine rechnet mit derselben Zahl wie bisher.
 */
import { describe, expect, it } from 'vitest';
import { B07_CTX, B07_RULES, KICKOFF_AT, kickoff, makeHarness } from './commandHarness';

describe('@ZM-182 @ZM-184 der Zeitstrafen-Eintrag trägt die Dauer der Spielregel', () => {
  it('@ZM-184 Regel 2 Minuten: der gespeicherte Eintrag trägt durationSeconds 120', async () => {
    const harness = makeHarness([kickoff()], KICKOFF_AT + 200_000);
    await harness.commands.timePenalty(B07_CTX.matchId, B07_CTX, 'helper', 'sv-sued', { playerNumber: 5 });
    expect(harness.stored[0].payload).toEqual({ playerNumber: 5, durationSeconds: 120 });
  });

  it('@W2A-029 Regel 1 Minute beim Anpfiff: der Eintrag trägt 60 (nicht die Vorgabe 120)', async () => {
    const harness = makeHarness([kickoff({ ...B07_RULES, penaltySeconds: 60 })], KICKOFF_AT + 200_000);
    await harness.commands.timePenalty(B07_CTX.matchId, B07_CTX, 'helper', 'sv-sued', { playerNumber: 5 });
    expect(harness.stored[0].payload).toMatchObject({ durationSeconds: 60 });
  });

  it('Gegenbeispiel: eine ausdrücklich mitgegebene Dauer bleibt unverändert', async () => {
    const harness = makeHarness([kickoff()], KICKOFF_AT + 200_000);
    await harness.commands.timePenalty(B07_CTX.matchId, B07_CTX, 'helper', 'sv-sued', { durationSeconds: 300 });
    expect(harness.stored[0].payload).toMatchObject({ durationSeconds: 300 });
  });

  it('Gegenbeispiel: andere Einträge (Gelbe Karte) bekommen keine Dauer', async () => {
    const harness = makeHarness([kickoff()], KICKOFF_AT + 200_000);
    await harness.commands.card(B07_CTX.matchId, B07_CTX, 'helper', 'sv-sued', 'YELLOW_CARD', { playerNumber: 5 });
    expect(harness.stored[0].payload).toEqual({ playerNumber: 5 });
  });
});
