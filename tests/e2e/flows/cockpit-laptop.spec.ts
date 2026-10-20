/**
 * E2E: Cockpit am Laptop, Tablet und Handy ohne Scrollen, Rahmen im laufenden Spiel, Zeile „Nächstes“ (Plan PR 3, T2-UI LT-2/LT-3).
 * Saat: Spiel 1 FC Nord – SV Süd, Spiel 2 TSV Ost – FC West, Foul-Grenze 5. Szenarien: @SL-061 (alle Haupttasten ohne Scrollen, Liste daneben),
 * @SL-140 (schmaler Kopf, keine App-Navigation, keine Fußzeile, „Zurück“ zum Spielplan, Uhr läuft weiter), @SL-005/@SL-070 (Wiederanpfiff im
 * ersten Bildschirm), @SL-157/@SL-158 (Abpfiff halten, kurzer Tipp nicht), K2 (Offline-Hinweis verdeckt die Leiste nicht), K3 (Hinweis im Fluss
 * schiebt die Leiste nicht aus dem Bild), K4 (Tastenwiederholung der Haltetaste), K13 (fünf Knöpfe ≥ 44 px, nichts abgeschnitten),
 * @SL-155/@SL-156/@SL-160/@SL-161 (Zeile „Nächstes“).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { tippeKarte, tippeZeitstrafe } from '../helpers/cockpitNeu';
import { abpfiffHaltenBisRueckfrage } from '../helpers/abpfiff';
import { ID, NAMEN, NAME_50, FARBEN, cup, bild, anpfeifen, unterkante } from '../helpers/laptopCup';

const PFLICHT = ['scoreboard', 'goal-button-home', 'foul-button-home', 'penalty-button-home', 'card-button-home', 'goal-button-away', 'foul-button-away', 'penalty-button-away', 'card-button-away', 'match-pause-button', 'match-finish-button', 'match-undo-button'];

const SPALTEN_TASTEN = ['scoreboard', 'goal-button-home', 'foul-button-home', 'penalty-button-home', 'card-button-home', 'goal-button-away', 'foul-button-away', 'penalty-button-away', 'card-button-away'];

/** Fenster und Inhaltsbereich an den Anfang: gemessen wird, was die Turnierleitung nach dem Anpfiff ohne Zutun sieht. */
async function anAnfangRollen(page: Page): Promise<void> {
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('main').forEach((m) => { m.scrollTop = 0; }); });
}

/** Jede Taste beider Teams (und die Tafel) liegt ganz zwischen Unterkante des Kopfs und Oberkante der Leiste. */
async function pruefeZwischenKopfUndLeiste(page: Page): Promise<void> {
  const kopf = await page.getByTestId('cockpit-slim-header').boundingBox();
  const leiste = await page.getByRole('toolbar').boundingBox();
  if (!kopf || !leiste) { throw new Error('Kopf oder Leiste nicht sichtbar'); }
  const oben = Math.round(kopf.y + kopf.height);
  const unten = Math.round(leiste.y);
  for (const id of SPALTEN_TASTEN) {
    const box = await page.getByTestId(id).boundingBox();
    if (!box) { throw new Error(`${id} nicht sichtbar`); }
    expect(Math.round(box.y), `${id}: Oberkante unter dem Kopf`).toBeGreaterThanOrEqual(oben - 1);
    expect(Math.round(box.y + box.height), `${id}: Unterkante über der Leiste`).toBeLessThanOrEqual(unten + 1);
  }
}

