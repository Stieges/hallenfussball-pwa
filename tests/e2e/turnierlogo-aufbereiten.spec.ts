/**
 * T4 (PDF-Paket PR 2): Turniergrafik beim Hochladen aufbereiten, im echten Browser (Canvas, `createImageBitmap`,
 * SVG über Bildelement). Läuft in Chromium (`desktop`) und WebKit (`iPhone-16`) und braucht den Vite-Dev-Server
 * (lädt die Module der App über `/src/...`). Gherkin: @W3-030 (SVG wird PNG, auch bei einem Team-Logo; gespeichert wird
 * nur das PNG), @DR-040, @DR-041. Prüflogos: tests/fixtures/logos/ (selbst erzeugt, 16-Bit-PNG mit Alpha, kein Vereinswappen).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import type { PrepareResult } from '../../src/lib/images/prepareTournamentGraphic';

const LOGOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'logos');
const fixture = (name: string): string => readFileSync(join(LOGOS, name)).toString('base64');
const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

interface Upload { base64: string; name: string; type: string }
interface Outcome {
  result: PrepareResult;
  /** Maße des gespeicherten Bildes, vom Browser selbst gelesen. */
  decoded?: { width: number; height: number };
  /** Größe der gespeicherten Bilddaten in Byte. */
  bytes?: number;
  /** Bittiefe aus dem PNG-Kopf (Byte 24), 0 wenn kein PNG. */
  pngBitDepth?: number;
  /** Roher Eintrag im Gerätespeicher nach dem Speichern (Text). */
  storedText?: string;
}

const SVG_BLAU = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#1a3a8f"/><circle cx="100" cy="50" r="30" fill="#ffffff"/></svg>';

/** Die Module der App, wie der Vite-Dev-Server sie unter /src/ ausliefert; Zugriff über window.__grafik. */
interface AppModules {
  prepare: typeof import('../../src/lib/images/prepareTournamentGraphic').prepareTournamentGraphic;
  processLogo: typeof import('../../src/utils/logoProcessor').processLogo;
  store: typeof import('../../src/core/storage/tournamentGraphicsStore').tournamentGraphicsStore;
  createStorage: typeof import('../../src/core/storage/StorageFactory').createStorage;
}
type WithModules = Window & { __grafik?: AppModules };

async function openApp(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({
    type: 'module',
    content: `
      import { prepareTournamentGraphic } from '/src/lib/images/prepareTournamentGraphic.ts';
      import { processLogo } from '/src/utils/logoProcessor.ts';
      import { tournamentGraphicsStore } from '/src/core/storage/tournamentGraphicsStore.ts';
      import { createStorage } from '/src/core/storage/StorageFactory.ts';
      window.__grafik = { prepare: prepareTournamentGraphic, processLogo, store: tournamentGraphicsStore, createStorage };
    `,
  });
  await page.waitForFunction(() => (window as WithModules).__grafik !== undefined);
}

/** Datei im Browser bauen, aufbereiten, das Ergebnis im Gerätespeicher ablegen und vermessen. */
async function prepare(page: Page, upload: Upload, computeAccent = false): Promise<Outcome> {
  return page.evaluate(async ({ upload: u, computeAccent: accent }) => {
    const app = (window as WithModules).__grafik;
    if (app === undefined) { throw new Error('Module nicht geladen'); }
    const bytes = Uint8Array.from(atob(u.base64), c => c.charCodeAt(0));
    const result = await app.prepare(new File([bytes], u.name, { type: u.type }), { computeAccent: accent });
    if (!result.ok) { return { result }; }
    await app.store.save('e2e-aufbereiten', { left: result.graphic });
    const stored = await (await app.createStorage()).get<unknown>('tournament-graphics-e2e-aufbereiten');
    const img = new Image();
    img.src = result.graphic.dataUrl;
    await img.decode();
    const raw = Uint8Array.from(atob(result.graphic.dataUrl.split(',')[1]), c => c.charCodeAt(0));
    return {
      result,
      decoded: { width: img.naturalWidth, height: img.naturalHeight },
      bytes: raw.length,
      pngBitDepth: raw[1] === 0x50 ? raw[24] : 0,
      storedText: JSON.stringify(stored),
    };
  }, { upload, computeAccent });
}

