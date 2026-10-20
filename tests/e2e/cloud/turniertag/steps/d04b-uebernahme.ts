/**
 * D4b Übernahme mitten im Spiel durch ein zweites Gerät (Tablet der Turnierleitung), laufende Zeitstrafe sichtbar.
 * Besitzer: ZA-1/2, A-34, B-49 und #272 (Restzeit der Zeitstrafe aus den Ereignissen).
 * Gherkin: @FU-027 (Turnierleitung übernimmt jederzeit); Befund C-ZEITSTRAFE-RESTZEIT-NUR-LOKAL. @SL-015 (Hinweis "Uhr
 * prüfen") prüft der Schritt nicht und trägt es deshalb nicht. Eigenes Spiel: Gruppenspiel 12 (die letzten drei Gruppenspiele
 * gehören D6, D6z und D4b; D8 beendet sie mit `finishingEvents` zeitrichtig).
 */
import { expect } from '@playwright/test';
import { openCockpit } from '../../engineHelpers';
import { appendOwner, eventOf } from './playViaRpc';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, TURNIERTAG_ID, vorbedingung } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function uebernahmeMitZeitstrafe({ asRole }: StepContext): Promise<void> {
  const match = await vorbedingung('Gruppenspiel 12 anpfeifen, Zeitstrafe von 120 s eintragen', async () => {
    const { groupMatches } = await fetchTurniertagBracket();
    const gewaehlt = groupMatches[11];
    const start = Date.now() - 20_000;
    const events = [
      eventOf('MATCH_START', start, start),
      eventOf('TIME_PENALTY', start + 5000, start, { teamId: gewaehlt.team_b_id, payload: { durationSeconds: 120 } }),
    ];
    expect((await appendOwner(gewaehlt.id, events)).results.map((r) => r.status)).toEqual(['accepted', 'accepted']);
    return gewaehlt;
  });
  // Das zweite Gerät hat die Zeitstrafe nie lokal erfasst: seine Restzeit kann nur aus den Ereignissen kommen.
  const tablet = await asRole('owner');
  await openCockpit(tablet, TURNIERTAG_ID, match.id);
  await expectPageAnchor(tablet.locator('[data-testid="team-name-home"]'), 'Cockpit auf dem zweiten Gerät');
  await expect(tablet.getByText('Aktive Zeitstrafen').first(), 'laufende Zeitstrafe auf dem übernehmenden Gerät').toBeVisible({ timeout: 5000 });
  await expectSollMarker(tablet, 'cockpit-takeover-button');
}

export const steps: readonly TurniertagStep[] = [
  {
    id: 'D4b', title: 'Übernahme mitten im Spiel: zweites Gerät sieht die laufende Zeitstrafe', scenarios: ['@FU-027'],
    befunde: ['C-ZEITSTRAFE-RESTZEIT-NUR-LOKAL'], owner: 'ZA-1/2, A-34, B-49 (#272)', expectedFail: true, run: uebernahmeMitZeitstrafe,
  },
];
