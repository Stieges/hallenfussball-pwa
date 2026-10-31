/**
 * @ZM-151 Die Ergebniskästen auf dem Monitor springen nicht, wenn sich der Zustand des Spiels ändert.
 *
 * Gemessen wird die Bounding-Box beider Ergebniskästen der Live-Folie (`[data-testid="live-box-*"]`, der Ring ist
 * eine Outline und gehört nicht zur Box) in allen Zuständen, die der Monitor zeigen kann: läuft, Halbzeit-Phase, Verlängerung,
 * Strafstoßschießen läuft, Ende regulär, Ende nach Strafstoßschießen (nur eingetragen, K5g/K5g4) und Ende mit 50-Zeichen-Verlierer (K5g3).
 * Bei 1280×720 und 1920×1080 müssen alle Kästen auf ±1 px gleich liegen. Gegenbeispiel aus dem Szenario: Ende ohne Strafstoß = Ende mit Strafstoß.
 * „Vor dem Anpfiff“ zeigt der Monitor nie die Kästen (Folie „nächstes Spiel“); die Kästen im Zustand „wartet“ deckt der RTL-Test
 * `LiveScoreGrid.zm151.test.tsx` ab. Saat `hallencup-messlauf` (Finale läuft 2:1) und die Phasen-Turniere der Saat; Läuft nur im Projekt `desktop`.
 * Bilder: A36C_BILDER (Vorsatz A36C_PHASE).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.A36C_BILDER;
const PHASE = process.env.A36C_PHASE ?? 'nachher';
const FINALE = '00000003-0000-4000-8000-000000000016';
const GROESSEN = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }];

interface Box { l: number; t: number; w: number; h: number }
interface Kaesten { home: Box; away: Box }

/** Saat mit dem Monitor `mon-live` auch in den Phasen-Turnieren (dort gibt es von Haus aus keinen Monitor). */
function saatMitMonitoren() {
  const saat = leseSaat('hallencup-messlauf');
  const turniere = saat.datenbanken[0].eintraege.tournaments as Array<{ id: string; monitors?: unknown[] }>;
  const monitore = turniere.find((t) => t.id === 'hallencup-messlauf')?.monitors ?? [];
  for (const t of turniere) { if (t.id.startsWith('hallencup-phase-')) { t.monitors = monitore; } }
  return saat;
}

async function oeffne(page: Page, groesse: { width: number; height: number }, turnierId: string) {
  await page.setViewportSize(groesse);
  await installiereSaat(page.context(), saatMitMonitoren());
  await page.goto(`/#/display/${turnierId}/mon-live`);
  await expect(page.getByTestId('live-block-home')).toBeVisible({ timeout: 25000 });
}

/** Das Finale wird beendet, ohne einzelne Tore oder Schüsse: nur das Ergebnis steht im Turnier (wie nach Papier-Leitung). */
async function beendeFinale(page: Page, werte: { scoreA: number; scoreB: number; penaltyScoreA?: number; penaltyScoreB?: number; decidedBy: string }) {
  await page.evaluate(({ id, w }) => new Promise<void>((fertig, fehler) => {
    const auf = indexedDB.open('hallenfussball', 1);
    auf.onerror = () => fehler(new Error('IndexedDB'));
    auf.onsuccess = () => {
      const tx = auf.result.transaction('cache', 'readwrite');
      const speicher = tx.objectStore('cache');
      const lesen = speicher.get('tournaments');
      lesen.onsuccess = () => {
        const eintrag = lesen.result as { key: string; value: Array<{ id: string; matches: Array<Record<string, unknown>> }> };
        const spiel = eintrag.value.find((t) => t.id === 'hallencup-messlauf')?.matches.find((m) => m.id === id);
        if (!spiel) { fehler(new Error('Finale fehlt')); return; }
        Object.assign(spiel, { matchStatus: 'finished', timerStartTime: undefined, timerElapsedSeconds: 600, ...w });
        speicher.put(eintrag);
      };
      tx.oncomplete = () => fertig();
      tx.onerror = () => fehler(new Error('Schreiben'));
    };
  }), { id: FINALE, w: werte });
}

