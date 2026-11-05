/**
 * Zuschauer-Paket A (Durchsicht 05.11.2026): „(war hh:mm)“ ohne „voraussichtlich“ (@ZM-105, @ZP-046), lesbare Initialen bei weißem
 * und gelbem Trikot (C-ZUSCHAUER-INITIALEN-WEISS, Farbregel @ZM-159, Kontrast @ZM-107), Filter-Tasten mit 44 px Tippfläche (Z16),
 * Spielkarten ohne axe-Verstoß aria-required-children, ruhiger Hinweis bei unbekanntem Turnier (@ZM-068).
 *
 * Saat `hallencup-messlauf` mit Änderungen: Name mit 50 Zeichen (Team 1), weißes und gelbes Trikot, Spiel 15 um 10 Minuten verschoben.
 * Handy 360 und 390, Tablet hochkant. Läuft nur im Projekt `desktop` (setzt das Fenster selbst).
 */
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const GROESSEN = [
  { name: 'handy-360', width: 360, height: 640 },
  { name: 'handy-390', width: 390, height: 844 },
  { name: 'tablet-hoch', width: 768, height: 1024 },
] as const;
const LANGER_NAME = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const SPIEL_VERSCHOBEN = '00000003-0000-4000-8000-000000000015';
const MIN_KONTRAST = 4.5;

interface SaatSpiel { id: string; scheduledTime: string; originalStart?: string }
interface SaatTeam { name: string; colors?: { primary: string; secondary: string } }
interface SaatTurnier { teams: SaatTeam[]; matches: SaatSpiel[] }
interface Saat { datenbanken: Array<{ eintraege: { tournaments: SaatTurnier[] } }> }

/** Saat mit weißem (Team 3) und gelbem (Team 4) Trikot und einem um 10 Minuten verschobenen Spiel. */
function saatMitWeissUndVerschiebung(): Saat {
  const saat = leseSaat('hallencup-messlauf') as Saat;
  const turnier = saat.datenbanken[0].eintraege.tournaments[0];
  expect(turnier.teams[0].name).toBe(LANGER_NAME);
  turnier.teams[2].colors = { primary: '#FFFFFF', secondary: '#000000' };
  turnier.teams[3].colors = { primary: '#FFEB3B', secondary: '#000000' };
  const spiel = turnier.matches.find((m) => m.id === SPIEL_VERSCHOBEN);
  if (spiel === undefined) { throw new Error('Spiel 15 fehlt in der Saat'); }
  spiel.originalStart = spiel.scheduledTime;
  spiel.scheduledTime = new Date(new Date(spiel.scheduledTime).getTime() + 10 * 60_000).toISOString();
  return saat;
}

async function oeffne(page: Page, breite: number, hoehe: number, route = '/#/live/MESS26'): Promise<void> {
  await page.setViewportSize({ width: breite, height: hoehe });
  await installiereSaat(page.context(), saatMitWeissUndVerschiebung());
  await page.goto(route);
  await expect(page.locator('[data-testid="public-filter-bar"]')).toBeAttached({ timeout: 25000 });
}

/** Kontrast zweier `rgb(r, g, b)`-Texte nach WCAG, im Browser gerechnet. */
const kontrastImBrowser = (page: Page) => page.evaluate(() => {
  const kanal = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const luminanz = (rgb: string) => { const [r, g, b] = (rgb.match(/\d+/g) ?? []).map(Number); return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b); };
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="team-avatar"]')).filter((a) => a.getBoundingClientRect().width > 0).map((a) => {
    const kreis = a.firstElementChild as HTMLElement;
    const stil = getComputedStyle(kreis);
    const [hell, dunkel] = [luminanz(stil.color), luminanz(stil.backgroundColor)].sort((x, y) => y - x);
    return {
      text: kreis.textContent ?? '',
      fuellung: stil.backgroundColor,
      rand: `${stil.borderTopWidth} ${stil.borderTopStyle}`,
      schriftPx: parseFloat(stil.fontSize),
      kontrast: (hell + 0.05) / (dunkel + 0.05),
    };
  });
});

