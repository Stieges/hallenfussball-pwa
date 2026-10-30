#!/usr/bin/env node
// Vor-Push-Prüfung wie die CI (@TA-019, @TA-020), aufgerufen von .husky/pre-push.
//
// 1. Neuesten Hauptzweig holen (git fetch <remote> main), den hochzuladenden Commit damit zusammenführen – nur im
//    Objektspeicher (git merge-tree); Arbeitsbaum, Index und Branch bleiben unberührt. Konflikt → Abbruch mit Dateien.
// 2. Das Ergebnis in einer temporären Arbeitskopie prüfen (dort gibt es keine .env.local, wie in der CI):
//    Design-Token- und Terminologie-Gleichlauf, Lint, Build (mit leeren VITE_SUPABASE_*), Szenario-Prüfung gegen den
//    Hauptzweig, Härtetest der visuellen Messung (nur bei Änderungen an App oder Messskript) und die Playwright-Specs
//    der geänderten Bereiche im Projekt desktop ohne Datenbank (Vorschau des Builds, wie der CI-Job).
// 3. Jeder Schritt hat eine Zeitgrenze; Überschreiten bricht ab und nennt Schritt und Grenze.
//
// Kein Schritt braucht --no-verify: Löschen eines Branches und Tags laufen ohne Prüfung durch, ein Stand ohne neue
// Commits ebenso. Zeitgrenze des Playwright-Laufs: VOR_PUSH_E2E_MINUTEN (Standard 15).
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { haertetestNoetig, waehleSpecs } from './auswahl.mjs'
import { geaenderteDateien, git, ohneGitUmgebung, probeArbeitskopie, probeStand } from './zusammenfuehren.mjs'

const NULL_SHA = /^0+$/
const MIN = 60_000

/** Liest die Zeilen, die git dem pre-push-Hook auf stdin gibt: <lokale ref> <lokaler sha> <entfernte ref> <entfernter sha>. */
export function zuPruefendeCommits(eingabe) {
  const shas = []
  for (const zeile of eingabe.split('\n')) {
    const [lokaleRef, sha, entfernteRef] = zeile.trim().split(/\s+/)
    if (!sha || NULL_SHA.test(sha)) continue // Branch auf dem Server löschen
    if ((entfernteRef ?? lokaleRef ?? '').startsWith('refs/tags/')) continue
    if (!shas.includes(sha)) shas.push(sha)
  }
  return shas
}

function freierPort() {
  return new Promise((ok, fehler) => {
    const s = createServer()
    s.once('error', fehler)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => { ok(port) })
    })
  })
}

const dauer = (ms) => `${Math.floor(ms / 60_000)}:${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')} min`

/** Führt einen Schritt aus; Ausgabe läuft durch. Zeitgrenze beendet die ganze Prozessgruppe. */
function schritt(name, befehl, args, { cwd, env = {}, grenzeMs }) {
  const start = Date.now()
  console.log(`\n▶ ${name}  (${[befehl, ...args].join(' ')}; Grenze ${dauer(grenzeMs)})`)
  return new Promise((ok) => {
    const p = spawn(befehl, args, { cwd, env: { ...ohneGitUmgebung(), ...env }, stdio: ['ignore', 'inherit', 'inherit'], detached: true })
    let ueberzogen = false
    const uhr = setTimeout(() => {
      ueberzogen = true
      try { process.kill(-p.pid, 'SIGTERM') } catch { /* schon beendet */ }
      setTimeout(() => { try { process.kill(-p.pid, 'SIGKILL') } catch { /* schon beendet */ } }, 10_000).unref()
    }, grenzeMs)
    p.on('close', (code) => {
      clearTimeout(uhr)
      const ms = Date.now() - start
      ok({ name, ok: code === 0 && !ueberzogen, code, ueberzogen, ms, grenzeMs })
    })
  })
}

