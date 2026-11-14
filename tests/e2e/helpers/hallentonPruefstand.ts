/**
 * Gemeinsame Hilfen der Prüfstand-Tests für „Hallenton“ (H4-9, H4-10): die Fenstergrößen, die HART-Messung von `npm run visual:metrics`
 * (die echte Messfunktion) und das Speichern der Bilder. Nur Testumgebung.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../../scripts/visual-metrics/browser-messung.mjs';

export const GERAETE = [
  { name: '360x640', width: 360, height: 640, art: 'handy', schmal: true },
  { name: '1280x720', width: 1280, height: 720, art: 'desktop', schmal: false },
] as const;

interface Grenzwert { id: string; typ: string; wert: unknown; geltung: string[]; typJeArt?: Record<string, string> }
const GW = JSON.parse(readFileSync(join(process.cwd(), 'scripts/visual-metrics/grenzwerte.json'), 'utf8')) as { grenzwerte: Grenzwert[] };

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

/** Die HART-Befunde der Messung (ohne die Anmelde-Tasten `auth-*`: sie gehören nicht zum Unterpunkt, ihr Befund steht im Bericht von H4-9). */
export async function hartBefunde(page: Page, art: string): Promise<string[]> {
  const { g, hart } = grenzen(art);
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const m: { befunde: { metrik: string; selektor: string; ist: string }[] } = await page.evaluate(messeSeite, {
    art, g, randPx: 0, monitorSchrift: null, ebuPruefen: false, extraInhalte: [],
    primarySelektor: '[data-primary], [data-variant="primary"]',
  });
  return m.befunde.filter((b) => hart.has(b.metrik) && !b.selektor.includes('data-testid="auth-')).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

/** Bild der ganzen Seite in den Ordner aus der Umgebungsvariable `umgebungsname`, sonst in die Testausgabe. */
export async function speichereBild(page: Page, outputDir: string, umgebungsname: string, name: string): Promise<void> {
  const ordner = process.env[umgebungsname] ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: true });
}
