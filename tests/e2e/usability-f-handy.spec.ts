/**
 * Usability F (Handy 360×640 und 390×844, Prüfbericht 2026-10-30): @OB-022 Tippflächen ≥ 44, Haupttaste ≥ 56, Eingabeschrift ≥ 16,
 * Rechtslinks am Seitenende nicht unter der unteren Leiste; @OB-025 Turniername nie mit „…“.
 * Vorher (origin/main): Zahnrad 49×30, Suchfeld 14 px / 35 hoch, Filter-Chips 24 hoch, Schritt-Punkte 23,6×24, „Zurück“ 36 hoch,
 * „Weiter“ 44 ohne `data-primary`, Fußlinks unter der Leiste. Bilder: Ordner aus UF_SCR (sonst im Testergebnis-Ordner).
 * Läuft nur im Projekt `desktop` (setzt das Fenster selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'uf-tournament';
const GERAETE = [
  { name: 'handy-360x640', width: 360, height: 640 },
  { name: 'handy-390x844', width: 390, height: 844 },
] as const;

const TEAMS = ['FC Nordstadt', 'SV Südpark', 'TSV Westtal', 'BSC Ostring'].map((name, i) => ({
  id: `00000000-0000-4000-8000-0000000000c${i + 1}`,
  name,
}));

const KURZER_TITEL = 'Hallencup Messlauf';
const LANGER_TITEL = 'Hallencup der Jugendabteilungen Süd';

const turnier = (title: string = LANGER_TITEL) => buildVisualTournament({
  id: ID,
  title,
  matches: [{
    id: 'uf-match-1', round: 1, teamA: TEAMS[0].id, teamB: TEAMS[1].id, field: 1, matchStatus: 'scheduled' as const,
    scheduledTime: '2026-03-14T09:00:00.000Z',
  }],
  extra: { teams: TEAMS, numberOfTeams: 4 },
});

interface Mass { w: number; h: number; fontSize: number; primary: boolean }
const mass = (page: Page, selektor: string, nr = 0): Promise<Mass> =>
  page.evaluate(([s, n]) => {
    const el = document.querySelectorAll<HTMLElement>(s as string)[n as number];
    if (!el) { throw new Error(`Element ${String(s)} fehlt`); }
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, fontSize: parseFloat(getComputedStyle(el).fontSize), primary: el.hasAttribute('data-primary') };
  }, [selektor, nr]);


/** Misst im Bereich `wurzel` jedes Bedienelement: Tippfläche ≥ 44 (bei Auswahlknopf/Häkchen zählt die Beschriftungszeile), Eingabeschrift ≥ 16 px,
 *  kein „…“ in Auswahlfeldern (Text passt in die Breite). Liefert Verstöße als lesbare Zeilen. */
const messeBereich = (page: Page, wurzel: string) =>
  page.evaluate((w) => {
    const root = document.querySelector(w);
    if (!root) { throw new Error(`Bereich ${w} fehlt`); }
    const sichtbar = (el: Element) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const befunde: string[] = [];
    const ctx = document.createElement('canvas').getContext('2d')!;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"], [role="tab"]')).filter(sichtbar)) {
      const art = el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
      const name = el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 24) ?? art;
      const zeile = ['checkbox', 'radio'].includes(art) ? el.closest('label') : null;
      const r = (zeile ?? el).getBoundingClientRect();
      if (r.height < 43.5) { befunde.push(`${art} „${name}“ ${r.width.toFixed(0)}×${r.height.toFixed(1)} (Höhe < 44)`); }
      const cs = getComputedStyle(el);
      if (['select', 'textarea', 'text', 'number', 'email', 'tel', 'time', 'date'].includes(art) && parseFloat(cs.fontSize) < 16) { befunde.push(`${art} „${name}“ Schrift ${cs.fontSize} (< 16)`); }
      // Ausnahme (eigener Befund, nicht F): „Timer-Richtung“ im Panel Match Cockpit – die Karte begrenzt die Breite (@OB-021), der Wert wird dort gekürzt
      if (el instanceof HTMLSelectElement && el.getAttribute('aria-label') !== 'Timer-Richtung') {
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const text = el.selectedOptions[0]?.textContent ?? '';
        const frei = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (ctx.measureText(text).width > frei + 1) { befunde.push(`select „${name}“ Wert „${text}“ passt nicht in die Breite (${ctx.measureText(text).width.toFixed(0)} > ${frei.toFixed(0)}) – „…“`); }
      }
    }
    return befunde;
  }, wurzel);