async function main() {
  const [remote = 'origin'] = process.argv.slice(2)
  const cwd = git(process.cwd(), ['rev-parse', '--show-toplevel']).stdout.trim()
  let eingabe = ''
  if (!process.stdin.isTTY) for await (const teil of process.stdin) eingabe += teil
  const commits = zuPruefendeCommits(eingabe)
  if (commits.length === 0) {
    console.log('vor-push: nichts zu prüfen (Löschen oder Tag).')
    return 0
  }

  const gesamtStart = Date.now()
  console.log(`vor-push: hole ${remote}/main …`)
  git(cwd, ['fetch', '--quiet', remote, 'main'])
  const basis = git(cwd, ['rev-parse', `refs/remotes/${remote}/main`]).stdout.trim()

  for (const sha of commits) {
    const geaendert = geaenderteDateien(cwd, sha, basis)
    if (geaendert.length === 0) {
      console.log(`vor-push: ${sha.slice(0, 8)} bringt gegenüber ${remote}/main nichts Neues, keine Prüfung nötig.`)
      continue
    }
    const stand = probeStand(cwd, sha, basis)
    if (stand.art === 'konflikt') {
      console.error(`\n✖ vor-push: ${sha.slice(0, 8)} lässt sich nicht konfliktfrei mit ${remote}/main (${basis.slice(0, 8)}) zusammenführen.`)
      console.error(`  Dateien mit Konflikt:\n${stand.konflikte.map((d) => `   - ${d}`).join('\n')}`)
      console.error(`  Lösung: git merge ${remote}/main (kein Rebase), Konflikte lösen, committen, erneut pushen.`)
      return 1
    }
    console.log(stand.art === 'aktuell'
      ? `vor-push: ${sha.slice(0, 8)} enthält ${remote}/main schon, geprüft wird der Commit selbst.`
      : `vor-push: ${sha.slice(0, 8)} + ${remote}/main ${basis.slice(0, 8)} → Probe-Commit ${stand.commit.slice(0, 8)} (Arbeitsbaum unberührt).`)

    const { ziel, aufraeumen } = probeArbeitskopie(cwd, stand.commit)
    const abbruch = () => { aufraeumen(); process.exit(130) }
    process.once('SIGINT', abbruch)
    process.once('SIGTERM', abbruch)
    const ergebnisse = []
    try {
      const leer = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }
      const plan = [
        ['Design-Token-Gleichlauf', 'npm', ['run', '--silent', 'tokens:check'], {}, 5 * MIN],
        ['Terminologie-Gleichlauf', 'npm', ['run', '--silent', 'terms:check'], {}, 5 * MIN],
        // Lint gemessen 3:39 min (Last ~15) bis 10:58 min (Last ~35, 31.10.); Grenze mit Reserve gegen Hängen, nicht gegen Last.
        ['Lint', 'npm', ['run', '--silent', 'lint'], {}, 25 * MIN],
        [stand.art === 'aktuell' ? 'Build' : 'Build nach dem Zusammenführen', 'npm', ['run', '--silent', 'build'], leer, 15 * MIN],
        ['Szenario-Prüfung gegen den Hauptzweig', 'npm', ['run', '--silent', 'test:scenarios', '--', '--base', basis], {}, 5 * MIN],
      ]
      if (haertetestNoetig(geaendert)) {
        plan.push(['Härtetest visuelle Messung', 'npm', ['run', '--silent', 'test:visual-metrics'], leer, 20 * MIN])
      } else {
        console.log('vor-push: Härtetest übersprungen (keine Änderung an App oder Messskript).')
      }
      const alleSpecs = git(ziel, ['ls-files', 'tests/e2e']).stdout.split('\n').filter(Boolean)
      const auswahl = waehleSpecs(geaendert, alleSpecs, (p) => readFileSync(join(ziel, p), 'utf8'))
      if (auswahl.specs.length > 0) {
        console.log(`vor-push: ${String(auswahl.specs.length)} Playwright-Specs gewählt:`)
        for (const s of auswahl.specs) console.log(`   - ${s}  ← ${auswahl.gruende.get(s).join('; ')}`)
        const minuten = Number(process.env.VOR_PUSH_E2E_MINUTEN ?? 15)
        const port = await freierPort()
        plan.push(['Playwright desktop (ohne Datenbank, geänderte Bereiche)', 'npx',
          ['playwright', 'test', '--project=desktop', `--global-timeout=${String(minuten * MIN)}`, '--reporter=line', ...auswahl.specs],
          // Wie der CI-Job: Vorschau des eben gebauten dist/ (gebaut mit leeren VITE_SUPABASE_*), freier Port statt 3000,
          // ohne den zweiten Server gegen den lokalen Supabase-Stack (E2E_OHNE_CLOUD_SERVER, playwright.config.ts).
          { ...leer, CI: 'true', CI_E2E_USE_PREVIEW: 'true', PORT: String(port), E2E_OHNE_CLOUD_SERVER: '1' },
          // Reserve für Start und Abbau des Vorschau-Servers: so lang wie der Lauf selbst, höchstens 2 Minuten.
          minuten * MIN + Math.min(2 * MIN, minuten * MIN)])
      } else {
        console.log('vor-push: keine Playwright-Specs gewählt (keine Änderung an App oder Specs).')
      }

      for (const [name, befehl, args, env, grenzeMs] of plan) {
        const e = await schritt(name, befehl, args, { cwd: ziel, env, grenzeMs })
        ergebnisse.push(e)
        if (!e.ok) break
      }
    } finally {
      process.removeListener('SIGINT', abbruch)
      process.removeListener('SIGTERM', abbruch)
      aufraeumen()
    }

    console.log('\nvor-push: Zusammenfassung')
    for (const e of ergebnisse) console.log(`  ${e.ok ? '✓' : '✖'} ${e.name}  ${dauer(e.ms)}${e.ueberzogen ? `  ZEITGRENZE ${dauer(e.grenzeMs)} ÜBERSCHRITTEN, abgebrochen` : ''}`)
    console.log(`  gesamt ${dauer(Date.now() - gesamtStart)}`)
    const rot = ergebnisse.find((e) => !e.ok)
    if (rot) {
      console.error(`\n✖ vor-push: Schritt „${rot.name}“ ${rot.ueberzogen ? `hat seine Zeitgrenze (${dauer(rot.grenzeMs)}) überschritten` : 'ist rot'} – nicht hochgeladen.`)
      if (stand.art === 'zusammengefuehrt') console.error(`  Geprüft wurde der Stand nach dem Zusammenführen mit ${remote}/main; lokal nachstellen: git merge ${remote}/main`)
      return 1
    }
  }
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => { process.exit(code) }, (err) => {
    console.error(`✖ vor-push: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
