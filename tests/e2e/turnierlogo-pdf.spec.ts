/**
 * T5 (PDF-Paket PR 2): Turnierlogo und zweite Grafik im Assistenten, Schritt 1 „Stammdaten“ – im echten Browser, über die
 * Oberfläche (`setInputFiles`), im GEBAUTEN Stand (Vorschau von dist/, Vor-Push und CI). Löst die frühere Dev-Server-Spec
 * `turnierlogo-aufbereiten.spec.ts` ab: deren Fälle laufen hier über das Dateifeld statt über Module unter /src/.
 *
 * Gherkin: @W3-030 (SVG wird PNG, auch beim Team-Logo; Grund bei abgelehnter Datei; ungültige Datei lässt das Logo stehen),
 * @W3-040 (Logo und Tupfer, Tupfer nicht antippbar, nach dem Autosave neu laden, weiter ohne Logo), @DR-040 (Warnung unter
 * 236 Bildpunkten), @DR-041 (Akzentfarbe aus dem Logo; weiß/schwarz → Grün der App). Prüflogos: tests/fixtures/logos/
 * (selbst erzeugt, kein Vereinswappen).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { t } from './helpers/i18n';

const LOGOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'logos');
const fixture = (name: string): Buffer => readFileSync(join(LOGOS, name));
const GRUEN_APP = '#047857'; // printAccent.fallback (palette.emerald[700])
const HEX = /^#[0-9A-F]{6}$/i;

const SVG_BLAU = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#1a3a8f"/><circle cx="100" cy="50" r="30" fill="#ffffff"/></svg>';
const svgDatei = (svg: string, name = 'verein.svg') => ({ name, mimeType: 'image/svg+xml', buffer: Buffer.from(svg, 'utf8') });
const pngDatei = (buffer: Buffer, name = 'wappen.png') => ({ name, mimeType: 'image/png', buffer });

interface StoredGraphic { dataUrl: string; widthPx: number; heightPx: number; originalHeightPx: number }
interface StoredGraphics { left?: StoredGraphic; right?: StoredGraphic; accent?: string }

/** Einträge `tournament-graphics-<id>` aus dem Gerätespeicher (IndexedDB der App). */
async function storedGraphics(page: Page): Promise<Array<{ key: string; value: StoredGraphics }>> {
  return page.evaluate(() => new Promise<Array<{ key: string; value: StoredGraphics }>>((resolve, reject) => {
    const open = indexedDB.open('hallenfussball', 1);
    open.onerror = () => reject(new Error('IndexedDB nicht lesbar'));
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('cache')) { db.close(); resolve([]); return; }
      const request = db.transaction('cache', 'readonly').objectStore('cache').getAll();
      request.onerror = () => { db.close(); reject(new Error('getAll fehlgeschlagen')); };
      request.onsuccess = () => {
        db.close();
        resolve((request.result as Array<{ key: string; value: StoredGraphics }>).filter(entry => entry.key.startsWith('tournament-graphics-')));
      };
    };
  }));
}

/** Das Turnier des Entwurfs mit diesem Namen aus dem Gerätespeicher (Autosave); `undefined`, solange es nicht dort steht. */
async function savedDraftId(page: Page, title: string): Promise<string | undefined> {
  return page.evaluate((name) => new Promise<string | undefined>((resolve, reject) => {
    const open = indexedDB.open('hallenfussball', 1);
    open.onerror = () => reject(new Error('IndexedDB nicht lesbar'));
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('cache')) { db.close(); resolve(undefined); return; }
      const request = db.transaction('cache', 'readonly').objectStore('cache').get('tournaments');
      request.onerror = () => { db.close(); reject(new Error('get fehlgeschlagen')); };
      request.onsuccess = () => {
        db.close();
        const list = (request.result as { value?: Array<{ id: string; title?: string }> } | undefined)?.value ?? [];
        resolve(list.find(entry => entry.title === name)?.id);
      };
    };
  }), title);
}

