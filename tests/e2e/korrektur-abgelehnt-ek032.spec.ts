/**
 * @EK-032 (T2-UI): der Korrekturdialog im Zustand „abgelehnt“ -- Olli hat Spiel 7 inzwischen auf 2:2 geändert, der Dialog bleibt offen,
 * zeigt den Hinweis mit Namen (InlineNotice `warn`) und 2:2 als bisher. Über den Prüfstand tests/e2e/harness/korrektur-abgelehnt.html (ECHTE
 * Komponente, Tokens, i18n, Hell/Dunkel): der Zustand entsteht im echten Ablauf erst nach einer Fremdänderung; den Ablauf selbst prüfen die
 * Komponententests (ScheduleTab.beendetSchnelleingabe, useKorrekturEinstieg.ek063, useScheduleResultEntry).
 * Je Fall: Hinweis vollständig (nichts abgeschnitten, kein waagerechtes Scrollen, auch mit sehr langen Teamnamen und bei 360 px), „bisher“ 2:2,
 * Tasten ≥ 44 px und die Messung von `npm run visual:metrics` (messeSeite) ohne HART-Befund. Bilder: Ordner aus EK032_BILDER (sonst Testausgabe).
 * Läuft nur im Projekt `desktop` am Dev-Server (setzt Fenster selbst).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const GERAETE = [
  { name: '1280x720', width: 1280, height: 720, art: 'desktop' },
  { name: '360x640', width: 360, height: 640, art: 'handy' },
] as const;

const FAELLE = [
  { name: 'olli', query: '', text: 'Spiel 7 wurde inzwischen von Olli geändert (jetzt 2:2)', sprache: 'de' },
  { name: 'ohne-name', query: '?name=', text: 'Spiel 7 wurde inzwischen geändert (jetzt 2:2)', sprache: 'de' },
  { name: 'lange-namen', query: '?lang=1', text: 'Spiel 7 wurde inzwischen von Olli geändert (jetzt 2:2)', sprache: 'de' },
  { name: 'englisch', query: '?sprache=en', text: 'Match 7 was changed by Olli in the meantime (now 2:2)', sprache: 'en' },
] as const;

interface Grenzwert { id: string; typ: string; wert: unknown; geltung: string[]; typJeArt?: Record<string, string> }
const GW = JSON.parse(readFileSync(join(process.cwd(), 'scripts/visual-metrics/grenzwerte.json'), 'utf8')) as { grenzwerte: Grenzwert[] };

/** Grenzwerte wie `grenzenFuer` in messen.mjs (App-Modus, ohne Monitor/Langtext/Gates) und die Liste der HART-Metriken. */
function grenzen(art: string): { g: Record<string, unknown>; hart: Set<string> } {
  const g: Record<string, unknown> = {};
  const hart = new Set<string>();
  for (const e of GW.grenzwerte) {
    if (!e.geltung.includes(art) || e.id.startsWith('gate.') || e.id.startsWith('langtext.') || e.id.startsWith('monitor.') || e.id.startsWith('overscan.')) {continue;}
    g[e.id] = e.wert;
    if ((e.typJeArt?.[art] ?? e.typ) === 'HART') {hart.add(e.id);}
  }
  return { g, hart };
}

async function hartBefunde(page: Page, art: string): Promise<string[]> {
  const { g, hart } = grenzen(art);
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const m: { befunde: { metrik: string; selektor: string; ist: string }[] } = await page.evaluate(messeSeite, {
    art, g, randPx: 0, monitorSchrift: null, ebuPruefen: false, extraInhalte: [],
    primarySelektor: '[data-primary], [data-variant="primary"]',
  });
  // „Weiter“ ist hier gesperrt (neuer Stand = bisher, „mustDiffer“): gesperrte Bedienelemente sind vom Kontrast ausgenommen (WCAG 1.4.3)
  return m.befunde.filter((b) => hart.has(b.metrik) && !(b.metrik === 'kontrast.text' && b.selektor.includes('cockpit-korrektur-weiter'))).map((b) => `${b.metrik} ${b.selektor}`);
}

test.describe('@EK-032 Korrekturdialog nach Ablehnung wegen Fremdänderung: Darstellung (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      for (const fall of FAELLE) {
        test(`@EK-032 ${g.name}, ${thema}, ${fall.name}: Hinweis vollständig, bisher 2:2, Tasten ≥ 44 px, kein HART-Befund`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/korrektur-abgelehnt.html${fall.query}`);
          const dialog = page.getByTestId('cockpit-korrektur-dialog');
          await expect(dialog).toBeVisible();
          const hinweis = page.getByTestId('cockpit-korrektur-stale');
          await expect(hinweis).toHaveText(fall.text);
          await expect(hinweis).toHaveAttribute('data-tone', 'warn');
          await expect(dialog).toContainText(fall.sprache === 'de' ? 'Aktuelles Ergebnis' : 'Current Result');
          await expect(dialog).toContainText(' 2:2 ');
          await expect(dialog).not.toContainText('2:1');

          // Nichts abgeschnitten oder übergelaufen, kein waagerechtes Scrollen der Seite
          const ueberlauf = await hinweis.evaluate((el) => [el, ...Array.from(el.querySelectorAll('*'))].map((k) => ({ breit: k.scrollWidth - k.clientWidth, hoch: k.scrollHeight - k.clientHeight })));
          for (const u of ueberlauf) {
            expect(u.breit, 'kein waagerechter Überlauf im Hinweis').toBeLessThanOrEqual(1);
            expect(u.hoch, 'kein senkrechter Überlauf im Hinweis').toBeLessThanOrEqual(1);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          for (const id of ['cockpit-korrektur-cancel', 'cockpit-korrektur-weiter']) {
            const box = await page.getByTestId(id).boundingBox();
            expect(box?.height ?? 0, `${id} mindestens 44 px hoch`).toBeGreaterThanOrEqual(44);
          }

          expect(await hartBefunde(page, g.art), 'kein HART-Befund').toEqual([]);
          const ordner = process.env.EK032_BILDER ?? testInfo.outputDir;
          mkdirSync(ordner, { recursive: true });
          await page.screenshot({ path: join(ordner, `ek032-${g.name}-${thema}-${fall.name}.png`), fullPage: true });
        });
      }
    }
  }
});
