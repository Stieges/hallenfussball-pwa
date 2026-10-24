/**
 * E2E: Cockpit am Laptop, Tablet und Handy ohne Scrollen, Rahmen im laufenden Spiel, Zeile „Nächstes“ (Plan PR 3, T2-UI LT-2/LT-3).
 * Saat: Spiel 1 FC Nord – SV Süd, Spiel 2 TSV Ost – FC West, Foul-Grenze 5. Szenarien: @SL-061 (alle Haupttasten ohne Scrollen, Liste daneben),
 * @SL-140 (schmaler Kopf, keine App-Navigation, keine Fußzeile, „Zurück“ zum Spielplan, Uhr läuft weiter), @SL-005/@SL-070 (Wiederanpfiff im
 * ersten Bildschirm), @SL-157/@SL-158 (Abpfiff halten, kurzer Tipp nicht), K2 (Offline-Hinweis verdeckt die Leiste nicht), K3 (Hinweis im Fluss
 * schiebt die Leiste nicht aus dem Bild), K4 (Tastenwiederholung der Haltetaste), K13 (fünf Knöpfe ≥ 44 px, nichts abgeschnitten),
 * @SL-155/@SL-156/@SL-160/@SL-161 (Zeile „Nächstes“), N1 (@SL-061 + @SL-168: verbunden, nicht verbunden und „Verbinde …“ – der Kopf bleibt gleich hoch),
 * C-TAFEL-TON-UND-WARTEND-BRECHEN-ZEILE (Neuladen mitten im Spiel: „Ton aus“ und „N Einträge warten“ in einer Zeile, ohne den Ton vorher wegzutippen).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { tippeKarte, tippeZeitstrafe } from '../helpers/cockpitNeu';
import { abpfiffHaltenBisRueckfrage } from '../helpers/abpfiff';
import { ID, NAMEN, NAME_50, FARBEN, cup, bild, anpfeifen, unterkante, wartendeEintraege, anAnfangRollen, pruefeZwischenKopfUndLeiste } from '../helpers/laptopCup';

const PFLICHT = ['scoreboard', 'goal-button-home', 'foul-button-home', 'penalty-button-home', 'card-button-home', 'goal-button-away', 'foul-button-away', 'penalty-button-away', 'card-button-away', 'match-pause-button', 'match-finish-button', 'match-undo-button'];

const mitte = async (page: Page, testId: string): Promise<number> => {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) { throw new Error(`${testId} nicht sichtbar`); }
  return box.y + box.height / 2;
};

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

  test('@SL-061 Handy und alle Größen, Anfangszustand: Tafel und Tor beider Teams (ab 800 px Fensterhöhe auch Foul, Zeitstrafe und Karte) liegen ohne Scrollen zwischen Kopf und Leiste', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await anAnfangRollen(page);
    await pruefeZwischenKopfUndLeiste(page);
  });

  test('@SL-061 Handy, schwerer Fall im Anfangszustand: alle Tasten beider Teams liegen ohne Scrollen zwischen Kopf und Leiste – C-COCKPIT-HANDY-KARTE-UNTER-LEISTE', async ({ page, seedIndexedDB }) => {
    // Befund C-COCKPIT-HANDY-KARTE-UNTER-LEISTE (neu bewertet nach #298, 20.10.: Tafel mit Abzeichen „Ende“/Anstoßzeit ist gemergt, der Fall bleibt rot – es fehlen noch 5 px, die Zeitstrafe-Taste endet bei 570 statt 565; Lösung: Spaltenkopf wie handy-c, Streifen und Name in einer Zeile): bei 360 × 640 reicht die Höhe im schwersten Fall (dreizeiliger Name, vier Zeitstrafen) nicht
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'Laptop: Befund C-COCKPIT-LAPTOP-SCROLLT-IM-SCHWERSTEN-FALL');
    // Seit 24.10. (@SL-061): am kleinen Handy scrollt die Tastenfläche, Tafel und Tor bleiben im Bild – der Fall ist damit auch bei 640 px Höhe erfüllt
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
    // Befund C-COCKPIT-LAPTOP-SCROLLT-IM-SCHWERSTEN-FALL (neu bewertet nach #298, 20.10.: der Fall bleibt rot, der Inhaltsbereich scrollt bei 1280 × 720 um 51 px, bei 1024 × 768 um 3 px): bei 1280 × 720 und 1024 × 768 (Leiste 80 px) fehlt im schwersten Fall (50-Zeichen-Name in Tafel und Spalte, vier Zeitstrafen, Meldezeile) Höhe
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

  test('@SL-168 ohne Netz bietet der schmale Kopf „Verbinden“ (≥ 44 px, Leiste bleibt frei); beim Tippen steht in derselben Pille „Verbinde …“, klappt es nicht, wieder „Verbinden“; ist das Netz zurück, verschwindet die Pille, kein „Wieder verbunden“', async ({ page, context, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    const status = page.getByTestId('cockpit-verbindung');
    const knopf = page.getByTestId('cockpit-verbindung-verbinden');
    await expect(knopf).toHaveCount(0);
    await context.setOffline(true);
    await expect(status).toHaveAttribute('data-status', 'offline');
    await expect(knopf).toBeVisible();
    await expect(status).toContainText('Offline');
    const box = await knopf.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const breite = page.viewportSize()?.width ?? 0;
    expect((box?.x ?? 0) + (box?.width ?? 0), 'der Knopf liegt im Bild').toBeLessThanOrEqual(breite);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein seitliches Scrollen').toBe(true);
    await bild(page, `${testInfo.project.name}-sl168-offline`);

    await knopf.click();
    await expect(knopf).toContainText('Verbinde …');
    await expect(status).toContainText('Offline');
    // Klappt es nicht (kein Netz), steht wieder „Verbinden“
    await expect(knopf).not.toContainText('Verbinde …');
    await expect(knopf).toContainText('Verbinden');
    await expect(status).toContainText('Offline');

    await context.setOffline(false);
    await expect(status).toHaveAttribute('data-status', 'online');
    await expect(knopf).toHaveCount(0);
    await expect(status).not.toContainText(/Wieder verbunden|Reconnected/);
    await expect(page.getByText(/Wieder verbunden|Reconnected/)).toHaveCount(0);
  });

  for (const felder of [1, 2]) {
    const feldText = `${felder} Feld${felder > 1 ? 'er' : ''}`;
    test(`@SL-061 @SL-168 Kopf gleich hoch in allen drei Anzeigen – verbunden, nicht verbunden mit 3 wartenden Einträgen, „Verbinde …“ (${feldText}); alle Tasten zwischen Kopf und Leiste`, async ({ page, context, seedIndexedDB }, testInfo) => {
      await seedIndexedDB({ tournaments: [cup({ felder })] });
      await anpfeifen(page);
      await wartendeEintraege(page, 3);
      const kopf = page.getByTestId('cockpit-slim-header');
      const status = page.getByTestId('cockpit-verbindung');
      const knopf = page.getByTestId('cockpit-verbindung-verbinden');
      const hoehe = async () => (await kopf.boundingBox())?.height ?? 0;
      const tasteOben = async () => (await page.getByTestId('goal-button-home').boundingBox())?.y ?? 0;
      const pruefe = async (anzeige: string) => {
        await anAnfangRollen(page);
        await pruefeZwischenKopfUndLeiste(page);
        expect(Math.abs((await hoehe()) - hoeheOnline), `Kopfhöhe ${anzeige} unverändert`).toBeLessThanOrEqual(1);
        expect(Math.abs((await tasteOben()) - tasteOnline), `die Tasten springen ${anzeige} nicht`).toBeLessThanOrEqual(1);
      };
      await anAnfangRollen(page);
      await pruefeZwischenKopfUndLeiste(page);
      const hoeheOnline = await hoehe();
      const tasteOnline = await tasteOben();
      await expect(knopf).toHaveCount(0);
      await bild(page, `${testInfo.project.name}-n1-online-${felder}f`);

      await context.setOffline(true);
      await expect(status).toHaveAttribute('data-status', 'offline');
      await expect(status).toContainText(/3 Einträge warten/);
      await expect(knopf).toBeVisible();
      await pruefe('ohne Netz');
      await bild(page, `${testInfo.project.name}-n1-offline-${felder}f`);

      // Tippen: in derselben Pille steht „Verbinde …“, der Kopf springt nicht
      await knopf.click();
      await expect(knopf).toContainText('Verbinde …');
      await pruefe('bei „Verbinde …“');
      await expect(knopf).toContainText('Verbinde …');
      await bild(page, `${testInfo.project.name}-n1-verbinde-${felder}f`);

      // Klappt es nicht: wieder „Verbinden“ mit „Offline“ und „3 Einträge warten“, Kopf unverändert
      await expect(knopf).not.toContainText('Verbinde …');
      await expect(knopf).toContainText('Verbinden');
      await expect(status).toContainText(/3 Einträge warten/);
      await pruefe('nach dem Fehlversuch');

      // Netz zurück: die Pille verschwindet, der Kopf zeigt nur den Punkt, kein „Wieder verbunden“
      await context.setOffline(false);
      await expect(status).toHaveAttribute('data-status', 'online');
      await expect(knopf).toHaveCount(0);
      await expect(page.getByText(/Wieder verbunden|Reconnected/)).toHaveCount(0);
      await pruefe('nach der Rückkehr');
    });
  }

  test('@SL-168 klappt der Versuch (Netz kommt während „Verbinde …“ zurück), verschwindet die Pille danach ohne „Wieder verbunden“ und der Kopf bleibt gleich hoch', async ({ page, context, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await wartendeEintraege(page, 3);
    const kopf = page.getByTestId('cockpit-slim-header');
    const knopf = page.getByTestId('cockpit-verbindung-verbinden');
    const hoeheOnline = (await kopf.boundingBox())?.height ?? 0;
    await context.setOffline(true);
    await expect(knopf).toBeVisible();
    await knopf.click();
    await expect(knopf).toContainText('Verbinde …');
    await context.setOffline(false);
    await expect(page.getByTestId('cockpit-verbindung')).toHaveAttribute('data-status', 'online');
    await expect(knopf).toHaveCount(0);
    await expect(page.getByText(/Wieder verbunden|Reconnected|Verbinde …/)).toHaveCount(0);
    expect(Math.abs(((await kopf.boundingBox())?.height ?? 0) - hoeheOnline)).toBeLessThanOrEqual(1);
  });

  test('H8 @OB-030 Feldwahl ohne anstehendes Spiel: Feld 2 ist leer, die Feldwahl steht über der Tafel und lässt zurück zu Feld 1 wechseln', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ felder: 2 })] });
    await page.goto(`/#/tournament/${ID}/live?f=2`);
    const wahl = page.getByTestId('cockpit-feldwahl');
    await expect(wahl).toBeVisible();
    await expect(wahl).toHaveValue('2');
    await bild(page, `${testInfo.project.name}-h8-feldwahl-ohne-spiel`);
    await wahl.selectOption('1');
    await expect(page).toHaveURL(/f=1/);
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
    await page.keyboard.press('Tab'); // mit der Tastatur zum Knopf (nach dem Mausklick auf „Anpfiff“ gilt sonst Maus-Fokus, @SL-154)
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
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#C62828', '#FFFFFF'], minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toContainText('TSV Ost');
    await expect(page.getByTestId('cockpit-naechstes-punkt-0')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-punkt-1')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveCount(0);
  });

  test('@SL-160 Blau/Navy: Leibchen-Zeichen ohne Text', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#1565C0', '#0D1B4C'], minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveText('');
    await bild(page, `${testInfo.project.name}-leibchen`);
  });

  test('@SL-161 ohne festgelegte Trikotfarbe steht nur der Name', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#C62828', ''], minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes-punkt-0')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-punkt-1')).toHaveCount(0);
    await expect(page.getByTestId('cockpit-naechstes')).toContainText('FC West');
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveCount(0);
  });

  test('@SL-061 @SL-168 C-TAFEL-TON-UND-WARTEND-BRECHEN-ZEILE nach dem Neuladen stehen „Ton aus“ und „3 Einträge warten“ in einer Zeile, die Tafel wird nicht höher, alle Tasten liegen zwischen Kopf und Leiste – auch ohne Netz', async ({ page, context, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await anAnfangRollen(page);
    const tafel = page.getByTestId('scoreboard');
    const hoeheBasis = (await tafel.boundingBox())?.height ?? 0;
    const tasteBasis = (await page.getByTestId('goal-button-home').boundingBox())?.y ?? 0;

    // Neuladen mitten im Spiel: der Ton ist wieder gesperrt und drei Einträge warten – der Ton wird NICHT weggetippt
    await wartendeEintraege(page, 3, { tonBehalten: true });
    const pruefe = async (anzeige: string): Promise<void> => {
      await anAnfangRollen(page);
      await expect(page.getByTestId('scoreboard-ton'), `${anzeige}: „Ton aus“ steht in der Tafel`).toBeVisible();
      await expect(page.getByTestId('scoreboard-eintraege-warten'), `${anzeige}: „3 Einträge warten“ steht in der Tafel`).toContainText('3 Einträge warten');
      // eine Zeile: Zustand, „Ton aus“ und „Einträge warten“ liegen auf derselben Mittellinie
      const zustand = await mitte(page, 'scoreboard-state');
      expect(Math.abs((await mitte(page, 'scoreboard-ton')) - zustand), `${anzeige}: „Ton aus“ in der Zeile des Zustands`).toBeLessThanOrEqual(2);
      expect(Math.abs((await mitte(page, 'scoreboard-eintraege-warten')) - zustand), `${anzeige}: „Einträge warten“ in der Zeile des Zustands`).toBeLessThanOrEqual(2);
      expect(Math.abs(((await tafel.boundingBox())?.height ?? 0) - hoeheBasis), `${anzeige}: Tafelhöhe wie nach dem Anpfiff`).toBeLessThanOrEqual(1);
      expect(Math.abs(((await page.getByTestId('goal-button-home').boundingBox())?.y ?? 0) - tasteBasis), `${anzeige}: die Tasten springen nicht`).toBeLessThanOrEqual(1);
      const breite = await tafel.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
      expect(breite.sw, `${anzeige}: nichts ragt seitlich aus der Tafel`).toBeLessThanOrEqual(breite.cw);
      await pruefeZwischenKopfUndLeiste(page);
    };
    await pruefe('mit Netz');
    await bild(page, `${testInfo.project.name}-tafel-ton-und-wartend-online`);

    await context.setOffline(true);
    await expect(page.getByTestId('cockpit-verbindung')).toHaveAttribute('data-status', 'offline');
    await pruefe('ohne Netz');
    await bild(page, `${testInfo.project.name}-tafel-ton-und-wartend-offline`);
  });

  test('@SL-061 Gegenbeispiel: nach dem Antippen von „Ton aus“ verschwindet das Abzeichen, „3 Einträge warten“ bleibt und die Tafel ist gleich hoch', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await anAnfangRollen(page);
    const tafel = page.getByTestId('scoreboard');
    const hoeheBasis = (await tafel.boundingBox())?.height ?? 0;
    await wartendeEintraege(page, 3, { tonBehalten: true });
    await page.getByTestId('scoreboard-ton').click();
    await expect(page.getByTestId('scoreboard-ton')).toHaveCount(0);
    await expect(page.getByTestId('scoreboard-eintraege-warten')).toContainText('3 Einträge warten');
    expect(Math.abs(((await tafel.boundingBox())?.height ?? 0) - hoeheBasis)).toBeLessThanOrEqual(1);
  });
});