/** Ein Bild im Browser zeichnen (Canvas) und als Datei-Bytes zurückgeben: zwei Farben, Kreis in der Mitte. */
async function zeichne(page: Page, width: number, height: number, mime: 'image/png' | 'image/jpeg', farben: [string, string] = ['#2a2576', '#6a9329']): Promise<Buffer> {
  const base64 = await page.evaluate(async ({ w, h, type, colors }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx === null) { throw new Error('kein Canvas'); }
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.35, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), type, 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let text = '';
    bytes.forEach(byte => { text += String.fromCharCode(byte); });
    return btoa(text);
  }, { w: width, h: height, type: mime, colors: farben });
  return Buffer.from(base64, 'base64');
}

const tupfer = (page: Page) => page.getByTestId('akzent-tupfer');
const nameFeld = (page: Page) => page.locator('input[placeholder*="Hallencup"]').first();

/** Das gespeicherte Bild so, wie der Browser es sieht (Maße, Bytes). */
async function vermesse(page: Page, dataUrl: string): Promise<{ width: number; height: number; bytes: number; bitDepth: number }> {
  return page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const raw = Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
    return { width: img.naturalWidth, height: img.naturalHeight, bytes: raw.length, bitDepth: raw[1] === 0x50 ? raw[24] : 0 };
  }, dataUrl);
}

