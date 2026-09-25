/**
 * match-engine-ts-dump.ts — TS-Seite des Gleichlauf-Skripts (B3a,
 * .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3a-brief.md, Abschnitt 2).
 *
 * Gibt für jede Fixture unter src/core/match/__fixtures__/*.json das Ergebnis der TS-Rechenfunktion
 * als JSON-Array `[{file, results, serverState}]` auf stdout aus -- exakt so, wie der Vitest-Runner
 * (src/core/match/__tests__/fixtures.test.ts) die Fixture anwendet: `prior` per `continueLog` ab
 * `initialState` (Ergebnisse verworfen), danach `events` per `continueLog` (mode log) bzw.
 * `applyBatch` (mode batch), zuletzt `toServerState`.
 *
 * Ausführung: `node scripts/match-engine-ts-dump.ts` (Node >= 22.18 / 24 -- natives Type-Stripping,
 * .nvmrc = 24). Warum nicht Vitest: Ein Vitest-Lauf als Datenquelle bräuchte eine Test-Datei, die
 * in `npm test` mitliefe (oder eine eigene Config) und Ausgabe über Seiteneffekte schreibt; hier ist
 * es ein reines Skript ohne Testrahmen. Die Rechenfunktion importiert ohne Dateiendung
 * (`'./types'`) und lädt `matchTransitions.json` ohne Import-Attribut -- beides kann Node nativ
 * nicht. Die zwei kleinen Modul-Hooks unten (`registerHooks`, synchron, Node >= 22.15) ergänzen
 * deshalb `.ts` bei relativen Importen aus .ts-Dateien und liefern .json als ESM-Modul aus.
 * Die Rechenfunktion selbst bleibt unverändert (Brief: TS ist die Referenz).
 *
 * Nur erasable TS-Syntax (Type-Stripping), keine Laufzeit-Abhängigkeit außer der Rechenfunktion.
 */
import { registerHooks } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    if (isRelative && context.parentURL?.endsWith('.ts') && !/\.(ts|json)$/.test(specifier)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(`${specifier}.ts`, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      const source = `export default ${readFileSync(fileURLToPath(url), 'utf-8')};`;
      return { format: 'module', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const matchDir = join(repoRoot, 'src', 'core', 'match');
const fixturesDir = join(matchDir, '__fixtures__');

const engine = await import(pathToFileURL(join(matchDir, 'index.ts')).href);

interface FixtureFile {
  ctx: { matchId: string; teamAId: string; teamBId: string };
  mode: 'log' | 'batch';
  prior?: unknown[];
  events: unknown[];
}

const fileNames = readdirSync(fixturesDir)
  .filter((name) => name.endsWith('.json'))
  .sort();

const output = fileNames.map((file) => {
  const fixture = JSON.parse(readFileSync(join(fixturesDir, file), 'utf-8')) as FixtureFile;
  const prior = engine.continueLog(engine.initialState(fixture.ctx), fixture.prior ?? [], fixture.ctx);
  const outcome =
    fixture.mode === 'log'
      ? engine.continueLog(prior.state, fixture.events, fixture.ctx)
      : engine.applyBatch(prior.state, fixture.events, fixture.ctx);
  return { file, results: outcome.results, serverState: engine.toServerState(outcome.state) };
});

process.stdout.write(`${JSON.stringify(output)}\n`);
