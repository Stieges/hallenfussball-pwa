/**
 * MatchCommands (B-08b): ein automatisches Ende trägt auf Wunsch eine feste Ereignis-ID (`timing.id`).
 * Zwei Geräte mit demselben Log erzeugen so denselben Eintrag (gleiche ID, gleicher Inhalt) und der Server
 * erkennt den zweiten als Wiederholung (@FU-070). Ohne `id` bleibt es bei einer zufälligen.
 * Werte: Spiel 11, zwei Abschnitte zu je 10 Minuten (B07_RULES), erstes Ende bei 10:00.
 */
import { describe, expect, it } from 'vitest';
import { B07_CTX, B07_RULES, KICKOFF_AT, kickoff, makeHarness } from './commandHarness';

const FEST = '5b1c0c3e-8a64-5a6d-8a53-0a9f6f0d1e11';
const GRENZE = { clockMs: 600_000, at: KICKOFF_AT + 600_000 };
const ID = B07_CTX.matchId;

describe('MatchCommands: timing.id', () => {
  it('endSection mit timing.id speichert genau diese ID, Spielzeit und Zeitpunkt wörtlich', async () => {
    const h = makeHarness([kickoff()], KICKOFF_AT + 601_500);
    await h.commands.endSection(ID, B07_CTX, 'helper', { ...GRENZE, id: FEST });
    expect(h.stored).toHaveLength(1);
    expect(h.stored[0]).toMatchObject({ type: 'SECTION_END', id: FEST, clockMs: 600_000, at: KICKOFF_AT + 600_000 });
  });

  it('finish mit timing.id speichert genau diese ID', async () => {
    const h = makeHarness([kickoff({ ...B07_RULES, sections: 1 })], KICKOFF_AT + 601_500);
    await h.commands.finish(ID, B07_CTX, 'helper', { ...GRENZE, id: FEST });
    expect(h.stored[0]).toMatchObject({ type: 'MATCH_END', id: FEST });
  });

  it('Gegenbeispiel: ohne timing.id sind die IDs zufällig und verschieden', async () => {
    const eins = makeHarness([kickoff()], KICKOFF_AT + 601_500);
    const zwei = makeHarness([kickoff()], KICKOFF_AT + 601_500);
    await eins.commands.endSection(ID, B07_CTX, 'helper', GRENZE);
    await zwei.commands.endSection(ID, B07_CTX, 'helper', GRENZE);
    expect(eins.stored[0].id).not.toBe(zwei.stored[0].id);
  });

  it('zwei Geräte, derselbe Log, dieselbe Grenze: derselbe Eintrag (ID und Inhalt), der Server nimmt ihn einmal an', async () => {
    const start = kickoff();
    const a = makeHarness([start], KICKOFF_AT + 601_000);
    const b = makeHarness([start], KICKOFF_AT + 602_000);
    await a.commands.endSection(ID, B07_CTX, 'helper', { ...GRENZE, id: FEST });
    await b.commands.endSection(ID, B07_CTX, 'helper', { ...GRENZE, id: FEST });
    expect(b.stored[0]).toEqual(a.stored[0]);
    expect(new Map([a.stored[0], b.stored[0]].map((event) => [event.id, event])).size).toBe(1);
  });
});
