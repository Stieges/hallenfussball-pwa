// Main-Ampel (scripts/main-ampel.mjs) gegen das Gherkin @TA-022 im Record plattform/2026-10-03_testabdeckung-und-szenario-tests.
// GitHub wird durch einen `gh`-Stellvertreter im PATH ersetzt: er beantwortet die Abfragen aus einer Fixture-Datei und
// protokolliert gesetzte Status. So läuft das echte Skript ohne Netz und ohne Rechte.
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SKRIPT = resolve(__dirname, '..', 'main-ampel.mjs')

/** Unterblock `name:` (Einrückung `tiefe`) eines Workflow-Texts – bewusst ohne YAML-Bibliothek (keine neue Abhängigkeit). */
function block(text: string, name: string, tiefe: number): string[] {
  const zeilen = text.split('\n')
  const start = zeilen.findIndex((z) => z === `${' '.repeat(tiefe)}${name}:` || z.startsWith(`${' '.repeat(tiefe)}${name}: `))
  if (start < 0) return []
  const ende = zeilen.findIndex((z, i) => i > start && z.trim() !== '' && !z.trimStart().startsWith('#') && z.length - z.trimStart().length <= tiefe)
  return zeilen.slice(start, ende < 0 ? undefined : ende)
}
const WORKFLOWS = resolve(__dirname, '..', '..', '.github', 'workflows')

const STUB = `#!/usr/bin/env node
const fs = require('fs')
const f = JSON.parse(fs.readFileSync(process.env.GH_FIXTURE, 'utf8'))
const a = process.argv.slice(2)
const wert = (n) => a[a.indexOf(n) + 1]
const raus = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0) }
if ((f.fehler ?? []).some((x) => a.join(' ').includes(x))) { process.stderr.write('HTTP 502'); process.exit(1) }
if (a[0] === 'run' && a[1] === 'list') raus(f.runs[wert('--workflow')] ?? [])
if (a[0] === 'run' && a[1] === 'view') raus({ jobs: f.jobs[a[2]] ?? [] })
if (a[0] === 'pr' && a[1] === 'list') raus(a.includes('--search') ? (f.suche[wert('--search')] ?? []).map((n) => ({ number: n })) : f.offen.map((n) => ({ number: n })))
if (a[0] === 'pr' && a[1] === 'view') { const pr = f.prs[a[2]]; if (!pr) { process.stderr.write('not found'); process.exit(1) } raus(pr) }
if (a[0] === 'api') {
  if (f.schreibFehler) { process.stderr.write('403'); process.exit(1) }
  const felder = Object.fromEntries(a.filter((_, i) => a[i - 1] === '-f').map((x) => x.split(/=(.*)/s).slice(0, 2)))
  fs.appendFileSync(process.env.GH_LOG, JSON.stringify({ pfad: a[3], ...felder }) + '\\n')
  raus({})
}
process.stderr.write('unbekannt: ' + a.join(' ')); process.exit(2)
`

const ordner: string[] = []
afterEach(() => { for (const o of ordner.splice(0)) rmSync(o, { recursive: true, force: true }) })

const PFLICHT_CI = ['Forbidden Terms Guard', 'Unit Tests', 'Build', 'E2E Tests (mobile-sm)', 'E2E Tests (mobile-md)', 'E2E Tests (tablet-portrait)', 'E2E Tests (desktop)', 'E2E Tests (desktop-webkit)']
const gruen = (namen: string[]) => namen.map((name) => ({ name, conclusion: 'success', url: `https://x/job/${name}` }))
const lauf = (id: number, conclusion: string, sha = `${String(id)}`.padEnd(40, 'a')) => ({ databaseId: id, conclusion, headSha: sha, url: `https://x/run/${String(id)}` })

interface Fixture {
  runs: Record<string, ReturnType<typeof lauf>[]>
  jobs: Record<string, { name: string; conclusion: string; url: string }[]>
  offen: number[]
  prs: Record<string, { headRefOid: string; labels: { name: string }[]; state: string }>
  suche: Record<string, number[]>
  fehler?: string[]
  schreibFehler?: boolean
}

