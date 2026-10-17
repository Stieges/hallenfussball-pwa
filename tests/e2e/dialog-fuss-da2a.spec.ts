/**
 * DA-2a: Turniertag-Dialoge mit festem Kopf und festem Tasten-Fuß (@OB-061 Tasten im Fuß, Haupttaste unten/zuletzt,
 * Beschriftung einzeilig; @OB-062 Kopf und Fuß bleiben beim Scrollen sichtbar; Regel „Tasten im Dialog-Fuß“ im Record Oberfläche).
 * Dialoge: Konflikte im Spielplan-Editor, Spielplan-Filter (Blatt, nur Handy), Abmelden mit offenen Änderungen (über den Prüfstand
 * tests/e2e/harness/logout-warning.html, weil Konto und wartende Einträge offline fehlen). Geräte 360×640 und 1280×720 (Filter nur 360; je ein sehr niedriges Fenster, damit auch der kurze Inhalt scrollen muss),
 * je hell und dunkel. Das scrollende Element wird nicht über Testkennungen des Bausteins gesucht, sondern als das Element im Dialog,
 * das tatsächlich scrollt; Tasten werden über ihre Beschriftung gefunden, damit der Test vor der Umstellung mit Zahlen rot ist.
 * Bilder: Ordner aus DA2A_BILDER, Namensvorsatz aus DA2A_PHASE (vorher | nachher). Läuft nur im Projekt `desktop` (setzt Fenster selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament, type VisualMatchOverride } from './visual/helpers';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`, hier an einem geöffneten Dialog angewandt
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const ID = 'dialog-fuss-da2a-tournament';
const TEAM = [
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2',
  '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4',
];

/** Sechs Zeitslots, in jedem spielt „FC Nordstadt“ auf zwei Feldern gleichzeitig: sechs Fehler (hoher Inhalt), Organisator-Modus. */
function turnierMitKonflikten() {
  const matches: VisualMatchOverride[] = [];
  for (let i = 0; i < 6; i++) {
    const zeit = `2026-03-14T${String(9 + Math.floor(i / 3)).padStart(2, '0')}:${String((i % 3) * 20).padStart(2, '0')}:00.000Z`;
    matches.push({ id: `k${i}a`, round: i + 1, teamA: TEAM[0], teamB: TEAM[1], field: 1, matchStatus: 'scheduled', scheduledTime: zeit });
    matches.push({ id: `k${i}b`, round: i + 1, teamA: TEAM[0], teamB: TEAM[2], field: 2, matchStatus: 'scheduled', scheduledTime: zeit });
  }
  return buildVisualTournament({
    id: ID, title: 'Nordstadt Hallencup', matches,
    extra: {
      numberOfFields: 2,
      fields: [{ id: 'field-1', defaultName: 'Feld 1' }, { id: 'field-2', defaultName: 'Feld 2' }],
      refereeConfig: { mode: 'organizer', numberOfReferees: 2 },
    },
  });
}

type Seed = (d: Record<string, unknown>) => Promise<void>;

interface Fall {
  name: string;
  titel: string;
  /** Tasten im Fuß in der Reihenfolge der Regel; die letzte ist die Haupttaste. Beschriftung beginnt mit … */
  tasten: string[];
  hatKreuz: boolean;
  oeffne: (page: Page, seed: Seed) => Promise<void>;
  /** Der Fall braucht den Prüfstand (nur am Dev-Server erreichbar, nicht im gebauten Stand `vite preview`). */
  nurDevServer?: boolean;
  geraete: { name: string; width: number; height: number; art: 'desktop' | 'handy'; scrollt: boolean }[];
}

