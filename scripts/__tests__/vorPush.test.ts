// Vor-Push-Prüfung (scripts/vor-push/vor-push.mjs) gegen das Gherkin im Record plattform/2026-10-03_testabdeckung-und-
// szenario-tests (@TA-019, @TA-020, @TA-025). Ende-zu-Ende in einem Temp-Repo: „origin“ ist ein lokales Repo, der Umsetzer
// arbeitet in einem Klon. Die Prüfschritte sind die npm-Skripte DES TEMP-REPOS (kleine node-Einzeiler), Playwright ist
// ein Stellvertreter unter node_modules/.bin – so läuft der echte Ablauf (fetch, merge-tree, Probe-Arbeitskopie,
// Schrittfolge, Zeitgrenze, Aufräumen) ohne die App zu bauen.
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error -- ESM-Hilfsmodul ohne Typen
import { haertetestNoetig, waehleSpecs } from '../vor-push/auswahl.mjs'
// @ts-expect-error -- ESM-Hilfsmodul ohne Typen
import { zuPruefendeCommits } from '../vor-push/vor-push.mjs'
// @ts-expect-error -- ESM-Hilfsmodul ohne Typen
import { vergleicheSperrdateien } from '../vor-push/abhaengigkeiten.mjs'
import { git, sauberEnv, schreibe } from './skriptHilfen'

const VOR_PUSH_ORDNER = resolve(__dirname, '..', 'vor-push')
const VOR_PUSH = join(VOR_PUSH_ORDNER, 'start.mjs')
const NULL = '0'.repeat(40)

// Ein Prüflauf startet je Schritt einen echten Kindprozess (npm, node) und eine git-Arbeitskopie: unter der Last des
// Commit-Hooks deutlich länger als die 5-s-Vorgabe. Die Zeitgrenze des Playwright-Schritts selbst ist Prüfgegenstand.
const LAUF_MS = 120_000

const ordner: string[] = []
afterEach(() => { for (const o of ordner.splice(0)) rmSync(o, { recursive: true, force: true }) })

const BAUEN = `const fs = require('fs');
const z = fs.readFileSync('src/x.ts', 'utf8').split('\\n').filter((l) => l.startsWith('import '));
const doppelt = z.find((l, i) => z.indexOf(l) !== i);
if (doppelt) { console.error('src/x.ts: doppelter Import: ' + doppelt); process.exit(1) }
console.log('gebaut');`

interface Aufbau { wurzel: string; origin: string; klon: string; protokoll: string; temp: string }

