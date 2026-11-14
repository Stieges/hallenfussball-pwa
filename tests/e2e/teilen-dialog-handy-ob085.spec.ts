/**
 * @OB-085 Der Dialog „Spielplan teilen“ passt am Handy ganz ins Bild (Grundriss: 360×640, 390×664, 390×844).
 * Soll: Code, QR-Code und „Link kopieren“ ohne Scrollen im Fenster; Taste im Fuß; Link als kurze Adresse ohne „#/“
 * ganz lesbar (umbrochen, nicht gekürzt); QR mindestens 160 Bildpunkte breit und mit derselben Adresse.
 * Gegenbeispiel: am Laptop (1280×800) bleibt der Dialog bedienbar und der QR in Normalgröße.
 * Bilder: Ordner aus TEILEN_SCR, Vorsilbe aus TEILEN_PREFIX (sonst Testergebnis-Ordner, „bild“). Läuft nur im Projekt `desktop` (setzt Fenster selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'ob085-tournament';
const CODE = 'NIKO26';
const GERAETE = [
  { name: '360x640', width: 360, height: 640 },
  { name: '390x664', width: 390, height: 664 },
  { name: '390x844', width: 390, height: 844 },
] as const;

/** Endliche Animationen (Einblenden) im Dialog; Dauerlaufende Anzeigen der Seite zählen nicht. */
const laufendeEinblendungen = () =>
  (document.querySelector('[data-testid="dialog-surface"]')?.getAnimations({ subtree: true }) ?? [])
    .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length;

async function oeffneDialog(
  page: Page,
  seed: (d: Record<string, unknown>) => Promise<void>,
  opts: { oeffentlich: boolean; teilenUnterstuetzt: boolean },
) {
  if (opts.teilenUnterstuetzt) {
    // Am echten Handy gibt es „Teilen“ des Systems: die zweite Taste im Fuß ist der ungünstigere Fall
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: () => Promise.resolve(), configurable: true });
    });
  }
  const extra = opts.oeffentlich ? { shareCode: CODE, isPublic: true } : { isPublic: false };
  await seed({ tournaments: [buildVisualTournament({ id: ID, title: 'Nikolaus-Turnier', extra })] });
  await page.goto(`/#/tournament/${ID}/schedule`);
  await page.locator('.schedule-action-buttons').getByRole('button', { name: 'Teilen', exact: true }).click();
  const dialog = page.getByTestId('dialog-surface');
  await expect(dialog).toBeVisible();
  // QR geladen und Einblend-Animation beendet, bevor gemessen oder fotografiert wird
  await expect.poll(() => page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('[data-testid="share-dialog-qr"]');
    return img !== null && img.complete && img.naturalWidth > 0;
  })).toBe(true);
  await expect.poll(() => page.evaluate(laufendeEinblendungen)).toBe(0);
  return dialog;
}