test.describe('Turnierlogo im Assistenten (gebauter Stand)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/tournament/new');
    await expect(page.getByRole('heading', { name: t('wizard:step3.title') })).toBeVisible();
    await expect(page.getByTestId('turnierlogo-feld')).toBeVisible();
  });

  test('@W3-030 SVG wird PNG: gespeichert ist data:image/png, kein <svg im Speicher, der Tupfer zeigt eine Farbe aus dem Logo', async ({ page }) => {
    await page.getByTestId('turnierlogo-datei').setInputFiles(svgDatei(SVG_BLAU));

    await expect(page.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', /^data:image\/png/);
    await expect.poll(async () => (await storedGraphics(page)).length).toBe(1);
    const [eintrag] = await storedGraphics(page);
    const text = JSON.stringify(eintrag.value);
    expect(text).toContain('data:image/png');
    expect(text.toLowerCase()).not.toContain('<svg');
    expect(text).not.toContain('svg+xml');
    expect(await vermesse(page, eintrag.value.left?.dataUrl ?? '')).toMatchObject({ width: 1200, height: 600 }); // Vektor: auf die Ablagehöhe 600 gezeichnet, 2 : 1
    await expect(tupfer(page)).toHaveAttribute('data-accent', HEX);
    await expect(tupfer(page)).not.toHaveAttribute('data-accent', GRUEN_APP);
  });

  test('@W3-030 ein SVG mit Skript wird gerastert, das Skript läuft nicht (Konsole bleibt leer)', async ({ page }) => {
    const meldungen: string[] = [];
    page.on('console', message => meldungen.push(message.text()));
    page.on('pageerror', error => meldungen.push(error.message));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="window.__skriptLief=true"><script>window.__skriptLief=true;console.log("SKRIPT")</script><rect width="100" height="100" fill="#1a3a8f"/></svg>';

    await page.getByTestId('turnierlogo-datei').setInputFiles(svgDatei(svg, 'skript.svg'));

    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
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

    await page.getByTestId('turnierlogo-datei').setInputFiles(svgDatei(svg, 'extern.svg'));

    // Entweder gerastert ohne das fremde Bild oder als „nicht lesbar“ abgewiesen; nie mit fremden Pixeln übernommen
    await expect(page.getByTestId('turnierlogo-vorschau').or(page.getByTestId('turnierlogo-fehler'))).toBeVisible();
    expect(anfragen).toEqual([]);
  });

  test('@W3-030 4000-px-PNG wird auf 600 px Höhe gespeichert, unter 400 kB', async ({ page }) => {
    await page.getByTestId('turnierlogo-datei').setInputFiles(pngDatei(await zeichne(page, 4000, 4000, 'image/png'), 'gross.png'));

    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    await expect(page.getByTestId('turnierlogo-warnung')).toHaveCount(0); // Warnung aus der Originalhöhe (4000), nicht aus der Ablage
    await expect.poll(async () => (await storedGraphics(page)).length).toBe(1);
    const left = (await storedGraphics(page))[0].value.left;
    expect(left).toMatchObject({ heightPx: 600, widthPx: 600, originalHeightPx: 4000 });
    const gemessen = await vermesse(page, left?.dataUrl ?? '');
    expect(gemessen).toMatchObject({ width: 600, height: 600 });
    expect(gemessen.bytes).toBeLessThan(400 * 1024);
  });

  test('@W3-030 ein 16-Bit-PNG mit Alpha wird als 8-Bit-PNG gespeichert (Prüflogo)', async ({ page }) => {
    await page.getByTestId('turnierlogo-datei').setInputFiles(pngDatei(fixture('mehrfarbig.png'), 'mehrfarbig.png'));

    await expect(page.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', /^data:image\/png;/);
    await expect.poll(async () => (await storedGraphics(page)).length).toBe(1);
    const dataUrl = (await storedGraphics(page))[0].value.left?.dataUrl ?? '';
    expect((await vermesse(page, dataUrl)).bitDepth).toBe(8);
  });

  test('@W3-030 JPG mit EXIF-Drehung (Orientierung 6): gespeichert wird aufrecht, aus 400 × 200 wird 200 × 400', async ({ page }) => {
    const jpeg = await zeichne(page, 400, 200, 'image/jpeg', ['#c00000', '#ffffff']);
    // APP1/Exif-Segment mit Orientation = 6 (90° im Uhrzeigersinn) direkt hinter SOI einfügen
    const exif = Buffer.from([0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
      0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const gedreht = Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);

    await page.getByTestId('turnierlogo-datei').setInputFiles({ name: 'drehung.jpg', mimeType: 'image/jpeg', buffer: gedreht });

    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    await expect.poll(async () => (await storedGraphics(page)).length).toBe(1);
    expect((await storedGraphics(page))[0].value.left).toMatchObject({ widthPx: 200, heightPx: 400 });
  });

  test('@DR-041 Prüflogos: weiß und schwarz lassen den Tupfer im Grün der App, Rot/Gelb/Schwarz gibt das Rot', async ({ page }) => {
    const datei = page.getByTestId('turnierlogo-datei');

    await datei.setInputFiles(pngDatei(fixture('weiss.png'), 'weiss.png'));
    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    await expect(tupfer(page)).toHaveAttribute('data-accent', GRUEN_APP);

    await datei.setInputFiles(pngDatei(fixture('schwarz.png'), 'schwarz.png'));
    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    await expect(tupfer(page)).toHaveAttribute('data-accent', GRUEN_APP);

    await datei.setInputFiles(pngDatei(fixture('mehrfarbig.png'), 'mehrfarbig.png'));
    await expect(tupfer(page)).not.toHaveAttribute('data-accent', GRUEN_APP);
    const accent = (await tupfer(page).getAttribute('data-accent')) ?? '#000000';
    expect(accent).toMatch(HEX);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g + 80); // Rot, nicht das abgedunkelte Gelb (dort wären r und g fast gleich)
    expect(r).toBeGreaterThan(b + 80);
  });

  test('@DR-040 ein 141 Bildpunkte hohes Logo warnt und bleibt; mit 236 Bildpunkten Höhe gibt es keine Warnung', async ({ page }) => {
    const datei = page.getByTestId('turnierlogo-datei');

    await datei.setInputFiles(pngDatei(await zeichne(page, 300, 141, 'image/png'), 'klein.png'));

    await expect(page.getByTestId('turnierlogo-warnung')).toContainText('141');
    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    await expect.poll(async () => (await storedGraphics(page)).length).toBe(1);

    await datei.setInputFiles(pngDatei(await zeichne(page, 300, 236, 'image/png'), 'knapp.png'));

    await expect(page.getByTestId('turnierlogo-warnung')).toHaveCount(0);
    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
  });

  test('@W3-030 ungültige Datei bei vorhandenem Logo: der Grund steht da, Logo und Tupfer bleiben', async ({ page }) => {
    const datei = page.getByTestId('turnierlogo-datei');
    await datei.setInputFiles(pngDatei(fixture('mehrfarbig.png'), 'mehrfarbig.png'));
    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    const logoVorher = await page.getByTestId('turnierlogo-vorschau').getAttribute('src');
    const akzentVorher = await tupfer(page).getAttribute('data-accent');
    await expect.poll(async () => (await storedGraphics(page)).length).toBe(1);

    await datei.setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('das ist kein Bild') });

    await expect(page.getByTestId('turnierlogo-fehler')).toContainText(t('wizard:step3.graphics.error.type'));
    await expect(page.getByTestId('turnierlogo-fehler')).toContainText(t('wizard:step3.graphics.logo.keeps'));
    await expect(page.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', logoVorher ?? '');
    await expect(tupfer(page)).toHaveAttribute('data-accent', akzentVorher ?? '');

    await datei.setInputFiles(pngDatei(await zeichne(page, 4001, 8, 'image/png'), 'breit.png')); // über 4000 Bildpunkte an einer Seite

    await expect(page.getByTestId('turnierlogo-fehler')).toContainText('4000');
    await expect(page.getByTestId('turnierlogo-fehler')).toContainText('2 MB');
    await expect(page.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', logoVorher ?? '');
    expect((await storedGraphics(page))[0].value.left?.dataUrl).toBe(logoVorher);
  });

  test('@W3-040 Tupfer ist nicht antippbar: kein Knopf, nicht per Tab erreichbar, ein Klick ändert nichts', async ({ page }) => {
    await page.getByTestId('turnierlogo-datei').setInputFiles(pngDatei(fixture('mehrfarbig.png'), 'mehrfarbig.png'));
    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    const akzent = await tupfer(page).getAttribute('data-accent');

    await tupfer(page).click({ force: true });

    await expect(page.getByRole('button', { name: t('wizard:step3.graphics.accent.label'), exact: false })).toHaveCount(0);
    expect(await tupfer(page).evaluate(el => ({ tag: el.tagName, tabIndex: (el as HTMLElement).tabIndex }))).toEqual({ tag: 'SPAN', tabIndex: -1 });
    await expect(tupfer(page)).toHaveAttribute('data-accent', akzent ?? '');
    await expect(page.getByTestId('akzent-name')).toBeVisible(); // der Farbname steht sichtbar dabei
  });

  test('@W3-040 nach dem Autosave neu laden: Logo, zweite Grafik und Tupfer sind noch da', async ({ page }) => {
    await nameFeld(page).fill('Logo-Turnier');
    await page.getByTestId('turnierlogo-datei').setInputFiles(pngDatei(fixture('mehrfarbig.png'), 'mehrfarbig.png'));
    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    await page.getByTestId('zweite-grafik-datei').setInputFiles(pngDatei(await zeichne(page, 300, 300, 'image/png'), 'sponsor.png'));
    await expect(page.getByTestId('zweite-grafik-vorschau')).toBeVisible();
    const akzent = await tupfer(page).getAttribute('data-accent');
    await expect.poll(async () => (await storedGraphics(page))[0]?.value.right !== undefined).toBe(true);

    // Autosave abwarten (sonst prüft der Test den Fall „nie gespeichert“): der Assistent speichert den Entwurf beim Schließen
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })));
    await expect.poll(() => savedDraftId(page, 'Logo-Turnier')).toBeTruthy();
    const id = await savedDraftId(page, 'Logo-Turnier');
    expect((await storedGraphics(page)).map(entry => entry.key)).toEqual([`tournament-graphics-${id ?? ''}`]); // unter der ID des Entwurfs

    await page.goto(`/#/tournament/${id ?? ''}/edit`);
    await page.reload();

    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    await expect(page.getByTestId('zweite-grafik-vorschau')).toBeVisible();
    await expect(tupfer(page)).toHaveAttribute('data-accent', akzent ?? '');
    expect(akzent).not.toBe(GRUEN_APP);
  });

  test('@W3-040 ohne Logo weiter: Tupfer im Grün der App, Schritt „Sportart“ ist erreichbar', async ({ page }) => {
    await expect(tupfer(page)).toHaveAttribute('data-accent', GRUEN_APP);
    await expect(page.getByTestId('akzent-name')).toHaveText(t('wizard:step3.graphics.accent.appGreen'));
    await expect(page.getByTestId('turnierlogo-fehler')).toHaveCount(0);

    await nameFeld(page).fill('Turnier ohne Logo');
    await page.locator('input[placeholder*="Sporthalle"]').first().fill('Sporthalle Nord');
    const morgen = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await page.locator('input[type="date"]').first().fill(morgen);
    await page.locator('input[type="time"]').first().fill('09:00');
    const weiter = page.getByRole('button', { name: 'Weiter', exact: true });
    await expect(weiter).toBeEnabled();
    await weiter.click();

    await expect(page.getByRole('heading', { name: t('wizard:step1.title') })).toBeVisible();
    expect(await storedGraphics(page)).toEqual([]); // ohne Logo wird nichts abgelegt
  });

  test('@W3-040 Entfernen → Tupfer wieder im Grün der App, Eintrag im Gerätespeicher weg', async ({ page }) => {
    await page.getByTestId('turnierlogo-datei').setInputFiles(pngDatei(fixture('mehrfarbig.png'), 'mehrfarbig.png'));
    await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    await expect.poll(async () => (await storedGraphics(page)).length).toBe(1);

    await page.getByTestId('turnierlogo-entfernen').click();

    await expect(page.getByTestId('turnierlogo-vorschau')).toHaveCount(0);
    await expect(tupfer(page)).toHaveAttribute('data-accent', GRUEN_APP);
    await expect.poll(async () => (await storedGraphics(page)).length).toBe(0);
  });

  test('@W3-030 Team-Logo als SVG wird ebenfalls umgewandelt (kein SVG im Team-Logo)', async ({ page }) => {
    await page.goto('/#/tournament/new?step=5');
    await page.getByTestId('wizard-add-team').click();
    await page.getByPlaceholder(t('wizard:step4.teamNamePlaceholder')).first().fill('TSV Waging');
    await page.locator('[data-testid^="wizard-team-details-"]').first().click();
    await page.getByRole('button', { name: t('wizard:step4.uploadLogo') }).click();

    await page.locator('input[type="file"]').setInputFiles(svgDatei(SVG_BLAU, 'team.svg'));
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Logo speichern' }).click();

    await expect(page.getByRole('button', { name: t('wizard:step4.changeLogo') })).toBeVisible();
    const bild = page.locator('img[src^="data:image/"]').first();
    await expect(bild).toHaveAttribute('src', /^data:image\/png;base64,/);
    expect(((await bild.getAttribute('src')) ?? '').toLowerCase()).not.toContain('svg');
  });

  test('@W3-030 Team-Logo: eine unpassende Datei meldet den Grund auf Deutsch, nicht den englischen Rohtext', async ({ page }) => {
    await page.goto('/#/tournament/new?step=5');
    await page.getByTestId('wizard-add-team').click();
    await page.getByPlaceholder(t('wizard:step4.teamNamePlaceholder')).first().fill('TSV Waging');
    await page.locator('[data-testid^="wizard-team-details-"]').first().click();
    await page.getByRole('button', { name: t('wizard:step4.uploadLogo') }).click();

    await page.locator('input[type="file"]').setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('kein Bild') });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(t('wizard:step4.logoDialogError.type'));
    await expect(dialog).not.toContainText(/Unsupported|Failed to|too large/);
  });
});