/** origin (main mit Grundstand) + Klon des Umsetzers auf Branch feat; eigener Temp-Ordner für den Hook (TMPDIR). */
function aufbau(): Aufbau {
  const wurzel = mkdtempSync(join(tmpdir(), 'vorpush-test-'))
  ordner.push(wurzel)
  const temp = join(wurzel, 'tmp')
  mkdirSync(temp)
  const origin = join(wurzel, 'origin')
  const protokoll = join(wurzel, 'playwright-aufruf.json')
  git(wurzel, 'init', '-q', '-b', 'main', origin)
  const ok = 'node ok.cjs'
  schreibe(origin, 'ok.cjs', 'process.exit(0)\n')
  schreibe(origin, 'package.json', JSON.stringify({
    name: 'vorpush-probe', private: true,
    scripts: { 'tokens:check': ok, 'terms:check': ok, lint: 'node lint.cjs', build: 'node bauen.cjs', 'test:scenarios': ok, 'test:visual-metrics': ok },
  }))
  schreibe(origin, 'lint.cjs', 'process.exit(Number(process.env.LINT_EXIT ?? 0))\n')
  schreibe(origin, 'bauen.cjs', BAUEN)
  schreibe(origin, '.gitignore', 'node_modules\n')
  schreibe(origin, 'src/x.ts', ['// Kopf', "import { b } from './m'", '', 'const eins = 1', 'const zwei = 2', 'const drei = 3', 'const vier = 4', 'const fuenf = 5', 'export const y = b', ''].join('\n'))
  schreibe(origin, 'src/components/schedule/Plan.tsx', 'export const Plan = 1\n')
  schreibe(origin, 'tests/e2e/flows/spielplan.spec.ts', '// spec\n')
  schreibe(origin, 'tests/e2e/flows/smoke.spec.ts', '// spec\n')
  schreibe(origin, 'tests/e2e/flows/monitor-display.spec.ts', '// spec\n')
  schreibe(origin, 'docs/notiz.md', 'a\n')
  git(origin, 'add', '-A')
  git(origin, 'commit', '-q', '-m', 'grund')
  const klon = join(wurzel, 'klon')
  git(wurzel, 'clone', '-q', origin, klon)
  git(klon, 'switch', '-q', '-c', 'feat')
  // Stellvertreter für Playwright: protokolliert Aufruf und Umgebung, schläft auf Wunsch (Zeitgrenze).
  schreibe(klon, 'node_modules/.bin/playwright', `#!/usr/bin/env node
require('fs').writeFileSync(${JSON.stringify(protokoll)}, JSON.stringify({ pid: process.pid, args: process.argv.slice(2), port: process.env.PORT, ohneCloud: process.env.E2E_OHNE_CLOUD_SERVER, ci: process.env.CI, url: process.env.VITE_SUPABASE_URL }))
setTimeout(() => process.exit(Number(process.env.PW_EXIT ?? 0)), Number(process.env.PW_SCHLAF_MS ?? 0))
`)
  chmodSync(join(klon, 'node_modules/.bin/playwright'), 0o755)
  schreibe(klon, 'node_modules/.bin/tsc', '#!/usr/bin/env node\nconsole.log("typen geprüft"); process.exit(Number(process.env.TSC_EXIT ?? 0))\n')
  chmodSync(join(klon, 'node_modules/.bin/tsc'), 0o755)
  return { wurzel, origin, klon, protokoll, temp }
}

const commit = (repo: string, datei: string, inhalt: string, nachricht: string) => {
  schreibe(repo, datei, inhalt)
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', nachricht)
  return git(repo, 'rev-parse', 'HEAD').stdout.trim()
}

/** Hook-Umgebung: ohne GIT_*, eigener TMPDIR (die Aufräumung alter Arbeitskopien sieht nur den Test-Ordner). */
const hookEnv = (klon: string, env: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({ ...sauberEnv(klon), TMPDIR: join(klon, '..', 'tmp'), ...env })

function vorPush(klon: string, stdin: string, env: NodeJS.ProcessEnv = {}, { skript = VOR_PUSH, remote = 'origin' } = {}) {
  const r = spawnSync('node', [skript, remote], { cwd: klon, input: stdin, encoding: 'utf8', env: hookEnv(klon, env), timeout: LAUF_MS })
  return { code: r.status, aus: `${r.stdout}${r.stderr}` }
}

/** Zustand des Umsetzers: HEAD, Index/Arbeitsbaum, Arbeitskopien. */
const zustand = (klon: string) => ({
  head: git(klon, 'rev-parse', 'HEAD').stdout,
  status: git(klon, 'status', '--porcelain', '--untracked-files=all').stdout,
  worktrees: git(klon, 'worktree', 'list', '--porcelain').stdout,
  x: readFileSync(join(klon, 'src/x.ts'), 'utf8'),
})

const zeile = (sha: string, ref = 'refs/heads/feat') => `refs/heads/feat ${sha} ${ref} ${NULL}\n`
const lebt = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }

describe('@TA-019 Vor dem Hochladen: Build des Stands nach dem Zusammenführen mit dem Hauptzweig', () => {
  it('@TA-019 doppelter Import erst nach dem Zusammenführen: Abbruch mit Schritt „Build nach dem Zusammenführen“, Datei und Fehler; Arbeitsbaum unverändert', () => {
    const { origin, klon } = aufbau()
    const grund = readFileSync(join(klon, 'src/x.ts'), 'utf8').split('\n')
    // Branch: Import oben; Hauptzweig: derselbe Import weiter unten (anderer PR) – jeder Stand baut für sich.
    const sha = commit(klon, 'src/x.ts', [grund[0], "import { a } from './m'", ...grund.slice(1)].join('\n'), 'branch: import a')
    commit(origin, 'src/x.ts', [...grund.slice(0, 7), "import { a } from './m'", ...grund.slice(7)].join('\n'), 'main: import a')
    expect(spawnSync('node', ['bauen.cjs'], { cwd: klon }).status, 'Branch baut allein').toBe(0)
    expect(spawnSync('node', ['bauen.cjs'], { cwd: origin }).status, 'Hauptzweig baut allein').toBe(0)
    const vorher = zustand(klon)

    const r = vorPush(klon, zeile(sha))

    expect(r.code, r.aus).toBe(1)
    expect(r.aus).toContain('Probe-Commit')
    expect(r.aus).toContain('✖ Build nach dem Zusammenführen')
    expect(r.aus).toContain('src/x.ts: doppelter Import')
    expect(r.aus).toContain('Schritt „Build nach dem Zusammenführen“ ist rot')
    expect(zustand(klon)).toEqual(vorher)
  }, LAUF_MS)

  it('@TA-019 Gegenbeispiel Konflikt: Abbruch ohne Build, nennt die Datei mit Konflikt; Arbeitsbaum unverändert', () => {
    const { origin, klon } = aufbau()
    const sha = commit(klon, 'src/components/schedule/Plan.tsx', 'export const Plan = 2\n', 'branch')
    commit(origin, 'src/components/schedule/Plan.tsx', 'export const Plan = 3\n', 'main')
    const vorher = zustand(klon)

    const r = vorPush(klon, zeile(sha))

    expect(r.code, r.aus).toBe(1)
    expect(r.aus).toContain('nicht konfliktfrei')
    expect(r.aus).toContain('- src/components/schedule/Plan.tsx')
    expect(r.aus).not.toContain('▶ Build')
    expect(zustand(klon)).toEqual(vorher)
  }, LAUF_MS)

  it('@TA-019 Gegenbeispiel: sauber zusammenführbar und alle Schritte grün → Hochladen geht weiter, Probe-Arbeitskopie ist weg', () => {
    const { origin, klon } = aufbau()
    const sha = commit(klon, 'docs/notiz.md', 'b\n', 'branch: doku')
    commit(origin, 'src/components/schedule/Plan.tsx', 'export const Plan = 9\n', 'main: anderes')
    const vorher = zustand(klon)

    const r = vorPush(klon, zeile(sha))

    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('✓ Build nach dem Zusammenführen')
    expect(r.aus).toContain('✓ Lint')
    expect(zustand(klon)).toEqual(vorher)
  }, LAUF_MS)
})

