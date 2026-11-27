/**
 * @ZM-218 Im Spielplan der Zuschauer-Seite stehen Stand und Logos in jeder Zeile an derselben Stelle: der Stand mittig zwischen den Teams, die Logos beider Teams
 * in denselben Spalten, der Aufklapp-Pfeil verschiebt nichts (auch nicht in Zeilen ohne Pfeil oder mit zweistelligem Stand „12:3“).
 * Läuft nur im Profil `desktop` und setzt das Fenster selbst: 1280 (Laptop) und 1024 (Tablet quer); 390 (Handy hochkant) bleibt ein anderes Layout und wird hier nicht
 * auf Spalten geprüft. Saat: Messlauf-Turnier (`helpers/messlaufTaching.ts`), Spiel 9 auf 12:3 gesetzt.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { messSaat, SCHRAEGSTRICH_NAME, TURNIER_ID, ZUSCHAUER_CODE } from './helpers/messlaufTaching';
import { animationenFertig } from './helpers/animationenFertig';

const BEENDET = '00000003-0000-4000-8000-000000000001';
const LAUFEND = '00000003-0000-4000-8000-000000000005';

async function oeffne(page: Page, breite: number): Promise<void> {
  await page.setViewportSize({ width: breite, height: 900 });
  const saat = messSaat();
  const turniere = saat.datenbanken.find((db) => db.store === 'cache')?.eintraege.tournaments as Array<{ id: string; matches: Array<Record<string, unknown>> }>;
  const spiele = turniere.find((t) => t.id === TURNIER_ID)?.matches ?? [];
  // ein Gruppenspiel läuft (Uhr und Zustand vom laufenden Finale der Saat), damit der Weg „laufendes Spiel“ im Spielplan der Gruppenphase vorkommt
  const laufend = spiele.find((m) => m.id === LAUFEND);
  const vorlage = spiele.find((m) => m.matchStatus === 'running');
  if (laufend === undefined || vorlage === undefined) { throw new Error('Saat ohne laufendes Spiel'); }
  Object.assign(laufend, { matchStatus: 'running', timerElapsedSeconds: vorlage.timerElapsedSeconds, timerStartTime: vorlage.timerStartTime, liveState: vorlage.liveState });
  turniere.find((t) => t.id === TURNIER_ID)?.matches.forEach((m, i) => {
    if (i % 2 === 0 && m.matchStatus === 'finished' && Number(m.scoreA) + Number(m.scoreB) > 0) {
      m.events = [{ id: `ereignis-${String(i)}`, matchId: String(m.id), timestampSeconds: 180, type: 'GOAL', payload: { direction: 'INC' }, scoreAfter: { home: 1, away: 0 } }];
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installiereSaat(page.context(), saat);
  await page.goto(`/#/live/${ZUSCHAUER_CODE}`);
  await expect(page.getByText(SCHRAEGSTRICH_NAME).filter({ visible: true }).first()).toBeVisible({ timeout: 25000 });
  await animationenFertig(page);
}


/** Der Pfeil der sichtbaren Zeile des Spiels: App-Symbol am Laptop, Zeichen „▼“ in der Handy-Karte (die ausgeblendete Fassung für das andere Gerät ist nicht sichtbar). */
function pfeil(page: Page, id: string) {
  return page.locator('[role="article"], [data-testid="match-card"]').filter({ has: page.getByTestId(`match-name-${id}-home`) }).filter({ visible: true }).locator('[data-testid^="match-arrow-"], span:text-is("▼")').filter({ visible: true }).first();
}
const stand = (page: Page, id: string) => page.locator(`[data-testid="match-circle-${id}"], [data-testid="match-goals-${id}-home"]`).filter({ visible: true }).first();
const name = (page: Page, id: string) => page.getByTestId(`match-name-${id}-home`).filter({ visible: true }).first();

test.describe('@ZM-219 Ereignisse im Spielplan der Zuschauer-Seite klappen mit dem zweiten Tipp wieder zu', () => {
  for (const breite of [1280, 390]) {
    for (const [titel, id, ziel] of [
      ['beendetes Spiel, Tipp auf den Stand', BEENDET, stand],
      ['beendetes Spiel, Tipp auf die Zeile (Teamname)', BEENDET, name],
      ['laufendes Spiel, Tipp auf den Stand', LAUFEND, stand],
      ['laufendes Spiel, Tipp auf die Zeile (Teamname)', LAUFEND, name],
    ] as const) {
      test(`@ZM-219 bei ${String(breite)} Pixeln: ${titel} öffnet, der zweite Tipp schließt`, async ({ page }) => {
        test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
        await oeffne(page, breite);
        const offen = page.locator('[data-expand-content]').filter({ visible: true });
        await expect(offen).toHaveCount(0);
        await ziel(page, id).click();
        await expect(offen, 'erster Tipp öffnet die Ereignisse').toHaveCount(1);
        if (id === BEENDET) {
          await expect(pfeil(page, id), 'Pfeil zeigt nach oben').toHaveCSS('transform', /matrix\(-1/);
        }
        await ziel(page, id).click();
        await expect(offen, 'zweiter Tipp schließt die Ereignisse').toHaveCount(0);
        if (id === BEENDET) {
          await expect(pfeil(page, id), 'Pfeil zeigt wieder nach unten').not.toHaveCSS('transform', /matrix\(-1/);
        }
      });
    }
  }

  test('@ZM-219 bei 1280 Pixeln: ein Tipp auf den Pfeil neben dem Stand klappt die Ereignisse auf, der zweite wieder zu', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
    await oeffne(page, 1280);
    const offen = page.locator('[data-expand-content]').filter({ visible: true });
    await pfeil(page, BEENDET).click();
    await expect(offen).toHaveCount(1);
    await pfeil(page, BEENDET).click();
    await expect(offen).toHaveCount(0);
  });

  test('@ZM-219 bei 390 Pixeln: „Wann und Wo“ klappt mit dem zweiten Tipp wieder zu', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
    await oeffne(page, 390);
    const taste = page.getByTestId('public-head-when-where');
    await expect(taste).toHaveAttribute('aria-expanded', 'false');
    await taste.click();
    await expect(taste).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('public-head-details')).toBeVisible();
    await taste.click();
    await expect(taste).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('public-head-details')).toBeHidden();
  });

  test('@ZM-219 bei 390 Pixeln: „Teilnehmer“ klappt mit dem zweiten Tipp wieder zu', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
    await oeffne(page, 390);
    const taste = page.getByTestId('public-participants-toggle');
    await expect(taste).toHaveAttribute('aria-expanded', 'false');
    await taste.click();
    await expect(taste).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('public-participants-list')).toBeVisible();
    await taste.click();
    await expect(taste).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('public-participants-list')).toBeHidden();
  });

  test('@ZM-219 bei 390 Pixeln: eine Zeile der Gruppentabelle klappt mit dem zweiten Tipp wieder zu', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
    await oeffne(page, 390);
    await page.locator('nav[aria-label="Public Navigation"] button').nth(1).click();
    const taste = page.locator('.standings-table .mobile-view tbody button').first();
    await expect(taste).toHaveAttribute('aria-expanded', 'false');
    await taste.click();
    await expect(taste).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.standings-table .mobile-view').getByText('Siege').first()).toBeVisible();
    await taste.click();
    await expect(taste).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.standings-table .mobile-view').getByText('Siege').first()).toBeHidden();
  });
});
