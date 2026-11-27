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

const TOLERANZ = 1;
const ZWEISTELLIG = '00000003-0000-4000-8000-000000000009';

interface Zeile { artikelMitte: number; pfeilRand: number; pfeilBreite: number; innenabstand: number; pfeilX: number; stand: number; logoHeim: number; logoGast: number; teamHeim: number; teamGast: number; pfeil: boolean; text: string }

async function oeffne(page: Page, breite: number, sonderzeilen = false): Promise<void> {
  await page.setViewportSize({ width: breite, height: 900 });
  const saat = messSaat();
  const turniere = saat.datenbanken.find((db) => db.store === 'cache')?.eintraege.tournaments as Array<{ id: string; matches: Array<Record<string, unknown>> }>;
  const spiel = turniere.find((t) => t.id === TURNIER_ID)?.matches.find((m) => m.id === ZWEISTELLIG);
  if (spiel === undefined) { throw new Error('Spiel 9 fehlt in der Saat'); }
  spiel.scoreA = 12;
  spiel.scoreB = 3;
  // Pfeil nur bei Spielen mit Ereignissen: je zweites Spiel mit Toren bekommt ein Tor als Ereignis, die übrigen (u. a. 0:0) bleiben ohne Pfeil
  turniere.find((t) => t.id === TURNIER_ID)?.matches.forEach((m, i) => {
    if (i % 2 === 0 && m.matchStatus === 'finished' && Number(m.scoreA) + Number(m.scoreB) > 0) {
      m.events = [{ id: `ereignis-${String(i)}`, matchId: String(m.id), timestampSeconds: 180, type: 'GOAL', payload: { direction: 'INC' }, scoreAfter: { home: 1, away: 0 } }];
    }
  });
  // Sonderzeilen „ausgefallen“ und „gewertet“ (Hinweis unter dem Stand): ungerade Spiele, also ohne Ereignisse; nur für den Test des Befunds C-ZUSCHAUER-STAND-SONDERTEXT
  const spiele = turniere.find((t) => t.id === TURNIER_ID)?.matches ?? [];
  if (sonderzeilen) {
    const ungerade = spiele.filter((m, i) => i % 2 === 1 && m.id !== ZWEISTELLIG);
    if (ungerade.length < 2) { throw new Error('zu wenige Spiele in der Saat'); }
    ungerade[0].matchStatus = 'skipped';
    Object.assign(ungerade[1], { matchStatus: 'finished', scoreA: 0, scoreB: 2, decidedBy: 'forfeit', forfeitAbsent: 'A' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installiereSaat(page.context(), saat);
  await page.goto(`/#/live/${ZUSCHAUER_CODE}`);
  await expect(page.getByText(SCHRAEGSTRICH_NAME).filter({ visible: true }).first()).toBeVisible({ timeout: 25000 });
  await animationenFertig(page);
}

async function zeilen(page: Page): Promise<Zeile[]> {
  return page.locator('[role="article"]').evaluateAll((artikel) => artikel.flatMap((a) => {
    const kreis = a.querySelector('[data-testid^="match-circle-"]');
    const heim = a.querySelector('[data-testid$="-home"][data-teamname]');
    const gast = a.querySelector('[data-testid$="-away"][data-teamname]');
    if (kreis === null || heim === null || gast === null || (a as HTMLElement).offsetParent === null) { return []; }
    const zelle = (el: Element): HTMLElement | null => el.closest('[data-score-circle]') ?? el.parentElement?.closest('div') ?? null;
    const mitte = (el: Element): number => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
    const heimZelle = zelle(heim);
    const gastZelle = zelle(gast);
    const logo = (z: HTMLElement | null, erstes: boolean): number => {
      const kinder = Array.from(z?.children ?? []);
      const k = erstes ? kinder[0] : kinder[kinder.length - 1];
      return k === undefined ? Number.NaN : mitte(k);
    };
    const kreise = a.querySelectorAll('[data-score-circle]');
    const pfeil = a.querySelector('[data-testid^="match-arrow-"]') !== null;
    const pfeilZelle = kreise[kreise.length - 1];
    const pfeilX = mitte(pfeilZelle);
    const zeileEl = pfeilZelle.parentElement?.parentElement;
    const artikel = a.getBoundingClientRect();
    const pfeilFlaeche = pfeilZelle.getBoundingClientRect();
    return [{
      artikelMitte: artikel.left + artikel.width / 2, pfeilRand: artikel.right - pfeilFlaeche.right, pfeilBreite: pfeilFlaeche.width,
      innenabstand: zeileEl === undefined || zeileEl === null ? Number.NaN : parseFloat(getComputedStyle(zeileEl).paddingRight),
      pfeilX, stand: mitte(kreis), logoHeim: logo(heimZelle, false), logoGast: logo(gastZelle, true),
      teamHeim: mitte(heim), teamGast: mitte(gast), pfeil, text: kreis.textContent?.trim() ?? '',
    }];
  }));
}

test.describe('@ZM-218 Stand und Logos im Spielplan der Zuschauer-Seite in festen Spalten', () => {
  for (const breite of [1280, 1024]) {
    test(`@ZM-218 bei ${String(breite)} Pixeln: Stand mittig und Logos in allen Zeilen an derselben Stelle, mit und ohne Pfeil, auch bei „12:3“`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
      await oeffne(page, breite);
      const liste = await zeilen(page);
      expect(liste.length, 'Spielzeilen der Tabellenansicht sind sichtbar').toBeGreaterThanOrEqual(6);
      expect(liste.some((z) => z.pfeil), 'es gibt Zeilen mit Pfeil').toBe(true);
      expect(liste.some((z) => !z.pfeil), 'es gibt Zeilen ohne Pfeil').toBe(true);
      expect(liste.some((z) => z.text === '12:3'), `es gibt die Zeile mit „12:3“, gefunden: ${liste.map((z) => z.text).join(' ')}`).toBe(true);
      const ref = liste[0];
      for (const z of liste) {
        const beleg = JSON.stringify(z);
        expect(Math.abs(z.stand - ref.stand), `Stand ${z.text} gegenüber Zeile 1: ${beleg}`).toBeLessThanOrEqual(TOLERANZ);
        expect(Math.abs(z.logoHeim - ref.logoHeim), `Logo Heim ${z.text}: ${beleg}`).toBeLessThanOrEqual(TOLERANZ);
        expect(Math.abs(z.logoGast - ref.logoGast), `Logo Gast ${z.text}: ${beleg}`).toBeLessThanOrEqual(TOLERANZ);
        expect(Math.abs(z.stand - (z.logoHeim + z.logoGast) / 2), `Stand ${z.text} mittig zwischen den Logos: ${beleg}`).toBeLessThanOrEqual(TOLERANZ);
        expect(Math.abs((z.stand - z.logoHeim) - (z.logoGast - z.stand)), `Abstand Logo–Stand links = rechts: ${beleg}`).toBeLessThanOrEqual(TOLERANZ);
        expect(Math.abs(z.pfeilX - ref.pfeilX), `Pfeil-Spalte in allen Zeilen an derselben Stelle: ${beleg}`).toBeLessThanOrEqual(TOLERANZ);
        expect(Math.abs(z.stand - z.artikelMitte), `Stand ${z.text} in der Kartenmitte (Mitte der Karte ${String(z.artikelMitte)}): ${beleg}`).toBeLessThanOrEqual(TOLERANZ);
        expect(z.pfeilX, `Pfeil ${z.text} rechts vom Gast-Logo: ${beleg}`).toBeGreaterThan(z.logoGast);
        expect(z.pfeilRand, `Pfeil ${z.text} am Zeilenende (Rand ${String(z.pfeilRand)}): ${beleg}`).toBeLessThan(z.pfeilBreite + z.innenabstand);
      }
    });
  }

  // Befund C-ZUSCHAUER-STAND-SONDERTEXT: „ausgefallen“/„gewertet“ machen die Stand-Zelle breiter, die Logos dieser Zeilen rücken nach außen (Entscheidung Product Owner: nach dem Turnier)
  for (const breite of [1280, 1024]) {
    test(`@ZM-218 bei ${String(breite)} Pixeln: Logos in den Zeilen „ausgefallen“ und „gewertet“ stehen wie in den normalen Zeilen`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
      test.fail(true, 'Befund C-ZUSCHAUER-STAND-SONDERTEXT, @ZM-218');
      await oeffne(page, breite, true);
      const liste = await zeilen(page);
      const normal = liste.find((z) => /^\d+:\d+$/.test(z.text));
      if (normal === undefined) { throw new Error('keine normale Zeile gefunden'); }
      const sonder = liste.filter((z) => z.text.startsWith('ausgefallen') || z.text.startsWith('cancelled') || /gewertet|awarded/i.test(z.text));
      expect(sonder.length, 'Zeilen „ausgefallen“ und „gewertet“ sind da').toBeGreaterThanOrEqual(2);
      for (const z of sonder) {
        expect(Math.abs(z.logoHeim - normal.logoHeim), `Logo Heim ${z.text}: ${JSON.stringify(z)}`).toBeLessThanOrEqual(TOLERANZ);
        expect(Math.abs(z.logoGast - normal.logoGast), `Logo Gast ${z.text}: ${JSON.stringify(z)}`).toBeLessThanOrEqual(TOLERANZ);
      }
    });
  }

  for (const breite of [1280, 1024]) {
    test(`@ZM-218 bei ${String(breite)} Pixeln: der große Stand der aufgeklappten Ereignisse steht genau unter dem Stand der Zeile`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
      await oeffne(page, breite);
      const erste = page.locator('[role="article"]').filter({ has: page.locator('[data-testid^="match-circle-"]') }).filter({ has: page.locator('[data-testid^="match-arrow-"]') }).first();
      const standZeile = erste.locator('[data-testid^="match-circle-"]');
      await standZeile.click();
      await expect(page.locator('[data-expand-content]').filter({ visible: true })).toHaveCount(1);
      const gross = await page.locator('[data-expand-content]').filter({ visible: true }).evaluate((el) => {
        const treffer = Array.from(el.querySelectorAll('*')).filter((n) => /^\d+\s*:\s*\d+$/.test((n.textContent ?? '').trim()));
        const innerstes = treffer[treffer.length - 1];
        const r = innerstes.getBoundingClientRect();
        return r.left + r.width / 2;
      });
      const kasten = await standZeile.boundingBox();
      expect(kasten).not.toBeNull();
      const zeileX = (kasten?.x ?? 0) + (kasten?.width ?? 0) / 2;
      expect(Math.abs(gross - zeileX), `großer Stand x=${String(gross)}, Stand der Zeile x=${String(zeileX)}`).toBeLessThanOrEqual(2);
    });
  }
});
