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

const LANGER_TITEL = 'Hallencup der Jugendabteilungen Süd';

const turnier = () => buildVisualTournament({
  id: ID,
  title: LANGER_TITEL,
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
  }
});
