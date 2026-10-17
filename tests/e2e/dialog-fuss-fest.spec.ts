/**
 * @OB-062 Kopf und Tasten-Fuß eines Dialogs bleiben beim Scrollen sichtbar (Grundriss: Laptop 1440×900, Laptop 1280×720,
 * Handy 360×640 hoch) und @OB-063 (Gegenbeispiel: kurzer Dialog bleibt so hoch wie sein Inhalt), Zusammenspiel @OB-061/@OB-022/@OB-021.
 * Werte aus dem Gherkin: Dialog „Als PDF“, Titel „Als PDF“, Schließen-Kreuz, Taste „Als PDF speichern“; Rückfrage mit einem Satz und
 * zwei Tasten auf 1440×900. Das scrollende Element wird nicht über Testkennungen des Bausteins gesucht, sondern als das Element im
 * Dialog, das tatsächlich scrollt (so ist der Test vor der Änderung rot, mit Zahlen).
 * Bilder: Ordner aus S1_BILDER, Namensvorsatz aus S1_PHASE (vorher | nachher). Läuft nur im Projekt `desktop` (setzt Fenster selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`, hier an einem geöffneten Dialog angewandt
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const ID = 'dialog-fuss-fest-tournament';
const GERAETE = [
  { name: 'laptop-1440x900', width: 1440, height: 900, art: 'desktop' },
  { name: 'laptop-1280x720', width: 1280, height: 720, art: 'desktop' },
  { name: 'handy-360x640', width: 360, height: 640, art: 'handy' },
] as const;

interface Box { top: number; bottom: number; left: number; right: number }
interface Stand {
  fenster: { w: number; h: number };
  titel: Box;
  schliessen: Box;
  haupttaste: Box;
  flaeche: Box;
  scroller: { gefunden: boolean; scrollTop: number; ueberlauf: number };
  inhaltOben: number;
}

async function oeffnePdfDialog(page: Page, seed: (d: Record<string, unknown>) => Promise<void>) {
  await seed({ tournaments: [buildVisualTournament({ id: ID, title: 'Nordstadt Hallencup' })] });
  await page.goto(`/#/tournament/${ID}/schedule`);
  await page.getByTestId('schedule-action-pdf').click();
  await expect(page.getByTestId('pdf-save')).toBeVisible();
  await page.waitForTimeout(600); // Einblendung abwarten (Öffnungszustand)
}

/** Ort von Titel, Schließen-Kreuz und Haupttaste; das tatsächlich scrollende Element im Dialog (falls eines überläuft). */
const messe = (page: Page): Promise<Stand> =>
  page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) {throw new Error('kein Dialog');}
    const box = (el: Element | null): Box => {
      if (!el) {throw new Error('Element fehlt');}
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const titel = [...dialog.querySelectorAll('h2')].find((h) => h.textContent?.trim() === 'Als PDF') ?? null;
    const scroller = [dialog, ...dialog.querySelectorAll<HTMLElement>('*')].find(
      (e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1,
    );
    const inhalt = dialog.querySelector('[data-testid="pdf-save"]')?.closest('[data-dialog-actions]')?.previousElementSibling
      ?? dialog.querySelector('[data-testid^="pdf-"]');
    return {
      fenster: { w: window.innerWidth, h: window.innerHeight },
      titel: box(titel),
      schliessen: box(dialog.querySelector('button[aria-label="Schließen"]')),
      haupttaste: box(dialog.querySelector('[data-testid="pdf-save"]')),
      flaeche: box(dialog),
      scroller: { gefunden: !!scroller, scrollTop: scroller?.scrollTop ?? 0, ueberlauf: scroller ? scroller.scrollHeight - scroller.clientHeight : 0 },
      inhaltOben: inhalt ? inhalt.getBoundingClientRect().top : 0,
    };
  });

const imFenster = (b: Box, f: Stand['fenster']) => b.top >= 0 && b.left >= 0 && b.bottom <= f.h && b.right <= f.w;

async function scrolleGanzNachUnten(page: Page) {
  await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const scroller = [dialog, ...(dialog?.querySelectorAll<HTMLElement>('*') ?? [])].find(
      (e) => !!e && /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1,
    );
    scroller?.scrollTo({ top: scroller.scrollHeight });
  });
  await page.waitForTimeout(100);
}