test.describe('Cockpit ohne Scrollen und im Rahmen (Gast, lokal)', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
  });

  test('@SL-061 schwerer Fall: Name mit 50 Zeichen, zwei Zeitstrafen je Team, Rote Karte – Uhr, Stand und alle Haupttasten ohne Scrollen, Liste daneben bzw. über „Ereignisse“', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ namen: [NAME_50, NAMEN[1], NAMEN[2], NAMEN[3]] })] });
    await anpfeifen(page);
    for (const seite of ['home', 'away'] as const) { await tippeZeitstrafe(page, seite); await tippeZeitstrafe(page, seite); }
    await tippeKarte(page, 'home', 'Rot', 7);
    await bild(page, `${testInfo.project.name}-schwer`);

    const hoehe = page.viewportSize()?.height ?? 0;
    for (const id of PFLICHT) { expect(await unterkante(page, id), `${id} liegt im Bild`).toBeLessThanOrEqual(hoehe); }
    const mass = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, ih: window.innerHeight, w: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(mass.h).toBeLessThanOrEqual(mass.ih);
    expect(mass.w).toBeLessThanOrEqual(mass.iw);
    // Die Leiste verdeckt keine Taste: die Tasten liegen über der Oberkante der Leiste
    const leiste = await page.getByRole('toolbar').boundingBox();
    for (const id of ['goal-button-home', 'foul-button-home', 'penalty-button-home', 'card-button-home']) {
      expect(await unterkante(page, id), `${id} unter der Leiste`).toBeLessThanOrEqual(Math.round((leiste?.y ?? 0) + 1));
    }
    const breit = (page.viewportSize()?.width ?? 0) >= 1024;
    if (breit) {
      await expect(page.getByTestId('match-event-log-button')).toHaveCount(0);
      await expect(page.getByTestId('cockpit-flaeche').getByText('Ereignisse', { exact: true })).toBeVisible();
    } else {
      await page.getByTestId('match-event-log-button').click();
      await expect(page.getByTestId('event-log-sheet')).toBeVisible();
    }
  });

  test('@SL-061 Handy und alle Größen, Anfangszustand: Tafel, Tor, Foul, Zeitstrafe und Karte beider Teams liegen ohne Scrollen zwischen Kopf und Leiste', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await anAnfangRollen(page);
    await pruefeZwischenKopfUndLeiste(page);
  });

  test('@SL-061 Handy, schwerer Fall im Anfangszustand: alle Tasten beider Teams liegen ohne Scrollen zwischen Kopf und Leiste – C-COCKPIT-HANDY-KARTE-UNTER-LEISTE', async ({ page, seedIndexedDB }) => {
    // Befund C-COCKPIT-HANDY-KARTE-UNTER-LEISTE (Lösung nach #298 mit kleinerer Tafel, spätestens im Cockpit-Abschluss): bei 360 × 640 reicht die Höhe im schwersten Fall (dreizeiliger Name, vier Zeitstrafen) nicht
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'Laptop: Befund C-COCKPIT-LAPTOP-SCROLLT-IM-SCHWERSTEN-FALL');
    test.fail((page.viewportSize()?.height ?? 0) < 700, 'schwerster Fall passt bei 640 px Höhe nicht ohne Scrollen');
    await seedIndexedDB({ tournaments: [cup({ namen: [NAME_50, NAMEN[1], NAMEN[2], NAMEN[3]] })] });
    await anpfeifen(page);
    for (const seite of ['home', 'away'] as const) { await tippeZeitstrafe(page, seite); await tippeZeitstrafe(page, seite); }
    await tippeKarte(page, 'home', 'Rot', 7);
    await anAnfangRollen(page);
    await pruefeZwischenKopfUndLeiste(page);
  });

  test('@SL-061 Laptop: der Inhaltsbereich selbst scrollt nicht (normaler Fall: Uhr, Stand, Tor-Knöpfe und Spalten stehen ohne Scrollen)', async ({ page, seedIndexedDB }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'nur Laptop-Anordnung');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await tippeZeitstrafe(page, 'home');
    const ueberstand = await page.locator('[data-testid="live-cockpit"] > main').evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(ueberstand, 'Inhaltsbereich scrollt nicht').toBeLessThanOrEqual(1);
  });

  test('@SL-061 Laptop, schwerer Fall: der Inhaltsbereich selbst scrollt nicht – C-COCKPIT-LAPTOP-SCROLLT-IM-SCHWERSTEN-FALL', async ({ page, seedIndexedDB }) => {
    // Befund C-COCKPIT-LAPTOP-SCROLLT-IM-SCHWERSTEN-FALL (Lösung nach #298/#288, spätestens im Cockpit-Abschluss): bei 1280 × 720 und 1024 × 768 (Leiste 80 px) fehlen im schwersten Fall (50-Zeichen-Name in Tafel und Spalte, vier Zeitstrafen, Meldezeile) rund 40 px
    test.fail((page.viewportSize()?.height ?? 0) < 800, 'schwerster Fall passt bei 720 und 768 px Höhe noch nicht ganz ohne Scrollen des Inhaltsbereichs');
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'nur Laptop-Anordnung');
    await seedIndexedDB({ tournaments: [cup({ namen: [NAME_50, NAMEN[1], NAMEN[2], NAMEN[3]] })] });
    await anpfeifen(page);
    for (const seite of ['home', 'away'] as const) { await tippeZeitstrafe(page, seite); await tippeZeitstrafe(page, seite); }
    await tippeKarte(page, 'home', 'Rot', 7);
    const ueberstand = await page.locator('[data-testid="live-cockpit"] > main').evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(ueberstand, 'Inhaltsbereich scrollt nicht').toBeLessThanOrEqual(1);
  });

  test('@SL-005 @SL-070 Halbzeit: der Wiederanpfiff liegt im ersten Bildschirm, kein Abpfiff in der Pause', async ({ page, seedIndexedDB }, testInfo) => {
    test.setTimeout(120_000);
    await seedIndexedDB({ tournaments: [cup({ minuten: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('scoreboard-state')).toContainText('Halbzeit', { timeout: 60_000 });
    const wieder = page.getByTestId('match-wiederanpfiff-button');
    await expect(wieder).toBeVisible();
    expect(await unterkante(page, 'match-wiederanpfiff-button')).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
    await expect(page.getByTestId('match-finish-button')).toHaveCount(0);
    await bild(page, `${testInfo.project.name}-halbzeit`);
  });

  test('@SL-140 Rahmen: schmaler Kopf, keine App-Navigation, keine Fußzeile, keine Spielauswahl; „Zurück“ zeigt den Spielplan mit App-Navigation, die Uhr läuft weiter', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-slim-header')).toBeVisible();
    await expect(page.getByTestId('cockpit-turniername')).toHaveText('Cockpit-Cup Laptop');
    await expect(page.getByTestId('cockpit-verbindung')).toBeVisible();
    await expect(page.getByTestId('desktop-tab-spielplan')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Spiel/ })).toHaveCount(0);

    const rest = async () => (await page.getByTestId('scoreboard-clock-sub').textContent()) ?? '';
    const vorher = await rest();
    await page.getByTestId('cockpit-zurueck').click();
    await expect(page).toHaveURL(new RegExp(`/tournament/${ID}/schedule$`));
    await expect(page.getByTestId('cockpit-slim-header')).toHaveCount(0);
    await expect(page.locator('footer')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.goto(`/#/tournament/${ID}/live`);
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await expect.poll(rest).not.toBe(vorher);
  });

  test('K2 ohne Netz verdeckt kein Hinweis die Leiste: Pause, Abpfiff und Rückgängig sind antippbar; im Spielplan bleibt der Hinweis', async ({ page, context, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await context.setOffline(true);
    await expect(page.getByTestId('cockpit-verbindung')).toHaveAttribute('data-status', 'offline');
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
    for (const id of ['match-pause-button', 'match-finish-button', 'match-undo-button']) {
      const treffer = await page.getByTestId(id).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return oben !== null && el.contains(oben);
      });
      expect(treffer, `${id} liegt frei`).toBe(true);
    }
    await page.getByTestId('cockpit-zurueck').click();
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await context.setOffline(false);
  });

  test('@SL-168 ohne Netz bietet der schmale Kopf „Verbinden“ (≥ 44 px, Leiste bleibt frei); ist das Netz zurück, steht kurz „Wieder verbunden“ und der Knopf ist weg', async ({ page, context, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    const status = page.getByTestId('cockpit-verbindung');
    await expect(page.getByTestId('cockpit-verbindung-verbinden')).toHaveCount(0);
    await context.setOffline(true);
    await expect(status).toHaveAttribute('data-status', 'offline');
    const knopf = page.getByTestId('cockpit-verbindung-verbinden');
    await expect(knopf).toBeVisible();
    const box = await knopf.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const breite = page.viewportSize()?.width ?? 0;
    expect((box?.x ?? 0) + (box?.width ?? 0), 'der Knopf liegt im Bild').toBeLessThanOrEqual(breite);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein seitliches Scrollen').toBe(true);
    await bild(page, `${testInfo.project.name}-sl168-offline`);
    await knopf.click();
    await context.setOffline(false);
    await expect(status).toHaveAttribute('data-status', 'online');
    await expect(status).toContainText(/Wieder verbunden|Reconnected/);
    await expect(page.getByTestId('cockpit-verbindung-verbinden')).toHaveCount(0);
    await bild(page, `${testInfo.project.name}-sl168-wieder-verbunden`);
  });

  test('K3 ein Hinweis im Fluss über dem Cockpit schiebt die Leiste nicht aus dem Bild', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.evaluate(() => {
      const wurzel = document.getElementById('root')?.firstElementChild;
      const hinweis = document.createElement('div');
      hinweis.setAttribute('data-testid', 'sw-update-notice');
      hinweis.style.cssText = 'flex:none;height:56px;background:#fc0;color:#000';
      hinweis.textContent = 'Update verfügbar';
      wurzel?.prepend(hinweis);
    });
    await expect(page.getByTestId('sw-update-notice')).toBeVisible();
    const hoehe = page.viewportSize()?.height ?? 0;
    const leiste = await page.getByRole('toolbar').boundingBox();
    expect(Math.round((leiste?.y ?? 0) + (leiste?.height ?? 0))).toBeLessThanOrEqual(hoehe);
    const mass = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, ih: window.innerHeight }));
    expect(mass.h).toBeLessThanOrEqual(mass.ih);
  });

  test('K13 @SL-157 am Handy: fünf Leisten-Knöpfe je mindestens 44 px breit, „Abpfiff halten“ nicht abgeschnitten', async ({ page, seedIndexedDB }) => {
    test.skip((page.viewportSize()?.width ?? 0) > 400, 'nur Handy-Breite');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    const knoepfe = await page.getByRole('toolbar').getByRole('button').evaluateAll((els) => els.map((e) => ({ w: e.getBoundingClientRect().width, abgeschnitten: e.scrollWidth > e.clientWidth + 1 })));
    expect(knoepfe).toHaveLength(5);
    for (const k of knoepfe) { expect(k.w).toBeGreaterThanOrEqual(44); expect(k.abgeschnitten).toBe(false); }
  });

  test('@SL-157 @SL-158 Abpfiff halten fragt nach, ein kurzer Klick nicht; Weiterspielen beendet nichts', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.getByTestId('match-finish-button').click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await abpfiffHaltenBisRueckfrage(page);
    await expect(page.getByRole('alertdialog')).toContainText('Spiel 1 bei noch');
    await page.getByTestId('finish-confirm-weiter').click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
  });

  test('@SL-167 K4 Tastenwiederholung: Leertaste auf „Abpfiff“ halten, die Rückfrage erscheint und bleibt trotz weiter gedrückter Taste offen', async ({ page, seedIndexedDB }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Tastatur am Laptop');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.getByTestId('match-finish-button').focus();
    await page.keyboard.down(' ');
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(600);
    await page.keyboard.down(' '); // Wiederholung des Betriebssystems
    await page.keyboard.up(' ');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
  });

  test('@SL-156 vor den letzten drei Minuten bleibt die Zeile „Nächstes“ ruhig', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 4, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toHaveAttribute('data-modus', 'normal');
  });

  test('@SL-155 Restzeit 3:00: der Rahmen der Zeile „Nächstes“ ist hervorgehoben und blinkt, Uhr und Stand bleiben unverdeckt', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    const zeile = page.getByTestId('cockpit-naechstes');
    await expect(zeile).toHaveAttribute('data-modus', 'vorwarnung');
    await expect(zeile).toHaveAttribute('data-blinken', 'true');
    await expect(zeile).toHaveCSS('border-top-width', '2px');
    const tafel = await page.getByTestId('scoreboard').boundingBox();
    const z = await zeile.boundingBox();
    expect((tafel?.y ?? 0) + (tafel?.height ?? 0)).toBeLessThanOrEqual((z?.y ?? 0) + 1);
    await bild(page, `${testInfo.project.name}-vorwarnung`);
  });

  test('@SL-156 „Bewegung reduzieren“: ab 3:00 hervorgehoben, ohne zu blinken', async ({ page, seedIndexedDB }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedIndexedDB({ tournaments: [cup({ minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toHaveAttribute('data-modus', 'vorwarnung');
    await expect(page.getByTestId('cockpit-naechstes')).not.toHaveAttribute('data-blinken', 'true');
  });

  test('@SL-160 Rot/Weiß: zwei Farbpunkte, kein Leibchen-Zeichen', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#C62828', '#FFFFFF'] })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toContainText('TSV Ost');
    await expect(page.getByTestId('cockpit-naechstes-punkt-0')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-punkt-1')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveCount(0);
  });

  test('@SL-160 Blau/Navy: Leibchen-Zeichen ohne Text', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#1565C0', '#0D1B4C'] })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveText('');
    await bild(page, `${testInfo.project.name}-leibchen`);
  });

  test('@SL-161 ohne festgelegte Trikotfarbe steht nur der Name', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#C62828', ''] })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes-punkt-0')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-punkt-1')).toHaveCount(0);
    await expect(page.getByTestId('cockpit-naechstes')).toContainText('FC West');
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveCount(0);
  });
});