describe('@TA-020 Vor dem Hochladen: Härtetest und Playwright der geänderten Bereiche ohne Datenbank', () => {
  it('@TA-020 Änderung unter src/components/schedule/: Härtetest und die Spielplan-Specs im Projekt desktop, freier Port, ohne Cloud-Server, Gründe in der Ausgabe', () => {
    const { klon, protokoll } = aufbau()
    const sha = commit(klon, 'src/components/schedule/Plan.tsx', 'export const Plan = 5\n', 'branch: spielplan')

    const r = vorPush(klon, zeile(sha))

    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('✓ Härtetest visuelle Messung')
    expect(r.aus).toContain('tests/e2e/flows/spielplan.spec.ts  ← Bereich Spielplan (src/components/schedule/Plan.tsx)')
    const aufruf = JSON.parse(readFileSync(protokoll, 'utf8')) as { args: string[]; port: string; ohneCloud: string; ci: string; url: string }
    expect(aufruf.args).toContain('--project=desktop')
    expect(aufruf.args).toContain('tests/e2e/flows/spielplan.spec.ts')
    expect(aufruf.args).not.toContain('tests/e2e/flows/monitor-display.spec.ts')
    expect(['3000', '3100']).not.toContain(aufruf.port)
    expect(aufruf.ohneCloud).toBe('1')
    expect(aufruf.url).toBe('')
  }, LAUF_MS)

  it('@TA-020 ein roter Playwright-Lauf bricht das Hochladen ab und nennt den Schritt', () => {
    const { klon } = aufbau()
    const sha = commit(klon, 'src/components/schedule/Plan.tsx', 'export const Plan = 6\n', 'branch')

    const r = vorPush(klon, zeile(sha), { PW_EXIT: '1' })

    expect(r.code, r.aus).toBe(1)
    expect(r.aus).toContain('Schritt „Playwright desktop (ohne Datenbank, geänderte Bereiche)“ ist rot')
  }, LAUF_MS)

  it('@TA-020 Zeitgrenze überschritten: Abbruch, nennt Grenze und Schritt', () => {
    const { klon } = aufbau()
    const sha = commit(klon, 'src/components/schedule/Plan.tsx', 'export const Plan = 7\n', 'branch')

    // 0,05 min = 3 s Lauf plus gleich viel Reserve; der Stellvertreter schläft 60 s.
    const r = vorPush(klon, zeile(sha), { VOR_PUSH_E2E_MINUTEN: '0.05', PW_SCHLAF_MS: '60000' })

    expect(r.code, r.aus).toBe(1)
    expect(r.aus).toMatch(/ZEITGRENZE 0:06 min ÜBERSCHRITTEN/)
    expect(r.aus).toContain('Schritt „Playwright desktop (ohne Datenbank, geänderte Bereiche)“ hat seine Zeitgrenze (0:06 min) überschritten')
  }, LAUF_MS)

  it('@TA-020 Gegenbeispiel: nur docs/ und .github/ geändert → weder Härtetest noch Playwright', () => {
    const { klon, protokoll } = aufbau()
    schreibe(klon, '.github/workflows/x.yml', 'name: x\n')
    const sha = commit(klon, 'docs/notiz.md', 'c\n', 'branch: doku')

    const r = vorPush(klon, zeile(sha))

    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('Härtetest übersprungen')
    expect(r.aus).toContain('keine Playwright-Specs gewählt')
    expect(existsSync(protokoll)).toBe(false)
  }, LAUF_MS)

  it('@TA-020 Gegenbeispiel: Branch auf dem Server löschen und Tags laufen ohne Prüfung durch', () => {
    const { klon } = aufbau()
    const r = vorPush(klon, `(delete) ${NULL} refs/heads/alt ${'a'.repeat(40)}\n`)
    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('nichts zu prüfen')
    expect(zuPruefendeCommits(`refs/tags/v1 ${'b'.repeat(40)} refs/tags/v1 ${NULL}\n`)).toEqual([])
  }, LAUF_MS)
})

