/**
 * Aufgabe 5.1a (Spielanzeige): nur die Restzeit beim Stand (@ZM-162, @OB-067, @OB-066, @ZM-040, @ZM-039, @ZM-044).
 *
 * Saat `hallencup-messlauf`: das Finale läuft seit 320 s (eine Spielzeit von 10 min) – die Restzeit steht bei etwa 4:40,
 * nie die gespielte Zeit (5:2x). Die Phasen-Turniere (Code PHASEH Halbzeitpause, PHASEV Verlängerung) tragen `live_state`.
 * Die Saat rechnet ihre Zeiten relativ zum Laden; deshalb Bereiche statt fester Werte.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const HANDY = { width: 360, height: 640 };
const FINALE = '00000003-0000-4000-8000-000000000016';
const RESTZEIT_FINALE = /^4:(3\d|40)$/;
const KEINE_GESPIELTE_ZEIT = /5:2\d|05:2\d|5:3\d|05:3\d/;

async function oeffne(page: Page, route: string, erwarte: string) {
  await page.setViewportSize(HANDY);
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto(route);
  await expect(page.locator(erwarte).first()).toBeAttached({ timeout: 25000 });
}

const karte = (page: Page) => page.locator(`[data-testid="final-card-${FINALE}"]`);

test.describe('@ZM-162 Restzeit statt Spielzeit', () => {
  test('@ZM-162 Zuschauer-Seite: Karte des Finales trägt „Live“ ohne Zeit und die Restzeit beim Stand, nie 5:2x', async ({ page }) => {
    await oeffne(page, '/#/live/MESS26', '[data-testid^="final-card-"]');
    await karte(page).scrollIntoViewIfNeeded();
    await expect(karte(page).locator(`[data-testid="final-live-${FINALE}"]`)).toHaveText(/^Live$/);
    await expect(karte(page).locator('[data-testid="match-clock"]')).toHaveText(RESTZEIT_FINALE);
    expect(await karte(page).innerText()).not.toMatch(KEINE_GESPIELTE_ZEIT);
  });

  test('@ZM-162 Verwaltung (Turnierleitung): dieselbe Restzeit beim Stand, Abzeichen ohne Zeit', async ({ page }) => {
    await oeffne(page, '/#/tournament/hallencup-messlauf/schedule', '[data-testid^="final-card-"]');
    await karte(page).scrollIntoViewIfNeeded();
    await expect(karte(page).locator(`[data-testid="final-live-${FINALE}"]`)).toHaveText(/^Live$/);
    await expect(karte(page).locator('[data-testid="match-clock"]')).toHaveText(RESTZEIT_FINALE);
    expect(await karte(page).innerText()).not.toMatch(KEINE_GESPIELTE_ZEIT);
  });

  test('@ZM-162 Gegenbeispiel: beendete und geplante Karten tragen keine Uhr', async ({ page }) => {
    await oeffne(page, '/#/live/MESS26', '[data-testid^="final-card-"]');
    await expect(page.locator('[data-testid^="final-card-"] [data-testid="match-clock"]')).toHaveCount(1);
  });

  /**
   * @OB-067: „Stand und Restzeit sind größer als jeder andere Text DIESER Spielanzeige“ – gemessen in der Karte des Finales, nie gegen Text anderer Spielanzeigen
   * der Seite. Der Stand (Ziffern im Kasten) und die Restzeit sind die beiden größten Texte; alle übrigen Blätter der Karte sind kleiner oder gleich.
   */
  const messeKarte = (page: Page) => karte(page).evaluate((karteEl) => {
    const blaetter = (wurzel: Element) => Array.from(wurzel.querySelectorAll<HTMLElement>('*')).filter((e) => (e.textContent ?? '').trim() !== '' && e.children.length === 0);
    const zeit = karteEl.querySelector<HTMLElement>('[data-testid="match-clock"]')!;
    const standBlaetter = Array.from(karteEl.querySelectorAll('[data-testid^="final-goals-"]')).flatMap((el) => blaetter(el));
    const andere = blaetter(karteEl).filter((e) => e !== zeit && !zeit.contains(e) && !standBlaetter.includes(e));
    const s = getComputedStyle(zeit);
    return {
      gewicht: s.fontWeight, ziffern: s.fontVariantNumeric, uhr: parseFloat(s.fontSize),
      stand: Math.max(...standBlaetter.map((e) => parseFloat(getComputedStyle(e).fontSize))),
      andere: Math.max(...andere.map((e) => parseFloat(getComputedStyle(e).fontSize))),
    };
  });

  test('@OB-067 Karte 360×640: Stand und Restzeit in Schriftstärke 800 bzw. gleich breiten Ziffern, beide größer als jeder andere Text dieser Karte', async ({ page }) => {
    await oeffne(page, '/#/live/MESS26', '[data-testid^="final-card-"]');
    await expect(karte(page).locator('[data-testid="match-clock"]')).toBeAttached();
    const m = await messeKarte(page);
    expect(m.gewicht).toBe('800');
    expect(m.ziffern).toContain('tabular-nums');
    expect(m.uhr, `Restzeit ${m.uhr} px gegen übrigen Text der Karte ${m.andere} px`).toBeGreaterThan(m.andere);
    expect(m.stand, `Stand ${m.stand} px gegen übrigen Text der Karte ${m.andere} px`).toBeGreaterThan(m.andere);
  });

  test('@OB-067 Gegenprobe: ein größerer Text innerhalb der Karte würde die Prüfung rot machen', async ({ page }) => {
    await oeffne(page, '/#/live/MESS26', '[data-testid^="final-card-"]');
    await expect(karte(page).locator('[data-testid="match-clock"]')).toBeAttached();
    await karte(page).evaluate((el) => {
      const zu = document.createElement('span');
      zu.textContent = 'Zu groß';
      zu.style.fontSize = '60px';
      el.appendChild(zu);
    });
    const m = await messeKarte(page);
    expect(m.uhr).toBeLessThan(m.andere);
    expect(m.stand).toBeLessThan(m.andere);
  });
});

