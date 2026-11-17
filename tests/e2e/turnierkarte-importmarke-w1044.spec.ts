/**
 * @W1-044 Die Marke „Import“ steht nur an Turnieren, deren Spielplan importiert wurde – auf der Startseite, im echten Browser.
 * Zwei Karten mit denselben Daten bis auf die Quelle: Datei mit Spielplan (Marke) und Datei nur mit Teams, Spielplan danach im
 * Assistenten erzeugt (keine Marke). Bilder (Breiten 390 und 1440) in den Ordner aus W1044_BILDER.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const MIT_SPIELPLAN = buildVisualTournament({
  id: 'w1044-mit', title: 'Nikolausturnier – Datei mit Spielplan', extra: { isExternal: true, externalSource: 'Import (komplett)' },
});
const NUR_TEAMS = buildVisualTournament({
  id: 'w1044-teams', title: 'Nikolausturnier – F2-Jugend', extra: { isExternal: true, externalSource: 'Import (nur Teams)' },
});

for (const breite of [390, 1440]) {
  test(`@W1-044 Startseite bei ${breite} px: Marke „Import“ nur an der Karte mit importiertem Spielplan`, async ({ page, seedIndexedDB }) => {
    await page.setViewportSize({ width: breite, height: 900 });
    await seedIndexedDB({ tournaments: [MIT_SPIELPLAN, NUR_TEAMS] });
    await page.goto('/#/');
    const mit = page.getByTestId('tournament-card-w1044-mit');
    const teams = page.getByTestId('tournament-card-w1044-teams');
    await expect(mit).toBeVisible();
    await expect(teams).toBeVisible();

    const ordner = process.env.W1044_BILDER;
    if (ordner !== undefined) {
      mkdirSync(ordner, { recursive: true });
      await page.screenshot({ path: join(ordner, `startseite-${breite}-${process.env.W1044_STAND ?? 'nachher'}.png`) });
    }

    await expect(mit.getByTestId('card-import-mark')).toHaveText('Import (komplett)');
    await expect(teams.getByTestId('card-import-mark')).toHaveCount(0);
    await expect(teams).not.toContainText('Import');

  });
}