describe('@TA-020 Auswahl der Specs und des Härtetests nach geänderten Pfaden', () => {
  const specs = [
    'tests/e2e/flows/spielplan.spec.ts', 'tests/e2e/flows/schedule-editor.spec.ts', 'tests/e2e/flows/smoke.spec.ts',
    'tests/e2e/flows/cockpit-hoehen.spec.ts', 'tests/e2e/flows/monitor-display.spec.ts', 'tests/e2e/cloud/x.spec.ts',
    'tests/e2e/visual/y.visual.spec.ts', 'tests/e2e/helpers/warten.ts',
  ]
  const lese = (p: string) => (p.includes('cockpit-hoehen') ? "import { x } from '../helpers/warten'" : '')

  it('@TA-020 Spielplan-Datei → Spielplan-Specs, nie Cloud- oder Visual-Specs', () => {
    const a = waehleSpecs(['src/components/schedule/ScheduleDisplay.tsx'], specs, lese) as { specs: string[] }
    expect(a.specs).toEqual(['tests/e2e/flows/schedule-editor.spec.ts', 'tests/e2e/flows/spielplan.spec.ts'])
  })

  it('@TA-020 geänderte Spec und geänderte Hilfsdatei → die Spec selbst und jede Spec, die die Hilfe einbindet', () => {
    const a = waehleSpecs(['tests/e2e/flows/monitor-display.spec.ts', 'tests/e2e/helpers/warten.ts'], specs, lese) as { specs: string[] }
    expect(a.specs).toEqual(['tests/e2e/flows/cockpit-hoehen.spec.ts', 'tests/e2e/flows/monitor-display.spec.ts'])
  })

  it('@TA-020 App-Datei ohne Bereich → Rauchtest; Test-Dateien unter src/ → nichts', () => {
    expect((waehleSpecs(['src/utils/zahl.ts'], specs, lese) as { specs: string[] }).specs).toEqual(['tests/e2e/flows/smoke.spec.ts'])
    expect((waehleSpecs(['src/utils/__tests__/zahl.test.ts'], specs, lese) as { specs: string[] }).specs).toEqual([])
  })

  it('@TA-020 Härtetest nur bei App oder Messskript', () => {
    expect(haertetestNoetig(['src/components/schedule/Plan.tsx'])).toBe(true)
    expect(haertetestNoetig(['scripts/visual-metrics/grenzwerte.json'])).toBe(true)
    expect(haertetestNoetig(['src/x/__tests__/a.test.tsx', 'docs/a.md', '.github/workflows/ci.yml', 'scripts/scenario-tests.mjs'])).toBe(false)
  })
})

describe('@TA-019 Review #420: Pfade, Netz, Abhängigkeiten', () => {
  it('@TA-019 Einstieg über eine Verknüpfung in einem Pfad mit Leerzeichen und Umlaut: die Prüfung läuft, nie stilles Exit 0', () => {
    const { wurzel, klon } = aufbau()
    const sonder = join(wurzel, 'Hallenfußball PWA')
    mkdirSync(sonder)
    symlinkSync(VOR_PUSH_ORDNER, join(sonder, 'vor push'), 'dir')
    const sha = commit(klon, 'docs/notiz.md', 'd\n', 'branch: doku')

    const r = vorPush(klon, zeile(sha), {}, { skript: join(sonder, 'vor push', 'start.mjs') })

    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('vor-push: hole origin/main')
    expect(r.aus).toContain('✓ Lint')
  }, LAUF_MS)

  it('@TA-019 Push an eine Adresse statt an einen Remote-Namen: der Hauptzweig kommt über FETCH_HEAD', () => {
    const { origin, klon } = aufbau()
    const sha = commit(klon, 'docs/notiz.md', 'e\n', 'branch: doku')

    const r = vorPush(klon, zeile(sha), {}, { remote: origin })

    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('vor-push: hole Hauptzweig')
    expect(r.aus).toContain('✓ Build')
  }, LAUF_MS)

  it('@TA-019 Server antwortet nicht binnen der Frist: Abbruch mit „nicht erreichbar“ und Zeitgrenze', () => {
    const { wurzel, klon } = aufbau()
    const haengt = join(wurzel, 'haengt.sh')
    writeFileSync(haengt, '#!/bin/sh\nsleep 20\n')
    chmodSync(haengt, 0o755)
    git(klon, 'config', 'core.sshCommand', haengt)
    git(klon, 'remote', 'add', 'langsam', 'ssh://beispiel.invalid/repo.git')
    const sha = commit(klon, 'docs/notiz.md', 'f\n', 'branch: doku')

    const r = vorPush(klon, zeile(sha), { VOR_PUSH_FETCH_SEKUNDEN: '2' }, { remote: 'langsam' })

    expect(r.code, r.aus).toBe(1)
    expect(r.aus).toContain('langsam antwortet nicht (Zeitgrenze 2 s) – ohne Netz kein Hochladen')
  }, LAUF_MS)

  it('@TA-019 installierte Abhängigkeiten passen nicht zur package-lock.json: Abbruch mit „npm ci“, kein Prüfschritt', () => {
    const { klon } = aufbau()
    schreibe(klon, 'node_modules/.package-lock.json', JSON.stringify({ packages: { 'node_modules/a': { version: '1.0.0' } } }))
    const sha = commit(klon, 'package-lock.json', JSON.stringify({ packages: { '': {}, 'node_modules/a': { version: '2.0.0' } } }), 'branch: neue Abhängigkeit')

    const r = vorPush(klon, zeile(sha))

    expect(r.code, r.aus).toBe(1)
    expect(r.aus).toContain('a: soll 2.0.0, ist 1.0.0')
    expect(r.aus).toContain('npm ci')
    expect(r.aus).not.toContain('▶ Lint')
  }, LAUF_MS)

  it('@TA-019 Vergleich der Sperrdateien: gleiche Versionen und fehlende optionale Pakete passen, abweichende und fehlende nicht', () => {
    const soll = { packages: { '': {}, 'node_modules/a': { version: '1.0.0' }, 'node_modules/b': { version: '2.0.0', optional: true }, 'node_modules/c': { version: '3.0.0' } } }
    expect(vergleicheSperrdateien(soll, { packages: { 'node_modules/a': { version: '1.0.0' }, 'node_modules/c': { version: '3.0.0' } } })).toEqual([])
    expect(vergleicheSperrdateien(soll, { packages: { 'node_modules/a': { version: '1.0.1' } } })).toEqual(['a: soll 1.0.0, ist 1.0.1', 'c: soll 3.0.0, fehlt'])
  })
})