async function bild(page: Page, name: string, testInfo: { outputDir: string }) {
  const ordner = process.env.UF_SCR ?? testInfo.outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`) });
}

test.describe('Usability F am Handy', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const g of GERAETE) {
    test(`@OB-022 ${g.name}: Dashboard – Suchfeld ≥ 16 px und ≥ 44, Chips ≥ 44, „Neues Turnier“ Haupttaste ≥ 56, Fußlinks nicht verdeckt`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier()] });
      await page.goto('/#/');
      await expect(page.getByTestId('search-input')).toBeVisible();
      const suche = await mass(page, '[data-testid="search-input"]');
      expect(suche.fontSize).toBeGreaterThanOrEqual(16);
      expect(suche.h).toBeGreaterThanOrEqual(44);
      const chips = await page.locator('[data-testid^="filter-chip-"]').count();
      expect(chips).toBeGreaterThan(2);
      for (let i = 0; i < chips; i++) { expect((await mass(page, '[data-testid^="filter-chip-"]', i)).h).toBeGreaterThanOrEqual(44); }
      const neu = await mass(page, '[data-primary]');
      expect(neu.h).toBeGreaterThanOrEqual(56);
      // Seitenende: „Impressum“ liegt über der unteren Leiste (nicht verdeckt)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(300);
      const verdeckt = await page.evaluate(() => {
        const link = document.querySelector<HTMLElement>('[data-testid="footer-impressum-link"]');
        if (!link) { throw new Error('Impressum-Link fehlt'); }
        const r = link.getBoundingClientRect();
        const oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return oben !== null && !(oben === link || link.contains(oben) || oben.contains(link));
      });
      expect(verdeckt).toBe(false);
      await bild(page, `dashboard-${g.name}-nachher`, testInfo);
    });

    test(`@OB-022 ${g.name}: Assistent Schritt 1 – Schritt-Punkte ≥ 44, „Zurück“ ≥ 44, „Weiter“ Haupttaste ≥ 56`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await page.goto('/#/tournament/new');
      await expect(page.getByRole('tab').first()).toBeVisible();
      const schritte = await page.getByRole('tab').count();
      expect(schritte).toBe(6);
      for (let i = 0; i < schritte; i++) {
        const m = await mass(page, '[role="tab"]', i);
        expect(m.w, `Schritt ${i + 1} Breite`).toBeGreaterThanOrEqual(44);
        expect(m.h, `Schritt ${i + 1} Höhe`).toBeGreaterThanOrEqual(44);
      }
      expect((await mass(page, 'header button')).h).toBeGreaterThanOrEqual(44);
      const weiter = await mass(page, '[data-primary]');
      expect(weiter.primary).toBe(true);
      expect(weiter.h).toBeGreaterThanOrEqual(56);
      // Haupttaste ohne Scrollen im Fenster (primaer.sichtbar)
      const unten = await page.evaluate(() => document.querySelector<HTMLElement>('[data-primary]')!.getBoundingClientRect().bottom);
      expect(unten).toBeLessThanOrEqual(g.height);
      await bild(page, `wizard-1-${g.name}-nachher`, testInfo);
    });

    test(`@OB-022 @OB-025 ${g.name}: Turnierseite – Zahnrad ≥ 44 × 44, Turniername ohne „…“ und mit allen Wörtern sichtbar`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier()] });
      await page.goto(`/#/tournament/${ID}/schedule`);
      const kopf = page.locator('header').first();
      await expect(kopf).toContainText('Hallencup');
      const zahnrad = await mass(page, 'button[title="Admin Center öffnen"]');
      expect(zahnrad.w).toBeGreaterThanOrEqual(44);
      expect(zahnrad.h).toBeGreaterThanOrEqual(44);
      const titel = await page.evaluate((t) => {
        const el = [...document.querySelectorAll<HTMLElement>('header div')].find((d) => d.textContent === t);
        if (!el) { throw new Error('Titel fehlt'); }
        const cs = getComputedStyle(el);
        return { ellipsis: cs.textOverflow === 'ellipsis', abgeschnitten: el.scrollWidth > el.clientWidth + 1 };
      }, LANGER_TITEL);
      expect(titel.ellipsis).toBe(false);
      expect(titel.abgeschnitten).toBe(false);
      await bild(page, `turnierseite-${g.name}-nachher`, testInfo);
    });

    test(`@OB-022 @OB-025 ${g.name}: Assistent Schritt 3 – alle Bedienelemente ≥ 44, Eingaben ≥ 16 px, Smart-Konfiguration ohne „…“`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await page.goto('/#/tournament/new?step=3');
      await page.getByText(/Smart-Konfiguration/).first().click();
      await expect(page.locator('.step-content select').first()).toBeVisible();
      // „Spieldauer“ und „Pausendauer“ einschalten, damit die längsten Werte („10 Min“) sichtbar sind
      for (const box of await page.locator('#smart-config-panel input[type="checkbox"]').all()) { await box.check(); }
      await page.waitForTimeout(300);
      expect(await messeBereich(page, '.step-content')).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await bild(page, `wizard-3-${g.name}-nachher`, testInfo);
    });

    test(`@OB-022 ${g.name}: Assistent Schritt 5 – Teamzeilen, Gruppenwahl und Farbauswahl ≥ 44, Eingaben ≥ 16 px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await page.goto('/#/tournament/new?step=5');
      await expect(page.getByTestId('wizard-add-team')).toBeVisible();
      for (let i = 0; i < 2; i++) { await page.getByTestId('wizard-add-team').click(); }
      await expect(page.locator('[data-testid^="wizard-team-details-"]').first()).toBeVisible();
      expect(await messeBereich(page, '.step-content')).toEqual([]);
      // Farbauswahl öffnen: jede Voreinstellung ≥ 44 × 44
      await page.locator('[data-testid^="wizard-team-details-"]').first().click();
      await page.locator('button[aria-haspopup="true"]').first().click();
      const farben = page.getByRole('option');
      expect(await farben.count(), 'Farbvoreinstellungen sichtbar').toBeGreaterThan(4);
      for (let i = 0; i < await farben.count(); i++) {
        const m = await mass(page, '[role="option"]', i);
        expect(m.h).toBeGreaterThanOrEqual(44);
        expect(m.w).toBeGreaterThanOrEqual(44);
      }
      expect(await messeBereich(page, '.step-content')).toEqual([]);
      await bild(page, `wizard-5-${g.name}-nachher`, testInfo);
    });

    test(`@OB-022 ${g.name}: Assistent-Fußleiste – „Zurück“ und „Weiter“ in einer Zeile, Weiter ≥ 56, Zurück ≥ 44, Fokus landet nicht hinter der Leiste`, async ({ page }) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      for (const schritt of [1, 3, 5]) {
        await page.goto(`/#/tournament/new?step=${String(schritt)}`);
        const leiste = page.getByTestId('wizard-footer-bar');
        await expect(leiste).toBeVisible();
        const box = await page.evaluate(() => {
          const bar = document.querySelector<HTMLElement>('[data-testid="wizard-footer-bar"]')!;
          const knoepfe = Array.from(bar.querySelectorAll('button')).map((b) => { const r = b.getBoundingClientRect(); return { text: (b.textContent ?? '').trim(), top: r.top, bottom: r.bottom, h: r.height, left: r.left, right: r.right }; });
          const r = bar.getBoundingClientRect();
          return { knoepfe, leiste: { top: r.top, bottom: r.bottom, h: r.height }, scrollPadding: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom), fenster: window.innerHeight, breite: window.innerWidth };
        });
        const weiter = box.knoepfe.find((k) => k.text === 'Weiter')!;
        const zurueck = box.knoepfe.find((k) => k.text === 'Zurück')!;
        expect(Math.abs(weiter.top - zurueck.top), `Schritt ${String(schritt)}: Zurück und Weiter in einer Zeile`).toBeLessThanOrEqual(30);
        expect(weiter.left).toBeGreaterThan(zurueck.right - 1);
        expect(weiter.h).toBeGreaterThanOrEqual(56);
        expect(zurueck.h).toBeGreaterThanOrEqual(44);
        for (const k of box.knoepfe) { expect(k.right, 'Taste im Bild').toBeLessThanOrEqual(box.breite + 0.5); }
        expect(box.leiste.bottom).toBeLessThanOrEqual(box.fenster + 0.5);
        // Leiste höchstens eine Tastenreihe hoch (nicht mehr gestapelt)
        expect(box.leiste.h).toBeLessThan(56 + 40);
        expect(box.scrollPadding, 'scroll-padding-bottom ≥ Leistenhöhe').toBeGreaterThanOrEqual(box.leiste.h);
      }
      // Fokus: das letzte Eingabefeld von Schritt 1 landet nach focus() nicht hinter der Leiste
      await page.goto('/#/tournament/new?step=1');
      const felder = page.locator('.step-content input:visible');
      const n = await felder.count();
      await felder.nth(n - 1).focus();
      await page.waitForTimeout(300);
      const hinter = await page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>('[data-testid="wizard-footer-bar"]')!.getBoundingClientRect();
        const el = document.activeElement as HTMLElement;
        return el.getBoundingClientRect().bottom > bar.top + 0.5 && el.getBoundingClientRect().top < bar.bottom;
      });
      expect(hinter, 'fokussiertes Feld liegt nicht hinter der Leiste').toBe(false);
    });

    test(`@OB-022 ${g.name}: Turnierseite – Fuß-Links am Seitenende nicht von „Teilen/Als PDF“ oder der unteren Leiste verdeckt`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier()] });
      await page.goto(`/#/tournament/${ID}/schedule`);
      await expect(page.getByTestId('schedule-action-pdf')).toBeAttached();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
      for (const id of ['footer-impressum-link', 'footer-datenschutz-link']) {
        const verdeckt = await page.evaluate((testid) => {
          const link = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
          if (!link) { throw new Error(`${testid} fehlt`); }
          const r = link.getBoundingClientRect();
          const oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return oben !== null && !(oben === link || link.contains(oben) || oben.contains(link));
        }, id);
        expect(verdeckt, id).toBe(false);
      }
    });

    test(`@OB-022 ${g.name}: Tabellen – die Segmenttasten berühren sich nicht`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier()] });
      await page.goto(`/#/tournament/${ID}/standings`);
      const abstand = await page.evaluate(() => {
        const knoepfe = Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => /^(Gruppen|Tabelle|Gesamtplatzierung|Endstand)$/.test((b.textContent ?? '').trim()));
        const gruppe = knoepfe.length > 1 ? knoepfe : [];
        return gruppe.slice(1).map((b, i) => b.getBoundingClientRect().left - gruppe[i].getBoundingClientRect().right);
      });
      for (const a of abstand) { expect(a).toBeGreaterThanOrEqual(3.5); }
    });
  }
});