test.describe('@ZM-158 @ZM-156 Karte des Finales am Handy 360×640 (Saat hallencup-messlauf)', () => {
  const kaesten = (page: Page) => ({
    heim: karte(page).locator(`[data-testid="final-box-${FINALE}-home"]`),
    gast: karte(page).locator(`[data-testid="final-box-${FINALE}-away"]`),
  });

  test('@ZM-158 laufendes Finale: die Torzahlen stehen in kleinen Kästen in Teamfarbe, ohne Ring und ohne Pokal, die Karte läuft nicht über', async ({ page }) => {
    await oeffne(page, '/#/live/MESS26', '[data-testid^="final-card-"]');
    await karte(page).scrollIntoViewIfNeeded();
    const { heim, gast } = kaesten(page);
    await expect(heim).toBeVisible();
    await expect(gast).toBeVisible();
    await expect(heim).toHaveText('2');
    await expect(gast).toHaveText('1');
    await expect(heim).not.toHaveAttribute('data-outcome', /.+/);
    await expect(karte(page).locator('[data-testid$="-cup"]')).toHaveCount(0);
    const b = await karte(page).boundingBox();
    expect(b!.x + b!.width).toBeLessThanOrEqual(HANDY.width);
    const h = await heim.boundingBox();
    expect(h!.height).toBeGreaterThanOrEqual(44); // Touch-Höhe
  });

  test('@ZM-158 beendetes Finale 2:1: Ring um den Sieger-Kasten, Pokal oben rechts, Sieger fett, Verlierer ohne Ring', async ({ page }) => {
    await page.setViewportSize(HANDY);
    const saat = leseSaat('hallencup-messlauf') as { datenbanken: Array<{ eintraege: { tournaments: Array<{ id: string; matches: Array<Record<string, unknown>> }> } }> };
    const finale = saat.datenbanken[0].eintraege.tournaments.find((t) => t.id === 'hallencup-messlauf')!.matches.find((m) => m.id === FINALE)!;
    Object.assign(finale, { matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular', timerStartTime: undefined, liveState: undefined, timerElapsedSeconds: 600 });
    await installiereSaat(page.context(), saat);
    await page.goto('/#/live/MESS26');
    await expect(karte(page)).toBeAttached({ timeout: 25000 });
    await karte(page).scrollIntoViewIfNeeded();
    const { heim, gast } = kaesten(page);
    await expect(heim).toHaveAttribute('data-outcome', 'winner');
    await expect(karte(page).locator(`[data-testid="final-box-${FINALE}-home-cup"]`)).toBeVisible();
    await expect(karte(page).locator(`[data-testid="final-name-${FINALE}-home"]`)).toHaveAttribute('data-winner', 'true');
    await expect(gast).toHaveAttribute('data-outcome', 'loser');
    await expect(karte(page).locator(`[data-testid="final-box-${FINALE}-away-cup"]`)).toHaveCount(0);
    expect(await heim.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    expect(await gast.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  });
});

test.describe('@OB-066 Pause und Verlängerung mit Restzeit', () => {
  test('@OB-066 @ZM-115 Halbzeitpause: Abzeichen „Halbzeit“, Pausen-Restzeit mit „Pause · Halbzeit“', async ({ page }) => {
    await oeffne(page, '/#/live/PHASEH', '[data-testid^="final-live-"]');
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveText('Halbzeit');
    await expect(page.locator('[data-testid="match-clock-section"]')).toHaveText('Halbzeit');
    await expect(page.locator('[data-testid="match-clock"]')).toHaveText(/^0:\d\d$/);
  });

  test('@ZM-039 Verlängerung: Abzeichen „Verlängerung“, die Restzeit der Verlängerung zählt herunter', async ({ page }) => {
    await oeffne(page, '/#/live/PHASEV', '[data-testid^="final-live-"]');
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveText('Verlängerung');
    await expect(page.locator('[data-testid="match-clock-section"]')).toHaveText('Verlängerung');
    await expect(page.locator('[data-testid="match-clock"]')).toHaveText(/^[0-4]:\d\d$/);
  });

  test('@OB-066 Strafstoßschießen: keine Uhr, nur das Abzeichen', async ({ page }) => {
    await oeffne(page, '/#/live/PHASES', '[data-testid^="final-live-"]');
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveText('Strafstoßschießen');
    await expect(page.locator('[data-testid="match-clock"]')).toHaveCount(0);
  });
});