describe('@TA-020 Review #420: Abbruch und Aufräumen', () => {
  it('@TA-020 Strg-C während Playwright: der laufende Schritt endet, die Arbeitskopie ist weg, Exit 130', async () => {
    const { klon, protokoll } = aufbau()
    const sha = commit(klon, 'src/components/schedule/Plan.tsx', 'export const Plan = 8\n', 'branch')
    const hook = spawn('node', [VOR_PUSH, 'origin'], { cwd: klon, env: hookEnv(klon, { PW_SCHLAF_MS: '60000' }), stdio: ['pipe', 'pipe', 'pipe'] })
    let aus = ''
    hook.stdout.on('data', (d: Buffer) => { aus += d.toString() })
    hook.stderr.on('data', (d: Buffer) => { aus += d.toString() })
    hook.stdin.end(zeile(sha))
    // 'exit' statt 'close': 'close' wartete auch auf die geerbten Ausgabe-Rohre eines weiterlaufenden Kindes.
    const ende = new Promise<number | null>((fertig) => { hook.on('exit', (code) => { fertig(code) }) })
    await expect.poll(() => existsSync(protokoll), { timeout: 60_000, interval: 200 }).toBe(true)
    const { pid } = JSON.parse(readFileSync(protokoll, 'utf8')) as { pid: number }
    expect(lebt(pid)).toBe(true)

    hook.kill('SIGINT')

    expect(await ende, aus).toBe(130)
    // Der Hook beendet den Schritt, BEVOR er selbst endet: kurz danach ist der Stellvertreter weg (er schliefe 60 s).
    await expect.poll(() => lebt(pid), { timeout: 3_000, interval: 100 }).toBe(false)
    expect(aus).toContain('abgebrochen (SIGINT)')
    expect(aus).not.toContain('ist rot')
    expect(aus).not.toContain('Zusammenfassung')
    expect(git(klon, 'worktree', 'list').stdout).not.toContain('vor-push-')
  }, LAUF_MS)

  it('@TA-020 liegen gebliebene eigene Arbeitskopien älter als 6 h räumt der nächste Start auf, frische und fremde nicht', () => {
    const { klon, temp } = aufbau()
    const alt = join(temp, 'vor-push-alt')
    const frisch = join(temp, 'vor-push-frisch')
    const fremd = join(temp, 'vor-push-fremd')
    for (const d of [alt, frisch]) { mkdirSync(d); writeFileSync(join(d, '.git'), 'gitdir: /nirgends\n') }
    mkdirSync(fremd)
    const vorSiebenStunden = new Date(Date.now() - 7 * 3600_000)
    for (const d of [alt, fremd]) utimesSync(d, vorSiebenStunden, vorSiebenStunden)

    const r = vorPush(klon, `(delete) ${NULL} refs/heads/alt ${'a'.repeat(40)}\n`)

    expect(r.code, r.aus).toBe(0)
    expect(readdirSync(temp).sort()).toEqual(['vor-push-fremd', 'vor-push-frisch'])
  }, LAUF_MS)

  it('@TA-020 index.html, public/ und vite.config.ts → Rauchtest', () => {
    const specs = ['tests/e2e/flows/smoke.spec.ts', 'tests/e2e/flows/spielplan.spec.ts']
    for (const p of ['index.html', 'public/sw-hilfe.js', 'vite.config.ts', 'package.json']) {
      expect((waehleSpecs([p], specs, () => '') as { specs: string[] }).specs, p).toEqual(['tests/e2e/flows/smoke.spec.ts'])
    }
  })
})

