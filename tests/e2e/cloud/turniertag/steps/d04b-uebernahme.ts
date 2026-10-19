/**
 * D4b Übernahme mitten im Spiel durch ein zweites Gerät (Tablet der Turnierleitung), laufende Zeitstrafe sichtbar.
 * Besitzer: ZA-1/2, A-34, B-49 und #272 (Restzeit der Zeitstrafe aus den Ereignissen).
 * Gherkin: @SL-015 (Olli übernimmt das Spiel) und @FU-027 (Turnierleitung übernimmt jederzeit); Befund C-ZEITSTRAFE-RESTZEIT-NUR-LOKAL.
 */
import { expect } from '@playwright/test';
import { openCockpit } from '../../engineHelpers';
import { appendOwner, eventOf } from './playViaRpc';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function uebernahmeMitZeitstrafe({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const match = groupMatches[3];
  const start = Date.now() - 20_000;
  const events = [
    eventOf('MATCH_START', start, start),
    eventOf('TIME_PENALTY', start + 5000, start, { teamId: match.team_b_id, payload: { durationSeconds: 120 } }),
  ];
  expect((await appendOwner(match.id, events)).results.map((r) => r.status)).toEqual(['accepted', 'accepted']);
  // Das zweite Gerät hat die Zeitstrafe nie lokal erfasst: seine Restzeit kann nur aus den Ereignissen kommen.
  const tablet = await asRole('owner');
  await openCockpit(tablet, TURNIERTAG_ID, match.id);
  await expectPageAnchor(tablet.locator('[data-testid="team-name-home"]'), 'Cockpit auf dem zweiten Gerät');
  await expect(tablet.getByText('Aktive Zeitstrafen').first(), 'laufende Zeitstrafe auf dem übernehmenden Gerät').toBeVisible({ timeout: 5000 });
  await expectSollMarker(tablet, 'cockpit-takeover-button');
}

export const steps: readonly TurniertagStep[] = [
  {
    id: 'D4b', title: 'Übernahme mitten im Spiel: zweites Gerät sieht die laufende Zeitstrafe', scenarios: ['@SL-015', '@FU-027'],
    befunde: ['C-ZEITSTRAFE-RESTZEIT-NUR-LOKAL'], owner: 'ZA-1/2, A-34, B-49 (#272)', expectedFail: true, run: uebernahmeMitZeitstrafe,
  },
];
