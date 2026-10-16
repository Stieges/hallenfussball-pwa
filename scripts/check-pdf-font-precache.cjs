#!/usr/bin/env node

/**
 * Precache-Check der PDF-Schrift (B-28 C3, B6): Die beiden Schrift-Chunks (`src/lib/pdf/fontData/regular.ts`, `bold.ts`)
 * werden im PDF-Export per `import()` nachgeladen. Stehen sie nicht im Precache-Manifest des Service Workers
 * (`dist/sw.js`), fehlt die Schrift genau im Offline-Fall (@DR-021). Die Chunk-Namen enthalten einen Hash; deshalb
 * erkennt der Check die Chunks am Inhalt (Anfang der base64-Schrift aus der Quelldatei), nicht am Namen.
 *
 * Läuft nach jedem `npm run build` (npm-Hook `postbuild`) und als Vitest-Test (`precache.build.test.ts`).
 * Der Skriptaufruf bricht den Build ab (Exit 1), auch wenn `dist/sw.js` fehlt (Daniel 15.10.). Nur die Funktion meldet
 * `skipped`, damit der Test ohne frischen Build den echten `dist` überspringen kann. Optionales Argument: Projektwurzel.
 */
const fs = require('node:fs');
const path = require('node:path');

const FONT_SOURCES = ['regular.ts', 'bold.ts'];
/** So viele Zeichen vom Anfang der base64-Schrift reichen, um den Chunk eindeutig zu finden. */
const PROBE_LENGTH = 200;

/** Erste base64-Zeichenkette (mindestens 200 Zeichen) einer Schrift-Quelldatei, nur ihr Anfang. */
function fontProbe(file) {
  const match = /'([A-Za-z0-9+/=]{200,})'/.exec(fs.readFileSync(file, 'utf8'));
  return match ? match[1].slice(0, PROBE_LENGTH) : undefined;
}

/**
 * @param {string} root Projektwurzel (mit `dist/` und `src/lib/pdf/fontData/`)
 * @returns {{ skipped: boolean, problems: string[], chunks: string[] }}
 */
function checkPdfFontPrecache(root) {
  const sw = path.join(root, 'dist', 'sw.js');
  if (!fs.existsSync(sw)) {
    return { skipped: true, problems: [], chunks: [] };
  }
  const manifest = fs.readFileSync(sw, 'utf8');
  const assets = path.join(root, 'dist', 'assets');
  const chunks = fs.existsSync(assets) ? fs.readdirSync(assets).filter(name => name.endsWith('.js')) : [];
  const problems = [];
  const found = [];
  for (const source of FONT_SOURCES) {
    const probe = fontProbe(path.join(root, 'src', 'lib', 'pdf', 'fontData', source));
    if (!probe) {
      problems.push(`${source}: keine base64-Schrift in der Quelldatei gefunden`);
      continue;
    }
    const hits = chunks.filter(name => fs.readFileSync(path.join(assets, name), 'utf8').includes(probe));
    if (hits.length !== 1) {
      problems.push(`${source}: ${hits.length} Chunks in dist/assets enthalten die Schrift (erwartet: genau 1)`);
      continue;
    }
    found.push(hits[0]);
    if (!manifest.includes(`assets/${hits[0]}"`)) {
      problems.push(`${source}: Chunk assets/${hits[0]} steht nicht im Precache-Manifest dist/sw.js`);
    }
  }
  return { skipped: false, problems, chunks: found };
}

module.exports = { checkPdfFontPrecache };

if (require.main === module) {
  const result = checkPdfFontPrecache(path.resolve(process.argv[2] ?? path.join(__dirname, '..')));
  if (result.skipped) {
    console.error('PDF-Schrift-Precache FEHLER: dist/sw.js fehlt, die Schrift-Chunks sind nicht prüfbar.');
    process.exit(1);
  }
  if (result.problems.length > 0) {
    console.error(`PDF-Schrift-Precache FEHLER:\n- ${result.problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`PDF-Schrift-Precache ok: ${result.chunks.join(', ')} stehen im Manifest.`);
}