describe('@TA-025 Sicherungs-Push', () => {
  it('@TA-025 Branch sicherung/… mit Konflikt: Warnung, nur Lint und Typen, Hinweis „nicht geprüft wie die CI“, protokolliert', () => {
    const { origin, klon } = aufbau()
    const sha = commit(klon, 'src/components/schedule/Plan.tsx', 'export const Plan = 2\n', 'branch')
    commit(origin, 'src/components/schedule/Plan.tsx', 'export const Plan = 3\n', 'main')

    const r = vorPush(klon, zeile(sha, 'refs/heads/sicherung/spur-a'), { VOR_PUSH_MODUS: 'sicherung' })

    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('SICHERUNG – nicht geprüft wie die CI')
    expect(r.aus).toContain('WARNUNG – Konflikt')
    expect(r.aus).toContain('- src/components/schedule/Plan.tsx')
    expect(r.aus).toContain('✓ Lint')
    expect(r.aus).toContain('✓ Typen')
    expect(r.aus).not.toContain('▶ Build')
    expect(r.aus).not.toContain('Playwright')
    expect(r.aus).not.toContain('Härtetest')
    const log = readFileSync(join(klon, '.git', 'vor-push-sicherung.log'), 'utf8')
    expect(log).toContain(`refs/heads/sicherung/spur-a ${sha} gruen konflikt`)
  }, LAUF_MS)

  it('@TA-025 Gegenbeispiel: Sicherungs-Modus auf einen Branch ohne „sicherung/“ bricht ab', () => {
    const { klon } = aufbau()
    const sha = commit(klon, 'docs/notiz.md', 'g\n', 'branch')

    const r = vorPush(klon, zeile(sha), { VOR_PUSH_MODUS: 'sicherung' })

    expect(r.code, r.aus).toBe(1)
    expect(r.aus).toContain('gilt nur für Branches „sicherung/…“')
  }, LAUF_MS)

  it('@TA-025 Gegenbeispiel: ein roter Lint bricht auch den Sicherungs-Push ab; unbekannter Modus bricht ab', () => {
    const { klon } = aufbau()
    const sha = commit(klon, 'docs/notiz.md', 'h\n', 'branch')

    const rot = vorPush(klon, zeile(sha, 'refs/heads/sicherung/x'), { VOR_PUSH_MODUS: 'sicherung', LINT_EXIT: '1' })
    expect(rot.code, rot.aus).toBe(1)
    expect(rot.aus).toContain('Schritt „Lint“ ist rot')

    const unbekannt = vorPush(klon, zeile(sha), { VOR_PUSH_MODUS: 'schnell' })
    expect(unbekannt.code, unbekannt.aus).toBe(1)
    expect(unbekannt.aus).toContain('unbekannter VOR_PUSH_MODUS')
  }, LAUF_MS)
})
