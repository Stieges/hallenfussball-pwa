// Muss als klassisches Skript VOR dem Modul-Bundle laufen (siehe index.html):
// Zod 4 probt beim ersten parse() per `new Function("")`, ob eval erlaubt ist —
// strikte CSPs melden das als script-src-Violation (auch im try/catch).
// Ein z.config()-Aufruf im Bundle kommt zu spät: Rollup evaluiert abhängige
// Chunks (mit top-level Parses) vor dem Entry-Body. Zod liest die Config aus
// globalThis.__zod_globalConfig — hier gesetzt, bevor irgendein Chunk läuft.
globalThis.__zod_globalConfig = Object.assign(globalThis.__zod_globalConfig || {}, {
  jitless: true,
});