/** Alles grün: je Pflicht-Workflow ein grüner Lauf, zwei offene PRs. */
function grundFixture(): Fixture {
  return {
    runs: { CI: [lauf(1, 'success')], 'E2E Cloud': [lauf(2, 'success')], 'CodeQL Security Scan': [lauf(3, 'success')], 'Visual Regression': [lauf(4, 'success')] },
    jobs: {
      1: [...gruen(PFLICHT_CI), { name: 'E2E Tests (cockpit-390x664)', conclusion: 'success', url: 'u' }],
      2: gruen(['Cloud E2E Tests (lokaler Supabase-Stack)']), 3: gruen(['Analyze (javascript-typescript)']), 4: gruen(['Visual Regression (Playwright-Container)']),
    },
    offen: [10, 11],
    prs: { 10: { headRefOid: 'k10', labels: [], state: 'OPEN' }, 11: { headRefOid: 'k11', labels: [], state: 'OPEN' } },
    suche: {},
  }
}

function ampel(f: Fixture, env: Record<string, string>) {
  const o = mkdtempSync(join(tmpdir(), 'main-ampel-'))
  ordner.push(o)
  writeFileSync(join(o, 'gh'), STUB)
  chmodSync(join(o, 'gh'), 0o755)
  writeFileSync(join(o, 'fixture.json'), JSON.stringify(f))
  const log = join(o, 'status.jsonl')
  const r = spawnSync('node', [SKRIPT], {
    encoding: 'utf8',
    env: { PATH: `${o}:${process.env.PATH ?? ''}`, GH_FIXTURE: join(o, 'fixture.json'), GH_LOG: log, REPO: 'o/r', ...env },
  })
  const status = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((z) => JSON.parse(z) as Record<string, string>) : []
  return { code: r.status, aus: `${r.stdout}${r.stderr}`, status }
}

const AUF_MAIN = { EREIGNIS: 'workflow_run', LAUF_BRANCH: 'main', LAUF_PRS: '[]' }

