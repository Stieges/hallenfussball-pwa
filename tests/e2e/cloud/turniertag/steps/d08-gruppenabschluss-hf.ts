/**
 * D8 Gruppenabschluss -> Halbfinale über Kreuz. Besitzer: A-13 (Auflösung der Finalrunde).
 * Besitzer: A-13 -- Soll: sobald alle Gruppenspiele beendet sind, setzt die Auflösung die Teams
 * der Halbfinals (Erster A/Zweiter B und Erster B/Zweiter A) in der Cloud, auch ohne geöffnetes
 * Gerät der Turnierleitung (heute geschieht das nur im Client beim Öffnen).
 */
import { expect } from '@playwright/test';
import { fetchEngineRows } from '../../engineHelpers';
import { fetchTurniertagBracket, fetchTurniertagMatches, SOLL_TIMEOUT_MS } from './shared';
import { appendOwner, eventOf, regularResultEvents } from './playViaRpc';
import type { StepContext, TurniertagStep } from './types';

async function gruppenabschluss(_ctx: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  for (const [index, match] of groupMatches.entries()) {
    const rows = await fetchEngineRows(match.id);
    if (rows.some((row) => row.type === 'MATCH_END')) {
      continue;
    }
    const alreadyStarted = rows.some((row) => row.type === 'MATCH_START');
    const events = regularResultEvents(match, (index % 3) + 1, index % 2);
    let remaining;
    if (alreadyStarted) {
      const hasSectionEnd = rows.some((row) => row.type === 'SECTION_END');
      const hasSectionStart = rows.some((row) => row.type === 'SECTION_START');
      if (hasSectionEnd && !hasSectionStart) {
        remaining = [eventOf('SECTION_START', Date.now() - 599_000, Date.now() - 600_000, { section: 2 }), ...events.slice(-1)];
      } else {
        remaining = events.slice(-1);
      }
    } else {
      remaining = events;
    }
    const result = await appendOwner(match.id, remaining);
    expect(result.results.map((r) => r.status), `Gruppenspiel ${index + 1}`).toEqual(remaining.map(() => 'accepted'));
  }
  // Soll (A-13): beide Halbfinals sind in der Cloud besetzt.
  await expect.poll(async () => (await fetchTurniertagMatches()).filter((m) => m.phase !== 'groupStage').slice(0, 2).every((m) => m.team_a_id && m.team_b_id), {
    message: 'Halbfinale 1 und 2 sind nach dem Gruppenabschluss besetzt',
    timeout: SOLL_TIMEOUT_MS,
  }).toBe(true);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D8', title: 'Gruppenabschluss: Halbfinale über Kreuz besetzt', scenarios: [], owner: 'A-13', expectedFail: true, run: gruppenabschluss },
];