test.describe('Bundle-Beleg (gebauter Stand)', () => {
  // Der Assistent lädt den Herstellerblock `pdf-vendor` heute schon über andere Seiten (Vorschau, PDF-Dialog) statisch mit
  // (gleich auf main). Belegt wird deshalb, was T5 beeinflusst: der Code des Assistenten (Schritt 1 mit den neuen Feldern,
  // Aufbereitung, Akzent) enthält selbst kein jsPDF; es steckt allein im Herstellerblock.
  test('Der Wizard-Chunk mit den neuen Feldern enthält kein jsPDF', async ({ page }) => {
    const skripte = new Map<string, string>();
    page.on('response', async response => {
      if (response.url().endsWith('.js')) { skripte.set(response.url(), await response.text().catch(() => '')); }
    });

    await page.goto('/#/tournament/new');
    await expect(page.getByTestId('turnierlogo-feld')).toBeVisible();
    await page.waitForLoadState('networkidle');

    const wizard = [...skripte.entries()].filter(([url, text]) => /\/TournamentCreationScreen-[^/]*\.js$/.test(url) && text.includes('turnierlogo'));
    expect(wizard).toHaveLength(1);
    expect(wizard[0][1]).not.toContain('jsPDF');
    const mitJsPdf = [...skripte.entries()].filter(([, text]) => text.includes('jsPDF')).map(([url]) => url.split('/').pop());
    expect(mitJsPdf.every(name => (name ?? '').startsWith("pdf-vendor-"))).toBe(true); // jsPDF nur im Herstellerblock
  });
});