async function bild(page: Page, testOrdner: string, name: string) {
  const ordner = process.env.TEILEN_SCR ?? testOrdner;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${process.env.TEILEN_PREFIX ?? 'bild'}-${name}.png`) });
}

const messe = (page: Page) =>
  page.evaluate(() => {
    const box = (id: string) => {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!el) {return null;}
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const link = document.querySelector<HTMLElement>('[data-testid="share-dialog-link"]');
    const body = document.querySelector<HTMLElement>('[data-testid="dialog-surface-body"]');
    return {
      fenster: { w: window.innerWidth, h: window.innerHeight },
      dialog: box('dialog-surface'),
      code: box('share-dialog-code'),
      qr: box('share-dialog-qr'),
      kopieren: box('share-dialog-copy'),
      fuss: box('dialog-surface-footer'),
      link: box('share-dialog-link'),
      linkText: link?.textContent ?? '',
      linkZeilenHoehe: link ? parseFloat(getComputedStyle(link).lineHeight) || 0 : 0,
      linkUeberlauf: link ? link.scrollWidth > link.clientWidth : true,
      inhaltUeberhang: body ? body.scrollHeight - body.clientHeight : -1,
      inhaltScrollt: body ? body.scrollHeight > body.clientHeight + 1 : true,
    };
  });

test.describe('@OB-085 Teilen-Dialog am Handy', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const g of GERAETE) {
    test(`@OB-085 ${g.name}: Code, QR und „Link kopieren“ ohne Scrollen sichtbar, Link kurz und ganz`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await oeffneDialog(page, seedIndexedDB, { oeffentlich: true, teilenUnterstuetzt: true });
      await bild(page, testInfo.outputDir, g.name);
      if (g.name === '390x844') {
        await page.emulateMedia({ colorScheme: 'dark' });
        await expect.poll(() => page.evaluate(laufendeEinblendungen)).toBe(0);
        await bild(page, testInfo.outputDir, `${g.name}-dunkel`);
        await page.emulateMedia({ colorScheme: 'light' });
      }

      const m = await messe(page);
      const imFenster = (b: { top: number; bottom: number; left: number; right: number } | null, was: string) => {
        expect(b, `${was} fehlt`).not.toBeNull();
        expect(b?.top, `${was} oben`).toBeGreaterThanOrEqual(0);
        expect(b?.left, `${was} links`).toBeGreaterThanOrEqual(0);
        expect(b?.right, `${was} rechts`).toBeLessThanOrEqual(m.fenster.w);
        expect(b?.bottom, `${was} unten`).toBeLessThanOrEqual(m.fenster.h);
      };
      imFenster(m.code, 'Code');
      imFenster(m.qr, 'QR-Code');
      imFenster(m.kopieren, 'Link kopieren');
      expect(m.inhaltScrollt, 'Inhalt scrollt im Dialog').toBe(false);

      // QR-Code mindestens 160 Bildpunkte breit
      expect(m.qr?.width).toBeGreaterThanOrEqual(160);

      // Taste im Fuß des Dialogs, mit Abstand zum unteren Rand (Fuß-Polster) und in Haupttastenhöhe
      expect(m.fuss, 'Fuß fehlt').not.toBeNull();
      expect(m.kopieren!.top).toBeGreaterThanOrEqual(m.fuss!.top);
      expect(m.kopieren!.bottom).toBeLessThan(m.fenster.h);
      expect(m.fenster.h - m.kopieren!.bottom).toBeGreaterThanOrEqual(8);
      expect(m.kopieren!.height).toBeGreaterThanOrEqual(56);

      // Link: kurze Adresse mit vollem Code, ohne „#/“ und ohne „…“, nichts abgeschnitten
      expect(m.linkText).toMatch(new RegExp(`^https?://[^/]+/live/${CODE}$`));
      expect(m.linkText).not.toContain('#/');
      expect(m.linkText).not.toContain('…');
      expect(m.linkUeberlauf, 'Link läuft über').toBe(false);
      imFenster(m.link, 'Link');
    });
  }

  test('@OB-085 QR-Code und Link tragen dieselbe Adresse, „Link kopieren“ kopiert sie', async ({ page, context, seedIndexedDB }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 360, height: 640 });
    await oeffneDialog(page, seedIndexedDB, { oeffentlich: true, teilenUnterstuetzt: false });
    const link = (await page.getByTestId('share-dialog-link').textContent()) ?? '';
    await page.getByTestId('share-dialog-copy').click();
    await expect(page.getByTestId('share-dialog-feedback')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    expect(link).toMatch(new RegExp(`/live/${CODE}$`));
    // Der QR-Code trägt die Adresse im Bild; die Lesbarkeit prüft der Vitest (qrCodeGenerator-Aufruf), hier: Bild ist da und quadratisch
    const qr = await messe(page);
    expect(Math.abs((qr.qr?.width ?? 0) - (qr.qr?.height ?? 1))).toBeLessThanOrEqual(1);
  });

  test('@OB-085 nicht öffentlich: Hinweis, QR und interner Link passen bei 360×640 ins Bild', async ({ page, seedIndexedDB }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await oeffneDialog(page, seedIndexedDB, { oeffentlich: false, teilenUnterstuetzt: true });
    await bild(page, testInfo.outputDir, '360x640-nicht-oeffentlich');
    const m = await messe(page);
    expect(m.code, 'kein Code im nicht öffentlichen Zustand').toBeNull();
    expect(m.qr!.bottom).toBeLessThanOrEqual(m.fenster.h);
    expect(m.kopieren!.bottom).toBeLessThanOrEqual(m.fenster.h);
    expect(m.inhaltScrollt, `Inhalt scrollt im Dialog (Überhang ${m.inhaltUeberhang}px)`).toBe(false);
    expect(m.qr!.width).toBeGreaterThanOrEqual(160);
    // interne Adresse bleibt, wie sie ist
    expect(m.linkText).toContain(`/#/tournament/${ID}`);
    expect(m.linkUeberlauf).toBe(false);
  });

  test('@OB-085 Gegenbeispiel Laptop 1280×800: Dialog unverändert bedienbar, QR in Normalgröße', async ({ page, seedIndexedDB }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await oeffneDialog(page, seedIndexedDB, { oeffentlich: true, teilenUnterstuetzt: false });
    await bild(page, testInfo.outputDir, '1280x800');
    const m = await messe(page);
    expect(m.qr!.width).toBeGreaterThanOrEqual(200);
    expect(m.kopieren!.bottom).toBeLessThanOrEqual(m.fenster.h);
    expect(m.dialog!.width).toBeLessThanOrEqual(500 + 1);
    expect(m.inhaltScrollt).toBe(false);
    await page.getByTestId('share-dialog-copy').click();
    await expect(page.getByTestId('share-dialog-feedback')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dialog-surface')).toHaveCount(0);
  });
});