async function messeKaesten(page: Page): Promise<Kaesten> {
  return page.evaluate(() => {
    const r = (seite: string) => {
      const b = document.querySelector(`[data-testid="live-box-${seite}"]`)?.getBoundingClientRect();
      if (!b) { throw new Error(`Kasten ${seite} fehlt`); }
      return { l: b.left, t: b.top, w: b.width, h: b.height };
    };
    return { home: r('home'), away: r('away') };
  });
}

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${PHASE}-${name}.png`), fullPage: false });
}

const gleich = (a: Box, b: Box, was: string) => {
  for (const k of ['l', 't', 'w', 'h'] as const) {
    expect(Math.abs(a[k] - b[k]), `${was}: ${k} ${a[k].toFixed(1)} gegen ${b[k].toFixed(1)}`).toBeLessThanOrEqual(1);
  }
};

for (const groesse of GROESSEN) {
  test.describe(`@ZM-151 Ergebniskästen ${groesse.width}×${groesse.height}`, () => {
    test(`@ZM-151 die Kästen stehen in jedem Zustand gleich (läuft, Halbzeit-Phase, Verlängerung, Strafstoßschießen läuft, Ende regulär, Ende nach Strafstoß, K5g3)`, async ({ page }) => {
      test.setTimeout(300000);
      const zustaende: Array<{ name: string; vorbereiten: () => Promise<void>; turnier: string; warte: () => Promise<void> }> = [
        { name: 'laeuft', turnier: 'hallencup-messlauf', vorbereiten: async () => undefined, warte: async () => undefined },
        { name: 'halbzeit-phase', turnier: 'hallencup-phase-halbzeit', vorbereiten: async () => undefined, warte: async () => undefined },
        { name: 'verlaengerung', turnier: 'hallencup-phase-verlaengerung', vorbereiten: async () => undefined, warte: async () => undefined },
        { name: 'strafstoss-laeuft', turnier: 'hallencup-phase-strafstoss', vorbereiten: async () => undefined, warte: async () => undefined },
        {
          name: 'ende-regulaer', turnier: 'hallencup-messlauf',
          vorbereiten: () => beendeFinale(page, { scoreA: 3, scoreB: 1, decidedBy: 'regular' }),
          warte: () => expect(page.getByTestId('live-endstand')).toHaveText('Endstand', { timeout: 20000 }),
        },
        {
          name: 'ende-strafstoss', turnier: 'hallencup-messlauf',
          vorbereiten: () => beendeFinale(page, { scoreA: 2, scoreB: 2, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' }),
          warte: () => expect(page.getByTestId('live-penalty')).toHaveText('Strafstoßschießen 4 : 3', { timeout: 20000 }),
        },
        {
          name: 'ende-strafstoss-langer-verlierer', turnier: 'hallencup-messlauf',
          vorbereiten: () => beendeFinale(page, { scoreA: 2, scoreB: 2, penaltyScoreA: 3, penaltyScoreB: 4, decidedBy: 'penalty' }),
          warte: () => expect(page.getByTestId('live-penalty')).toHaveText('Strafstoßschießen 3 : 4', { timeout: 20000 }),
        },
      ];
      const gemessen: Record<string, Kaesten> = {};
      for (const z of zustaende) {
        await oeffne(page, groesse, z.turnier);
        await z.vorbereiten();
        await z.warte();
        gemessen[z.name] = await messeKaesten(page);
        const k = gemessen[z.name];
        test.info().annotations.push({ type: 'kasten', description: `${groesse.width} ${z.name}: links ${k.home.l.toFixed(1)}/${k.home.t.toFixed(1)} ${k.home.w.toFixed(1)}×${k.home.h.toFixed(1)}; rechts ${k.away.l.toFixed(1)}/${k.away.t.toFixed(1)} ${k.away.w.toFixed(1)}×${k.away.h.toFixed(1)}` });
        await bild(page, `zm151-${groesse.width}-${z.name}`);
      }
      const ziel = gemessen.laeuft;
      for (const [name, k] of Object.entries(gemessen)) {
        gleich(k.home, ziel.home, `${name} links`);
        gleich(k.away, ziel.away, `${name} rechts`);
      }
      // Gegenbeispiel aus dem Szenario: Ende ohne Strafstoßschießen = Ende mit Strafstoßschießen
      gleich(gemessen['ende-regulaer'].home, gemessen['ende-strafstoss'].home, 'Ende regulär gegen Ende nach Strafstoß links');
      gleich(gemessen['ende-regulaer'].away, gemessen['ende-strafstoss'].away, 'Ende regulär gegen Ende nach Strafstoß rechts');
      // Die Kästen liegen symmetrisch um die Mitte (Doppelpunkt), nicht nach links verschoben
      const mitte = groesse.width / 2;
      expect(Math.abs((ziel.home.l + ziel.away.l + ziel.away.w) / 2 - mitte)).toBeLessThanOrEqual(2);
    });
  });
}