test.describe('Usability F am Tablet', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  test('@OB-025 Tablet 768×1024: Kopf der Turnierseite – Titel einzeilig, Tastengruppe rechts oben in derselben Zeile', async ({ page, seedIndexedDB }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await seedIndexedDB({ tournaments: [turnier(KURZER_TITEL)] });
    await page.goto(`/#/tournament/${ID}/schedule`);
    await expect(page.locator('header').first()).toContainText('Hallencup');
    const m = await page.evaluate((t) => {
      const kopf = document.querySelector('header')!;
      const titel = [...kopf.querySelectorAll<HTMLElement>('div')].find((d) => d.textContent === t)!;
      const gruppe = kopf.querySelector<HTMLElement>('[data-testid="management-header-actions"]')!.getBoundingClientRect();
      const tr = titel.getBoundingClientRect();
      const zeilen = Math.round(tr.height / parseFloat(getComputedStyle(titel).lineHeight === 'normal' ? String(parseFloat(getComputedStyle(titel).fontSize) * 1.2) : getComputedStyle(titel).lineHeight));
      return { zeilen, gruppeRechts: gruppe.right, gruppeOben: gruppe.top, titelOben: tr.top, titelUnten: tr.bottom, breite: window.innerWidth, kopfHoehe: kopf.getBoundingClientRect().height };
    }, KURZER_TITEL);
    expect(m.zeilen, 'Titel einzeilig').toBe(1);
    expect(m.gruppeOben, 'Tastengruppe in der Zeile des Titels').toBeLessThan(m.titelUnten);
    expect(m.gruppeRechts, 'Tastengruppe rechts oben (am rechten Rand)').toBeGreaterThan(m.breite - 40);
    expect(m.kopfHoehe).toBeLessThan(140);
    await bild(page, 'turnierseite-tablet-nachher', testInfo);
  });
});
