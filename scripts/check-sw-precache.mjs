#!/usr/bin/env node
/**
 * check-sw-precache.mjs -- A-07g Fixrunde 1 (A1, @FU-007 "Neustart ohne Netz"): Build-Artefakt-Test.
 *
 * Der Cloud-E2E (tests/e2e/cloud/neustart-offline.cloud.spec.ts) beweist Speicher + Anzeige, laeuft aber
 * ohne Service Worker. Dieses Skript beweist den Auslieferungsteil am Build: Der erzeugte Service Worker
 *   1. faellt bei Seitenanfragen (Navigation) auf `index.html` zurueck (NavigationRoute),
 *   2. hat `index.html` im Precache-Manifest und
 *   3. hat jede JS-/CSS-Datei aus `assets/` im Precache-Manifest.
 *
 * Aufruf: `node scripts/check-sw-precache.mjs [distDir]` (Standard `dist`).
 * Komplett: `npm run test:sw-precache` (baut in `dist-swcheck`, ohne Supabase-Werte im Bundle).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.argv[2] ?? 'dist');
const swPath = path.join(distDir, 'sw.js');
const failures = [];

if (!existsSync(swPath)) {
  console.error(`FEHLER: ${swPath} fehlt (erst bauen).`);
  process.exit(2);
}
const sw = readFileSync(swPath, 'utf8');

// 1. Navigation-Fallback auf index.html
if (!/NavigationRoute\(/.test(sw) || !/createHandlerBoundToURL\(\s*["']index\.html["']\s*\)/.test(sw)) {
  failures.push('Navigation faellt nicht auf index.html zurueck (NavigationRoute + createHandlerBoundToURL("index.html") fehlt)');
}

// Precache-Manifest: Eintraege der Form {url:"...",revision:...}
const manifest = new Set([...sw.matchAll(/url\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]));

// 2. index.html im Manifest
if (!manifest.has('index.html')) {
  failures.push('index.html fehlt im Precache-Manifest');
}

// 3. jede JS-/CSS-Datei aus assets/
const assetsDir = path.join(distDir, 'assets');
const assets = existsSync(assetsDir) ? readdirSync(assetsDir).filter((f) => /\.(js|css)$/.test(f)) : [];
if (assets.length === 0) {
  failures.push('dist/assets enthaelt keine JS-/CSS-Dateien (leerer Build?)');
}
const missing = assets.filter((f) => !manifest.has(`assets/${f}`));
if (missing.length > 0) {
  failures.push(`${missing.length} von ${assets.length} JS-/CSS-Dateien fehlen im Precache-Manifest, z. B. ${missing.slice(0, 3).join(', ')}`);
}

if (failures.length > 0) {
  console.error('sw-precache: ROT');
  for (const f of failures) { console.error(`  - ${f}`); }
  process.exit(1);
}
console.log(`sw-precache: GRUEN (${manifest.size} Precache-Eintraege, ${assets.length} JS/CSS-Chunks, Navigation -> index.html)`);
