/**
 * D3b Helfer trägt auf seinem Feld ein Tor ein, auf dem Handy (390 x 844, Touch). Besitzer: A-16/A-17/A-18, A-27.
 * Soll (@HE-042, Tabellenzeile „ein Tor eintragen und wieder zurücknehmen → gelingt“, in der App und in der Datenbank): der Helfer trägt auf seinem
 * Feld ein Tor ein. Die frühere Erwartung „fremdes Feld gesperrt“ (`helper-field-locked`) stammte aus dem entfallenen @HE-041; @HE-108 macht das Feld
 * zur Vorauswahl ohne Sperre – sie ist aus dem Schritt genommen.
 * Heute erwartet rot, ohne Kennung (CI-Lauf 42728718636): der Turniertag-Cup hat nur den Eigentümer als Mitglied, das Helfer-Handy kommt nicht ins
 * Cockpit (der Seitenanker `team-name-home` fehlt). Ein Aufbau, der den Helfer zulässt, würde ihn auf ein Spiel setzen, das D4/D5/D7/D8/D11/D12/D14 lesen
 * (D4 erwartet genau MATCH_START, GOAL, YELLOW_CARD) oder auf eines, das D8 zeitrichtig beenden muss; das ist ohne Lauf am lokalen Stack nicht sicher.
 * @HE-042 ist durch die Prüfskripte der Geräte-Rollen (`spur-geraete-a27.sh`: Tor als Helfer angenommen, `writeMatchData` ja, `leadMatches` nein) und
 * die Cockpit-Tests belegt, nicht durch diesen Schritt.
 */
import { expect } from '@playwright/test';
import { fetchEngineRows, openCockpit } from '../../engineHelpers';
import { enterGoal } from '../../helpers';
import { expectPageAnchor, fetchTurniertagBracket, mobileRolePage, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function helferLeitetSeinFeld({ browser }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const eigenes = groupMatches.find((m) => m.field === 1);
  expect(eigenes, 'ein Spiel auf Feld 1').toBeTruthy();
  const page = await mobileRolePage(browser, 'helper');
  try {
    await openCockpit(page, TURNIERTAG_ID, eigenes!.id);
    await expectPageAnchor(page.locator('[data-testid="team-name-home"]'), 'Cockpit auf dem Handy');
    expect(page.viewportSize()?.width, 'Handy-Ansicht').toBeLessThan(500);
    const vorher = (await fetchEngineRows(eigenes!.id)).filter((row) => row.type === 'GOAL').length;
    await enterGoal(page, 'home');
    await expect.poll(async () => (await fetchEngineRows(eigenes!.id)).filter((row) => row.type === 'GOAL').length, { timeout: 10000 }).toBe(vorher + 1);
  } finally {
    await page.context().close();
  }
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D3b', title: 'Helfer-Handy trägt ein Tor ein: im Turniertag-Cup fehlt dem Helfer der Zugang (kein Mitglied, Aufbau fehlt)', scenarios: [], owner: 'Aufbau im Turniertag-Cup (Helfer zulassen, eigenes Spiel)', expectedFail: true, run: helferLeitetSeinFeld },
];
