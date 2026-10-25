/**
 * R3-1 – Startseite, Archiv und Statuskopf zeigen den gespeicherten Zustand (@LZ-001, @LZ-006) im echten Bedienweg (lokal, ohne Server).
 * Bilder: Ordner aus ZL_BILDER, je Größe Handy 360×640 und Laptop 1280×720, hell und dunkel. Läuft nur im Projekt `desktop` (setzt Fenster selbst).
 * Der Zustand liegt in der lokalen Kopie als `lifecycleStatus` (kommt vom Server); ohne ihn gilt „festgelegt“ (status published).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.ZL_BILDER;
const GROESSEN = [{ name: '360x640', width: 360, height: 640 }, { name: '1280x720', width: 1280, height: 720 }];
const SCHEMAS = ['light', 'dark'] as const;

// Saat „Hallencup“ (wie `npm run visual:metrics --saat`) plus zwei Turniere, die dieser Test aus der Saat ableitet:
// „alle-entschieden“ hat alle Spiele beendet, aber nichts abgeschlossen (@LZ-006: bleibt „Läuft“); „abschluss-messlauf“ wird hier
// vom Server als abgeschlossen geliefert (lifecycleStatus finished, @LZ-001: Archiv).
const ALLE_ENTSCHIEDEN = 'alle-entschieden';
const ABGESCHLOSSEN = 'abschluss-messlauf';
const ENTWURF = 'hallencup-entwurf';

function saatMitServerZustand() {
  const saat = leseSaat('hallencup-messlauf');
  const turniere = saat.datenbanken.find((db: { store: string }) => db.store === 'cache').eintraege.tournaments as Array<Record<string, unknown>>;
  const vorlage = turniere.find((t) => t.id === 'hallencup-messlauf') as { matches: Array<Record<string, unknown>> };
  // neue Spiel-Kennungen, sonst legt die lokale Spiel-Ablage („guest|…“) des Vorbilds die laufenden Spiele wieder darüber
  let kopie = JSON.stringify(vorlage);
  for (const m of vorlage.matches) { kopie = kopie.split(String(m.id)).join(`f${String(m.id).slice(1)}`); } // bleibt eine gültige UUID
  const klon = JSON.parse(kopie) as { matches: Array<Record<string, unknown>> };
  turniere.push({
    ...klon, id: ALLE_ENTSCHIEDEN, title: 'Hallencup Alle Spiele entschieden', lifecycleStatus: 'fixed',
    matches: klon.matches.map((m) => ({ ...m, matchStatus: 'finished', scoreA: m.scoreA ?? 1, scoreB: m.scoreB ?? 0, liveState: undefined })),
  });
  for (const t of turniere) {
    if (t.id === ABGESCHLOSSEN) { Object.assign(t, { lifecycleStatus: 'finished', finishedAt: '2026-11-14T16:00:00.000Z' }); }
  }
  return saat;
}

async function bild(page: Page, name: string, groesse: string, schema: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity) // Dauer-Animationen (Puls) enden nie
    .map((a) => a.finished.catch(() => undefined))));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(BILDER, `${name}-${groesse}-${schema}.png`), fullPage: true });
}

for (const groesse of GROESSEN) {
  for (const schema of SCHEMAS) {
    test.describe(`Zustand lesen ${groesse.name} ${schema}`, () => {
      test.beforeEach(async ({ page }, testInfo) => {
        test.skip(!testInfo.project.name.includes('desktop'), 'Nur desktop (setzt Fenster selbst).');
        await page.setViewportSize(groesse);
        await page.emulateMedia({ colorScheme: schema });
        await installiereSaat(page.context(), saatMitServerZustand());
        await page.goto('/#/');
        await expect(page.getByTestId('section-running')).toBeVisible({ timeout: 20000 });
      });

      test('@LZ-006 alle Spiele entschieden, nicht abgeschlossen: steht unter „Läuft“, nicht im Archiv', async ({ page }) => {
        const laeuft = page.getByTestId('section-running');
        await expect(laeuft.getByTestId(`tournament-card-${ALLE_ENTSCHIEDEN}`)).toBeVisible();
        await expect(laeuft.getByTestId(`tournament-card-${ABGESCHLOSSEN}`)).toHaveCount(0);
        await bild(page, '1-startseite', groesse.name, schema);
        await page.goto('/#/archiv');
        await expect(page.getByTestId(`tournament-card-${ABGESCHLOSSEN}`)).toBeVisible();
        await expect(page.getByTestId(`tournament-card-${ALLE_ENTSCHIEDEN}`)).toHaveCount(0);
        await expect(page.getByTestId(`tournament-card-${ENTWURF}`)).toHaveCount(0);
        await bild(page, '2-archiv', groesse.name, schema);
      });

      test('@LZ-006 der Statuskopf im Turnier zeigt „Läuft“, nicht „Abgeschlossen“; am Server abgeschlossen zeigt „Abgeschlossen“', async ({ page }) => {
        await page.goto(`/#/tournament/${ALLE_ENTSCHIEDEN}/admin/dashboard`);
        const kopf = page.getByTestId('admin-status-banner');
        await expect(kopf).toContainText('Läuft');
        await expect(kopf).not.toContainText('Abgeschlossen');
        await bild(page, '3-statuskopf-laeuft', groesse.name, schema);
        await page.goto(`/#/tournament/${ABGESCHLOSSEN}/admin/dashboard`);
        await expect(page.getByTestId('admin-status-banner')).toContainText('Abgeschlossen');
        await bild(page, '4-statuskopf-abgeschlossen', groesse.name, schema);
      });

      test('C-FINISH-PROMISE der Gefahrenbereich bietet „Turnier beenden“/„Turnier archivieren“ nicht mehr an', async ({ page }) => {
        await page.goto(`/#/tournament/${ALLE_ENTSCHIEDEN}/admin/danger-zone`);
        await expect(page.getByRole('button', { name: 'Spielplan zurücksetzen' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Turnier beenden|Turnier archivieren/i })).toHaveCount(0);
        await bild(page, '5-gefahrenbereich', groesse.name, schema);
      });
    });
  }
}