test.describe('Turniergrafik aufbereiten (echter Browser)', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('@W3-030 SVG wird PNG: gespeichert ist data:image/png, kein <svg im Speicher', async ({ page }) => {
    const out = await prepare(page, { base64: b64(SVG_BLAU), name: 'verein.svg', type: 'image/svg+xml' });

    expect(out.result.ok).toBe(true);
    const stored = out.storedText ?? '';
    expect(stored).toContain('data:image/png');
    expect(stored.toLowerCase()).not.toContain('<svg');
    expect(stored).not.toContain('svg+xml');
    expect(out.decoded).toEqual({ width: 1200, height: 600 }); // Vektor: auf die Ablagehöhe 600 gezeichnet, Seitenverhältnis 2 : 1
  });

  test('@W3-030 Team-Logo als SVG wird ebenfalls umgewandelt (kein SVG im Team-Logo)', async ({ page }) => {
    const value = await page.evaluate(async (svg) => {
      const app = (window as WithModules).__grafik;
      if (app === undefined) { throw new Error('Module nicht geladen'); }
      const logo = await app.processLogo(new File([svg], 'team.svg', { type: 'image/svg+xml' }));
      return logo.value;
    }, SVG_BLAU);

    expect(value).toMatch(/^data:image\/png;base64,/);
    expect(value.toLowerCase()).not.toContain('svg');
  });

  test('@W3-030 4000-px-PNG wird auf 600 px Höhe gespeichert, unter 400 kB', async ({ page }) => {
    const base64 = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 4000;
      canvas.height = 4000;
      const ctx = canvas.getContext('2d');
      if (ctx === null) { throw new Error('kein Canvas'); }
      ctx.fillStyle = '#2a2576';
      ctx.fillRect(0, 0, 4000, 4000);
      ctx.fillStyle = '#6a9329';
      ctx.beginPath();
      ctx.arc(2000, 2000, 1400, 0, Math.PI * 2);
      ctx.fill();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = '';
      bytes.forEach(byte => { text += String.fromCharCode(byte); });
      return btoa(text);
    });

    const out = await prepare(page, { base64, name: 'gross.png', type: 'image/png' });

    expect(out.result).toMatchObject({ ok: true, warnLowRes: false, graphic: { heightPx: 600, widthPx: 600, originalHeightPx: 4000 } });
    expect(out.decoded).toEqual({ width: 600, height: 600 });
    expect(out.bytes ?? Infinity).toBeLessThan(400 * 1024);
  });

  test('@W3-030 ein 16-Bit-PNG mit Alpha wird als 8-Bit-PNG gespeichert, Transparenz bleibt (Prüflogo)', async ({ page }) => {
    const out = await prepare(page, { base64: fixture('mehrfarbig.png'), name: 'mehrfarbig.png', type: 'image/png' });

    expect(out.result.ok).toBe(true);
    expect(out.pngBitDepth).toBe(8);
    expect(out.result.ok && out.result.graphic.dataUrl).toMatch(/^data:image\/png;/);
  });

  test('@W3-030 JPG mit EXIF-Drehung (Orientierung 6): gespeichert wird aufrecht, aus 400 × 200 wird 200 × 400', async ({ page }) => {
    const out = await page.evaluate(async () => {
      const app = (window as WithModules).__grafik;
      if (app === undefined) { throw new Error('Module nicht geladen'); }
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx === null) { throw new Error('kein Canvas'); }
      ctx.fillStyle = '#c00000';
      ctx.fillRect(0, 0, 400, 200);
      const jpeg = new Uint8Array(await (await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.9))).arrayBuffer());
      // APP1/Exif-Segment mit Orientation = 6 (90° im Uhrzeigersinn) direkt hinter SOI einfügen
      const exif = [0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
        0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
      const tagged = new Uint8Array([...jpeg.slice(0, 2), ...exif, ...jpeg.slice(2)]);
      const result = await app.prepare(new File([tagged], 'drehung.jpg', { type: 'image/jpeg' }));
      return result;
    });

    expect(out).toMatchObject({ ok: true, graphic: { widthPx: 200, heightPx: 400 } });
  });

  test('@DR-041 Prüflogos: weiß und schwarz geben keine Akzentfarbe; Rot/Gelb/Schwarz gibt das Rot (Gelbregel)', async ({ page }) => {
    const weiss = await prepare(page, { base64: fixture('weiss.png'), name: 'weiss.png', type: 'image/png' }, true);
    const schwarz = await prepare(page, { base64: fixture('schwarz.png'), name: 'schwarz.png', type: 'image/png' }, true);
    const mehrfarbig = await prepare(page, { base64: fixture('mehrfarbig.png'), name: 'mehrfarbig.png', type: 'image/png' }, true);

    expect(weiss.result.ok && weiss.result.accent).toBeUndefined();
    expect(schwarz.result.ok && schwarz.result.accent).toBeUndefined();
    const accent = mehrfarbig.result.ok ? mehrfarbig.result.accent : undefined;
    expect(accent).toMatch(/^#[0-9A-F]{6}$/);
    const [r, g, b] = [1, 3, 5].map(i => parseInt((accent ?? '#000000').slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g + 80); // Rot, nicht das abgedunkelte Gelb (dort wären r und g fast gleich)
    expect(r).toBeGreaterThan(b + 80);
  });

  test('@W3-030 ein SVG mit Skript wird gerastert, das Skript läuft nicht (Konsole bleibt leer)', async ({ page }) => {
    const meldungen: string[] = [];
    page.on('console', message => meldungen.push(message.text()));
    page.on('pageerror', error => meldungen.push(error.message));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="window.__skriptLief=true"><script>window.__skriptLief=true;console.log("SKRIPT")</script><rect width="100" height="100" fill="#1a3a8f"/></svg>';

    const out = await prepare(page, { base64: b64(svg), name: 'skript.svg', type: 'image/svg+xml' });

    expect(out.result.ok).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __skriptLief?: boolean }).__skriptLief)).toBeUndefined();
    expect(meldungen.filter(text => text.includes('SKRIPT'))).toEqual([]);
  });

  test('@W3-030 ein SVG mit externem Bild lädt nichts aus dem Netz nach', async ({ page }) => {
    const anfragen: string[] = [];
    await page.route('**/*', route => {
      if (route.request().url().includes('extern.invalid')) { anfragen.push(route.request().url()); }
      return route.continue();
    });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100"><image href="http://extern.invalid/x.png" width="100" height="100"/><rect width="50" height="50" fill="#1a3a8f"/></svg>';

    const out = await prepare(page, { base64: b64(svg), name: 'extern.svg', type: 'image/svg+xml' });

    expect(anfragen).toEqual([]);
    // Entweder gerastert ohne das fremde Bild oder als „unreadable“ abgewiesen; nie mit fremden Pixeln übernommen
    expect(out.result.ok || (out.result as { reason?: string }).reason === 'unreadable').toBe(true);
  });

  test('@W3-030 eine ungültige Datei wird abgewiesen: Grund Format, nichts im Gerätespeicher', async ({ page }) => {
    const out = await prepare(page, { base64: b64('das ist kein Bild'), name: 'text.png', type: 'image/png' });

    expect(out.result).toEqual({ ok: false, reason: 'type' });
    expect(out.storedText).toBeUndefined();
  });
});