describe('@TA-022 Main-Ampel: rot auf dem Hauptzweig hält weitere Merges an', () => {
  it('@TA-022 eine rote Pflicht-Prüfung auf main: jeder offene PR bekommt failure mit Link auf den roten Job', () => {
    const f = grundFixture()
    f.jobs[1] = f.jobs[1].map((j) => (j.name === 'Unit Tests' ? { ...j, conclusion: 'failure' } : j))
    const r = ampel(f, AUF_MAIN)
    expect(r.code, r.aus).toBe(0)
    expect(r.status.map((s) => [s.pfad, s.state])).toEqual([['repos/o/r/statuses/k10', 'failure'], ['repos/o/r/statuses/k11', 'failure']])
    expect(r.status[0].context).toBe('Main-Ampel (Stopp-Regel)')
    expect(r.status[0].description).toContain('Hauptzweig rot: Unit Tests')
    expect(r.status[0].target_url).toBe('https://x/job/Unit Tests')
  })

  it('@TA-022 Gegenbeispiel: ein PR mit Label main-reparatur darf trotzdem durch', () => {
    const f = grundFixture()
    f.jobs[3] = [{ name: 'Analyze (javascript-typescript)', conclusion: 'failure', url: 'https://x/job/a' }]
    f.prs[11].labels = [{ name: 'main-reparatur' }]
    const r = ampel(f, AUF_MAIN)
    expect(r.status.map((s) => s.state)).toEqual(['failure', 'success'])
    expect(r.status[1].description).toContain('Reparatur-PR')
  })

  it('@TA-022 alle Pflicht-Prüfungen wieder grün: success für alle PRs', () => {
    const r = ampel(grundFixture(), AUF_MAIN)
    expect(r.status.map((s) => [s.pfad, s.state, s.description])).toEqual([
      ['repos/o/r/statuses/k10', 'success', 'Hauptzweig grün'], ['repos/o/r/statuses/k11', 'success', 'Hauptzweig grün'],
    ])
  })

  it('@TA-022 ein abgebrochener Lauf zählt nicht, es gilt der letzte abgeschlossene davor (hier rot)', () => {
    const f = grundFixture()
    f.runs.CI = [lauf(9, 'cancelled'), lauf(1, 'failure')]
    f.jobs[1] = f.jobs[1].map((j) => (j.name === 'Build' ? { ...j, conclusion: 'failure' } : j))
    const r = ampel(f, AUF_MAIN)
    expect(r.status.every((s) => s.state === 'failure')).toBe(true)
    expect(r.status[0].description).toContain('Build')
  })

  it('@TA-022 Gegenbeispiel: ein roter Zusatz-Job ohne Pflicht (cockpit-390x664) und der Schema-Abgleich zählen nicht', () => {
    const f = grundFixture()
    f.jobs[1] = f.jobs[1].map((j) => (j.name === 'E2E Tests (cockpit-390x664)' ? { ...j, conclusion: 'failure' } : j))
    f.runs['Supabase Schema Drift Check'] = [lauf(7, 'failure')]
    const r = ampel(f, AUF_MAIN)
    expect(r.status.every((s) => s.state === 'success')).toBe(true)
    expect(r.aus).not.toContain('Supabase Schema Drift Check')
  })

  it('@TA-022 schlägt die Abfrage bei GitHub fehl, setzt die Ampel keinen (grünen) Status und endet rot', () => {
    const f = grundFixture()
    f.fehler = ['run list -R o/r --workflow CodeQL']
    const r = ampel(f, AUF_MAIN)
    expect(r.code).toBe(1)
    expect(r.status).toEqual([])
    expect(r.aus).toContain('kein Status gesetzt')
  })

  it('@TA-022 ein PR, der zwischen Liste und Abfrage geschlossen wurde, bricht die Schleife nicht ab', () => {
    const f = grundFixture()
    f.offen = [10, 99, 11]
    const r = ampel(f, AUF_MAIN)
    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('PR #99 nicht lesbar')
    expect(r.status.map((s) => s.pfad)).toEqual(['repos/o/r/statuses/k10', 'repos/o/r/statuses/k11'])
  })

  it('@TA-022 Fork-PR: der Lauf auf seinem Branch nennt keine PRs, die Ampel findet ihn über den Kopf-Commit', () => {
    const f = grundFixture()
    f.suche = { kopf77: [11] }
    const r = ampel(f, { EREIGNIS: 'workflow_run', LAUF_BRANCH: 'fork-zweig', LAUF_PRS: '[]', LAUF_SHA: 'kopf77' })
    expect(r.status.map((s) => [s.pfad, s.state])).toEqual([['repos/o/r/statuses/k11', 'success']])
  })

  it('@TA-022 pull_request-Lauf ohne Schreibrecht (Fork, Dependabot): Warnung statt Abbruch', () => {
    const f = grundFixture()
    f.schreibFehler = true
    const r = ampel(f, { EREIGNIS: 'pull_request', PR_NUMMER: '10' })
    expect(r.code, r.aus).toBe(0)
    expect(r.aus).toContain('Status für PR #10 nicht gesetzt')
  })

  it('@TA-022 jede Pflicht-Prüfung läuft auch nach jedem Merge auf dem Hauptzweig (push: main ohne Pfadfilter)', () => {
    for (const datei of ['ci.yml', 'e2e-cloud.yml', 'codeql.yml', 'visual.yml']) {
      const push = block(block(readFileSync(join(WORKFLOWS, datei), 'utf8'), 'on', 0).join('\n'), 'push', 2)
      expect(push.join('\n'), datei).toMatch(/branches: \[[^\]]*\bmain\b/)
      expect(push.some((z) => z.trim().startsWith('paths')), datei).toBe(false)
    }
    const laeufe = block(readFileSync(join(WORKFLOWS, 'main-ampel.yml'), 'utf8'), 'workflows', 4).slice(1).map((z) => z.trim().replace(/^- /, ''))
    expect(laeufe.sort()).toEqual(['CI', 'CodeQL Security Scan', 'E2E Cloud', 'Visual Regression'])
  })
})