async function bild(page: Page, testInfo: { outputDir: string }, name: string) {
  const ordner = process.env.S1_BILDER ?? testInfo.outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${process.env.S1_PHASE ?? 'lauf'}-${name}.png`) });
}

test.describe('@OB-062 Kopf und Tasten-Fuß bleiben stehen', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      test(`${g.name}, ${thema}: Titel, Schließen und „Als PDF speichern“ beim Öffnen sichtbar; beim Scrollen bewegt sich nur der Inhalt`, async ({ page, seedIndexedDB }, testInfo) => {
        await page.setViewportSize({ width: g.width, height: g.height });
        await page.emulateMedia({ colorScheme: thema });
        await oeffnePdfDialog(page, seedIndexedDB);

        await bild(page, testInfo, `pdf-dialog-${g.name}-${thema}-geoeffnet`);
        const offen = await messe(page);
        // Gegeben: der Inhalt ist höher als der freie Platz
        expect(offen.scroller.gefunden, 'Inhalt ist höher als der freie Platz (sonst gilt das Szenario nicht)').toBe(true);
        // Dann: ohne zu scrollen Titel, Schließen-Kreuz und Haupttaste im Fenster
        expect(imFenster(offen.titel, offen.fenster), `Titel im Fenster: ${JSON.stringify(offen.titel)}`).toBe(true);
        expect(imFenster(offen.schliessen, offen.fenster), `Schließen im Fenster: ${JSON.stringify(offen.schliessen)}`).toBe(true);
        expect(imFenster(offen.haupttaste, offen.fenster), `Haupttaste im Fenster (Fensterhöhe ${offen.fenster.h}): ${JSON.stringify(offen.haupttaste)}`).toBe(true);
        // … und nicht vom unteren Rand der Dialogfläche abgeschnitten
        expect(offen.haupttaste.bottom, `Haupttaste innerhalb der Dialogfläche (Fläche unten ${offen.flaeche.bottom})`).toBeLessThanOrEqual(offen.flaeche.bottom);

        // Und: beim Scrollen im Dialog bewegt sich nur der Inhalt
        await scrolleGanzNachUnten(page);
        await bild(page, testInfo, `pdf-dialog-${g.name}-${thema}-ganz-unten`);
        const unten = await messe(page);
        expect(unten.scroller.scrollTop, 'der Inhalt hat sich bewegt').toBeGreaterThan(0);
        expect(unten.inhaltOben, 'Inhalt oberhalb der Tasten hat sich bewegt').not.toBeCloseTo(offen.inhaltOben, 0);
        for (const k of ['titel', 'schliessen', 'haupttaste'] as const) {
          expect(unten[k].top, `${k} bleibt oben stehen`).toBeCloseTo(offen[k].top, 0);
          expect(unten[k].bottom, `${k} bleibt unten stehen`).toBeCloseTo(offen[k].bottom, 0);
        }
        // Und: die Haupttaste bleibt vollständig sichtbar
        expect(imFenster(unten.haupttaste, unten.fenster), `Haupttaste nach dem Scrollen: ${JSON.stringify(unten.haupttaste)}`).toBe(true);
        expect(unten.haupttaste.bottom).toBeLessThanOrEqual(unten.flaeche.bottom);
      });
    }

    test(`${g.name}: visual:metrics-Messung primaer.sichtbar und touch.primaer am geöffneten Dialog (HART = 0 Befunde)`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await oeffnePdfDialog(page, seedIndexedDB);
      const m: { befunde: { metrik: string; ist: string }[] } = await page.evaluate(messeSeite, {
        art: g.art,
        g: { 'primaer.sichtbar': 0, 'touch.primaer': 56 },
        randPx: 0,
        primarySelektor: '[data-primary], [data-variant="primary"]',
        extraInhalte: [],
      });
      expect(m.befunde.filter((b) => b.metrik === 'primaer.sichtbar' || b.metrik === 'touch.primaer')).toEqual([]);
    });
  }

  test('Gegenbeispiel Blatt: am Handy sitzt der Fuß an der Unterkante, die Haupttaste hat den Abstand der Safe-Area-Regel', async ({ page, seedIndexedDB }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await oeffnePdfDialog(page, seedIndexedDB);
    const r = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('[role="dialog"]');
      const taste = document.querySelector<HTMLElement>('[data-testid="pdf-save"]');
      if (!panel || !taste) {throw new Error('fehlt');}
      return { layout: panel.getAttribute('data-layout'), panelBottom: panel.getBoundingClientRect().bottom, tasteBottom: taste.getBoundingClientRect().bottom, h: window.innerHeight };
    });
    expect(r.layout).toBe('sheet');
    expect(r.panelBottom).toBeCloseTo(r.h, 0); // Blatt unten verankert
    // zwischen Haupttaste und Unterkante liegt Platz (Fußabstand), die Taste klebt nicht am Rand
    expect(r.h - r.tasteBottom).toBeGreaterThanOrEqual(8);
  });
});

test.describe('@OB-063 Ein kurzer Dialog bleibt so hoch wie sein Inhalt', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  test('Rückfrage „Papierkorb leeren?“ auf 1440×900: Tasten direkt unter dem Satz, nichts scrollt', async ({ page, seedIndexedDB }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const tot = (id: string, titel: string) => buildVisualTournament({ id, title: titel, extra: { deletedAt: '2026-03-10T09:00:00.000Z' } });
    await seedIndexedDB({ tournaments: [tot('papier-1', 'Altes Turnier Eins'), tot('papier-2', 'Altes Turnier Zwei')] });
    await page.goto('/#/papierkorb');
    await page.getByRole('button', { name: /Papierkorb leeren/ }).first().click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog.getByTestId('confirm-dialog-confirm')).toBeVisible();
    await page.waitForTimeout(600);
    await bild(page, testInfo, 'rueckfrage-laptop-1440x900');
    const m = await page.evaluate(() => {
      const d = document.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"]');
      if (!d) {throw new Error('kein Dialog');}
      const satz = d.querySelector('p');
      const taste = d.querySelector('[data-testid="confirm-dialog-confirm"]');
      if (!satz || !taste) {throw new Error('Satz/Taste fehlt');}
      const scrollt = [d, ...d.querySelectorAll<HTMLElement>('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      const satzBox = satz.getBoundingClientRect();
      const tasteBox = taste.getBoundingClientRect();
      const panelBox = d.getBoundingClientRect();
      return { abstand: tasteBox.top - satzBox.bottom, panelHoehe: panelBox.height, fensterHoehe: window.innerHeight, scrollende: scrollt.length };
    });
    expect(m.scrollende, 'nichts im Dialog lässt sich scrollen').toBe(0);
    expect(m.panelHoehe, 'Dialog ist nicht auf die Fensterhöhe gestreckt').toBeLessThan(m.fensterHoehe * 0.5);
    // „direkt unter dem Satz, ohne leere Fläche dazwischen“: höchstens spacing.xl (32 px) plus die 1 px Trennlinie des Fußes
    expect(m.abstand).toBeLessThanOrEqual(33.5);
  });
});
