/**
 * B-28 C3 (B6): beide Schrift-Chunks des PDFs stehen im Precache-Manifest des Service Workers. Sonst fehlt die Schrift
 * genau im Offline-Fall (@DR-021, @BM-023).
 *
 * Zwei Teile: (1) der Prüfer selbst an einem gebauten Mini-`dist` (läuft immer, mit Gegenbeispiel), (2) der echte
 * `dist/` des Projekts – übersprungen, wenn nicht gebaut oder älter als die Schriftdateien. Im Betrieb läuft der Prüfer
 * nach jedem `npm run build` (npm-Hook `postbuild`, `scripts/check-pdf-font-precache.cjs`).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkPdfFontPrecache } from '../../../../scripts/check-pdf-font-precache.cjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const FONT_DIR = join(ROOT, 'src', 'lib', 'pdf', 'fontData');
const temporaer: string[] = [];

/** Base64-Anfang einer Schriftquelle, wie der Prüfer ihn sucht. */
function schriftAnfang(datei: string): string {
  const treffer = /'([A-Za-z0-9+/=]{200,})'/.exec(readFileSync(join(FONT_DIR, datei), 'utf8'));
  if (!treffer?.[1]) {throw new Error(`keine Schrift in ${datei}`);}
  return treffer[1].slice(0, 200);
}

/** Mini-Projekt mit den echten Schriftquellen und einem gebauten `dist` mit zwei Chunks; `manifest` bestimmt den Inhalt von sw.js. */
function miniProjekt(manifest: string): string {
  const root = mkdtempSync(join(tmpdir(), 'precache-'));
  temporaer.push(root);
  mkdirSync(join(root, 'src', 'lib', 'pdf', 'fontData'), { recursive: true });
  mkdirSync(join(root, 'dist', 'assets'), { recursive: true });
  for (const datei of ['regular.ts', 'bold.ts']) {
    writeFileSync(join(root, 'src', 'lib', 'pdf', 'fontData', datei), readFileSync(join(FONT_DIR, datei)));
  }
  writeFileSync(join(root, 'dist', 'assets', 'regular-AAAA1111.js'), `export default "${schriftAnfang('regular.ts')}";`);
  writeFileSync(join(root, 'dist', 'assets', 'bold-BBBB2222.js'), `export default "${schriftAnfang('bold.ts')}";`);
  writeFileSync(join(root, 'dist', 'sw.js'), manifest);
  return root;
}

afterEach(() => {
  while (temporaer.length > 0) {
    rmSync(temporaer.pop()!, { recursive: true, force: true });
  }
});

describe('B6 Prüfer für das Precache-Manifest', () => {
  it('beide Chunks im Manifest → keine Probleme', () => {
    const root = miniProjekt('e.precacheAndRoute([{url:"assets/regular-AAAA1111.js",revision:null},{url:"assets/bold-BBBB2222.js",revision:null}])');

    expect(checkPdfFontPrecache(root)).toEqual({ skipped: false, problems: [], chunks: ['regular-AAAA1111.js', 'bold-BBBB2222.js'] });
  });

  it('Gegenbeispiel: ein Chunk fehlt im Manifest → Problem mit Dateiname', () => {
    const root = miniProjekt('e.precacheAndRoute([{url:"assets/regular-AAAA1111.js",revision:null}])');
    const { problems } = checkPdfFontPrecache(root);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('bold-BBBB2222.js');
  });

  it('Gegenbeispiel: kein Chunk enthält die Schrift (Schrift im Haupt-Chunk versteckt) → Problem', () => {
    const root = miniProjekt('e.precacheAndRoute([])');
    rmSync(join(root, 'dist', 'assets', 'bold-BBBB2222.js'));

    expect(checkPdfFontPrecache(root).problems.join(' ')).toContain('bold.ts: 0 Chunks');
  });

  it('ohne dist/sw.js: übersprungen, kein Fehler', () => {
    const root = miniProjekt('');
    rmSync(join(root, 'dist', 'sw.js'));

    expect(checkPdfFontPrecache(root)).toEqual({ skipped: true, problems: [], chunks: [] });
  });
});

describe('B6 echter dist des Projekts', () => {
  const sw = join(ROOT, 'dist', 'sw.js');
  const frisch = existsSync(sw)
    && statSync(sw).mtimeMs > Math.max(statSync(join(FONT_DIR, 'regular.ts')).mtimeMs, statSync(join(FONT_DIR, 'bold.ts')).mtimeMs);

  it.skipIf(!frisch)('beide Schrift-Chunks stehen in dist/sw.js (übersprungen ohne frischen Build)', () => {
    const result = checkPdfFontPrecache(ROOT);

    expect(result.problems).toEqual([]);
    expect(result.chunks).toHaveLength(2);
  });
});