const FAELLE: Fall[] = [
  {
    name: 'konflikte-editor',
    titel: 'Konflikte im Spielplan',
    tasten: ['Automatisch beheben', 'Verstanden'],
    hatKreuz: true,
    oeffne: async (page, seed) => {
      await seed({ tournaments: [turnierMitKonflikten()] });
      await page.goto(`/#/tournament/${ID}/schedule`);
      await page.getByTestId('schedule-view-grid').click();
      await page.getByRole('button', { name: 'Spielplan bearbeiten' }).click();
      await page.getByRole('button', { name: /Fehler \/ / }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(600);
    },
    geraete: [
      { name: 'laptop-1280x720', width: 1280, height: 720, art: 'desktop', scrollt: true },
      { name: 'handy-360x640', width: 360, height: 640, art: 'handy', scrollt: true },
    ],
  },
  {
    name: 'spielplan-filter',
    titel: 'Filter',
    tasten: ['Zurücksetzen', 'Anwenden'],
    hatKreuz: false,
    oeffne: async (page, seed) => {
      await seed({ tournaments: [buildVisualTournament({ id: ID, title: 'Nordstadt Hallencup' })] });
      await page.goto(`/#/tournament/${ID}/schedule`);
      await page.getByTestId('schedule-filter-bar-mobile-button').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(600);
    },
    geraete: [
      { name: 'handy-360x640', width: 360, height: 640, art: 'handy', scrollt: false },
      { name: 'handy-360x420', width: 360, height: 420, art: 'handy', scrollt: true },
    ],
  },
  {
    name: 'abmelden-offene-aenderungen',
    titel: '3 Einträge noch nicht übertragen',
    tasten: ['Abbrechen', 'Trotzdem abmelden'],
    hatKreuz: true,
    nurDevServer: true,
    oeffne: async (page) => {
      await page.goto('/tests/e2e/harness/logout-warning.html?count=3');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(600);
    },
    geraete: [
      { name: 'laptop-1280x720', width: 1280, height: 720, art: 'desktop', scrollt: false },
      { name: 'laptop-1280x330', width: 1280, height: 330, art: 'desktop', scrollt: true },
      { name: 'handy-360x640', width: 360, height: 640, art: 'handy', scrollt: false },
    ],
  },
];

interface Box { top: number; bottom: number; left: number; right: number }
interface Stand {
  fenster: { w: number; h: number };
  titel: Box;
  kreuz: Box | null;
  flaeche: Box;
  tasten: { label: string; box: Box; zeilen: number }[];
  scroller: { gefunden: boolean; scrollTop: number; ueberlauf: number };
  inhaltOben: number;
}

/** Ort von Titel, Kreuz und Tasten (nach Beschriftung); das tatsächlich scrollende Element im Dialog (falls eines überläuft). */
const messe = (page: Page, titel: string, tasten: string[], hatKreuz: boolean): Promise<Stand> =>
  page.evaluate(({ titel: t, tasten: labels, hatKreuz: kreuz }) => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) {throw new Error('kein Dialog');}
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const kopf = [...dialog.querySelectorAll('h2')].find((h) => (h.textContent ?? '').includes(t));
    if (!kopf) {throw new Error(`Titel „${t}“ fehlt`);}
    const alleTasten = [...dialog.querySelectorAll<HTMLElement>('button')];
    const finde = (label: string) => {
      const treffer = alleTasten.filter((b) => (b.textContent ?? '').trim().startsWith(label));
      if (treffer.length === 0) {throw new Error(`Taste „${label}“ fehlt`);}
      return treffer[treffer.length - 1];
    };
    const zeilen = (el: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top));
      return tops.length === 0 ? 1 : Math.max(...tops) - Math.min(...tops) < 6 ? 1 : 2;
    };
    const scroller = [dialog, ...dialog.querySelectorAll<HTMLElement>('*')].find(
      (e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1,
    );
    finde(labels[0]);
    // „Inhalt“: erstes Kind des scrollenden Elements (bewegt sich beim Scrollen), sonst erster Absatz
    const inhalt = scroller?.firstElementChild ?? dialog.querySelector('p');
    return {
      fenster: { w: window.innerWidth, h: window.innerHeight },
      titel: box(kopf),
      kreuz: kreuz ? box(dialog.querySelector('button[aria-label="Schließen"]')!) : null,
      flaeche: box(dialog),
      tasten: labels.map((l) => { const b = finde(l); return { label: l, box: box(b), zeilen: zeilen(b) }; }),
      scroller: { gefunden: !!scroller, scrollTop: scroller?.scrollTop ?? 0, ueberlauf: scroller ? scroller.scrollHeight - scroller.clientHeight : 0 },
      inhaltOben: inhalt ? inhalt.getBoundingClientRect().top : 0,
    };
  }, { titel, tasten, hatKreuz });

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
  const ordner = process.env.DA2A_BILDER ?? testInfo.outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${process.env.DA2A_PHASE ?? 'lauf'}-${name}.png`) });
}

test.describe('DA-2a @OB-061/@OB-062 Turniertag-Dialoge: Tasten im festen Fuß, Kopf und Fuß bleiben stehen', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  // CI fährt gegen `vite preview` (CI_E2E_USE_PREVIEW): dort fehlt der Prüfstand (er gehört nicht in den Build) und die SPA-Rückfallseite
  // antwortet. Die Abmelde-Fälle laufen deshalb nur am Dev-Server; am echten Weg prüft der Cloud-Test `abmelden-geraete`
  // (Helfer `logoutViaUiConfirmingWarning`) Kopf, Fuß und Haupttaste.
  const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;
  const SKIP_GRUND = 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden); echter Weg: tests/e2e/cloud abmelden-geraete';

  for (const fall of FAELLE) {
    for (const g of fall.geraete) {
      for (const thema of ['light', 'dark'] as const) {
        test(`${fall.name}, ${g.name}, ${thema}: Titel${fall.hatKreuz ? ', Kreuz' : ''} und Haupttaste „${fall.tasten.at(-1)}“ sichtbar, Haupttaste zuletzt, beim Scrollen bewegt sich nur der Inhalt`, async ({ page, seedIndexedDB }, testInfo) => {
          test.skip(!!fall.nurDevServer && imGebautenStand, SKIP_GRUND);
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await fall.oeffne(page, seedIndexedDB);

          await bild(page, testInfo, `${fall.name}-${g.name}-${thema}-geoeffnet`);
          const offen = await messe(page, fall.titel, fall.tasten, fall.hatKreuz);
          const haupt = offen.tasten[offen.tasten.length - 1];

          // @OB-062 Dann: ohne zu scrollen Titel, (Kreuz) und Haupttaste im Fenster, nicht von der Fläche abgeschnitten
          expect(imFenster(offen.titel, offen.fenster), `Titel im Fenster: ${JSON.stringify(offen.titel)}`).toBe(true);
          if (offen.kreuz) {expect(imFenster(offen.kreuz, offen.fenster), `Kreuz im Fenster: ${JSON.stringify(offen.kreuz)}`).toBe(true);}
          expect(imFenster(haupt.box, offen.fenster), `Haupttaste im Fenster (Fensterhöhe ${offen.fenster.h}): ${JSON.stringify(haupt.box)}`).toBe(true);
          expect(haupt.box.bottom, `Haupttaste innerhalb der Fläche (Fläche unten ${offen.flaeche.bottom})`).toBeLessThanOrEqual(offen.flaeche.bottom);

          // @OB-061 Haupttaste unten bzw. rechts, nach allen anderen Tasten; Beschriftung steht in einer Zeile
          for (let i = 0; i < offen.tasten.length - 1; i++) {
            const davor = offen.tasten[i];
            const unter = haupt.box.top >= davor.box.bottom - 1;
            const rechts = haupt.box.left >= davor.box.right - 1 && haupt.box.top >= davor.box.top - 1;
            expect(unter || rechts, `„${haupt.label}“ steht unten/rechts von „${davor.label}“: ${JSON.stringify([davor.box, haupt.box])}`).toBe(true);
          }
          for (const t of offen.tasten) {expect(t.zeilen, `Beschriftung „${t.label}“ einzeilig`).toBe(1);}

          if (!g.scrollt) {return;}
          // Gegeben: der Inhalt ist höher als der freie Platz (sonst gilt das Szenario nicht)
          expect(offen.scroller.gefunden, 'Inhalt ist höher als der freie Platz').toBe(true);
          await scrolleGanzNachUnten(page);
          await bild(page, testInfo, `${fall.name}-${g.name}-${thema}-ganz-unten`);
          const unten = await messe(page, fall.titel, fall.tasten, fall.hatKreuz);
          expect(unten.scroller.scrollTop, 'der Inhalt hat sich bewegt').toBeGreaterThan(0);
          expect(unten.inhaltOben, 'Inhalt oberhalb der Tasten hat sich bewegt').not.toBeCloseTo(offen.inhaltOben, 0);
          const stehen: [string, Box, Box][] = [['Titel', offen.titel, unten.titel], ...(offen.kreuz && unten.kreuz ? [['Kreuz', offen.kreuz, unten.kreuz] as [string, Box, Box]] : []),
            ...offen.tasten.map((t, i): [string, Box, Box] => [`Taste ${t.label}`, t.box, unten.tasten[i].box])];
          for (const [name, vorher, nachher] of stehen) {
            expect(nachher.top, `${name} bleibt oben stehen`).toBeCloseTo(vorher.top, 0);
            expect(nachher.bottom, `${name} bleibt unten stehen`).toBeCloseTo(vorher.bottom, 0);
          }
          const hauptUnten = unten.tasten[unten.tasten.length - 1].box;
          expect(imFenster(hauptUnten, unten.fenster), 'Haupttaste nach dem Scrollen vollständig sichtbar').toBe(true);
          expect(hauptUnten.bottom).toBeLessThanOrEqual(unten.flaeche.bottom);
        });
      }

      test(`${fall.name}, ${g.name}: visual:metrics-Messung primaer.sichtbar und touch.primaer am geöffneten Dialog (HART = 0 Befunde)`, async ({ page, seedIndexedDB }) => {
        test.skip(!!fall.nurDevServer && imGebautenStand, SKIP_GRUND);
        await page.setViewportSize({ width: g.width, height: g.height });
        await fall.oeffne(page, seedIndexedDB);
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
  }

  test('Abmelden: „Abbrechen“ meldet nur Abbrechen, „Trotzdem abmelden“ nur Bestätigen (Gegenbeispiel Abbrechen schließt ohne Aktion)', async ({ page }) => {
    test.skip(imGebautenStand, SKIP_GRUND);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/tests/e2e/harness/logout-warning.html?count=3');
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    expect(await page.evaluate(() => (window as unknown as { __logoutProbe: unknown }).__logoutProbe)).toEqual({ cancel: 1, confirm: 0 });
    await page.getByRole('button', { name: 'Trotzdem abmelden' }).click();
    expect(await page.evaluate(() => (window as unknown as { __logoutProbe: unknown }).__logoutProbe)).toEqual({ cancel: 1, confirm: 1 });
  });
});