for (const groesse of GROESSEN) {
  test.describe(`Zuschauer-Paket A auf ${groesse.name} (${String(groesse.width)}×${String(groesse.height)})`, () => {
    test.beforeEach(() => {
      test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
    });

    test('Z16 jede Filter-Taste ist mindestens 44 × 44 px groß', async ({ page }) => {
      await oeffne(page, groesse.width, groesse.height);
      const tasten = page.locator('[data-testid="public-filter-bar"] button');
      expect(await tasten.count()).toBeGreaterThan(6);
      for (const taste of await tasten.all()) {
        const box = await taste.boundingBox();
        expect(box, 'Taste sichtbar').not.toBeNull();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    });

    test('Z5 Initialen: mindestens 11 px, Kontrast zur Füllung mindestens 4,5 : 1, weiß und gelb mit kräftigem Rand', async ({ page }) => {
      await oeffne(page, groesse.width, groesse.height);
      const kreise = await kontrastImBrowser(page);
      expect(kreise.length).toBeGreaterThan(8);
      for (const kreis of kreise) {
        expect(kreis.schriftPx, `Initialen „${kreis.text}“`).toBeGreaterThanOrEqual(11);
        expect(kreis.kontrast, `Initialen „${kreis.text}“ auf ${kreis.fuellung}`).toBeGreaterThanOrEqual(MIN_KONTRAST);
      }
      const weiss = kreise.filter((k) => k.fuellung === 'rgb(255, 255, 255)');
      const gelb = kreise.filter((k) => k.fuellung === 'rgb(255, 235, 59)');
      expect(weiss.length).toBeGreaterThan(0);
      expect(gelb.length).toBeGreaterThan(0);
      for (const kreis of [...weiss, ...gelb]) {
        expect(kreis.rand).toBe('2px solid');
        expect(kreis.text).toMatch(/^[A-ZÄÖÜ0-9]{2}$/);
      }
    });

    test('@ZP-046 @ZM-105 verschobenes K.-o.-Spiel: neue Uhrzeit und „(war hh:mm)“ in einer Zeile, nirgends „voraussichtlich“', async ({ page }) => {
      await oeffne(page, groesse.width, groesse.height);
      const notiz = page.locator(`[data-testid="match-original-${SPIEL_VERSCHOBEN}"]`).locator("visible=true").first();
      await notiz.scrollIntoViewIfNeeded();
      await expect(notiz).toHaveText(/^\(war \d\d:\d\d\)$/);
      const box = await notiz.boundingBox();
      const zeile = await notiz.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || el.getBoundingClientRect().height);
      expect(box?.height ?? 99, 'eine Zeile hoch').toBeLessThan(zeile * 1.6);
      await expect(notiz.locator('xpath=..')).toHaveText(/\d\d:\d\d\s*\(war \d\d:\d\d\)/);
      expect(await page.locator('body').innerText()).not.toMatch(/voraussichtlich|ursprünglich/i);
    });

    test('@ZM-087 Name mit 50 Zeichen steht vollständig, ohne „…“ und ohne Überlauf', async ({ page }) => {
      await oeffne(page, groesse.width, groesse.height);
      const name = page.getByText(LANGER_NAME, { exact: true }).first();
      await name.scrollIntoViewIfNeeded();
      await expect(name).toBeVisible();
      const geschnitten = await name.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === 'ellipsis');
      expect(geschnitten).toBe(false);
    });

    test('Z16 axe: kein Verstoß gegen aria-required-children oder aria-required-parent an den Spielkarten', async ({ page }) => {
      await oeffne(page, groesse.width, groesse.height);
      const ergebnis = await new AxeBuilder({ page }).withRules(['aria-required-children', 'aria-required-parent']).analyze();
      expect(ergebnis.violations.map((v) => v.id)).toEqual([]);
      expect(await page.locator('[role="article"][data-match-card], [role="article"][aria-label^="Spiel"]').count()).toBeGreaterThan(0);
    });

    test('@ZM-068 unbekannter Code: ruhiger Hinweis im Wortlaut des Records, kein Knopf', async ({ page }) => {
      await page.setViewportSize({ width: groesse.width, height: groesse.height });
      await page.goto('/#/live/ZZZZZZ');
      await expect(page.getByRole('heading', { name: 'Turnier nicht gefunden oder nicht öffentlich' })).toBeVisible({ timeout: 25000 });
      await expect(page.getByRole('button')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toContain('ZZZZZZ');
    });
  });
}
