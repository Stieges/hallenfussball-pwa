// Vor-Push-Prüfung wie die CI (@TA-019, @TA-020, @TA-025). Einstieg: scripts/vor-push/start.mjs (von .husky/pre-push).
// Dieses Modul führt nichts beim Laden aus; so kann kein Vergleich von Pfaden (Leerzeichen, Umlaut, Verknüpfung) die
// Prüfung still überspringen (Review #420, Fund 1).
//
// 1. Neuesten Hauptzweig holen (git fetch <remote> main, Zeitgrenze), den hochzuladenden Commit damit zusammenführen –
//    nur im Objektspeicher (git merge-tree); Arbeitsbaum, Index und Branch bleiben unberührt. Konflikt → Abbruch mit Dateien.
// 2. Passen die installierten node_modules nicht zur package-lock.json des geprüften Stands → Abbruch mit „npm ci“.
// 3. Das Ergebnis in einer temporären Arbeitskopie prüfen (keine .env.local, wie in der CI): Token-/Terminologie-
//    Gleichlauf, Lint, Build (leere VITE_SUPABASE_*), Szenario-Prüfung gegen den Hauptzweig, Härtetest der visuellen
//    Messung (nur bei Änderungen an App oder Messskript) und die Playwright-Specs der geänderten Bereiche im Projekt
//    desktop ohne Datenbank (Vorschau des Builds, wie der CI-Job).
// 4. Jeder Schritt hat eine Zeitgrenze. Strg-C, SIGTERM und SIGHUP beenden den laufenden Schritt samt Prozessgruppe und
//    räumen die Arbeitskopie weg; liegen gebliebene Arbeitskopien früherer Läufe räumt der nächste Start auf.
//
// Ohne Prüfung: Branch auf dem Server löschen, Tags, Stand ohne neue Commits. Sicherungs-Push (@TA-025):
// VOR_PUSH_MODUS=sicherung, nur auf Branches „sicherung/…“: Konflikt nur als Warnung, nur Lint und Typen, protokolliert.
// --no-verify ist nie nötig. Zeitgrenzen: VOR_PUSH_E2E_MINUTEN (Playwright, Standard 15), VOR_PUSH_FETCH_SEKUNDEN (60).
import { spawn } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { pruefeAbhaengigkeiten } from './abhaengigkeiten.mjs'
import { haertetestNoetig, waehleSpecs } from './auswahl.mjs'
import { alteArbeitskopienAufraeumen, geaenderteDateien, git, ohneGitUmgebung, probeArbeitskopie, probeStand } from './zusammenfuehren.mjs'

const NULL_SHA = /^0+$/
const MIN = 60_000
const SICHERUNG_PRAEFIX = 'refs/heads/sicherung/'

/** Zeilen von git an den pre-push-Hook: <lokale ref> <lokaler sha> <entfernte ref> <entfernter sha> (ohne Löschen, ohne Tags). */
export function zuPruefendeRefs(eingabe) {
  const refs = []
  for (const zeile of eingabe.split('\n')) {
    const [lokaleRef, sha, entfernteRef] = zeile.trim().split(/\s+/)
    if (!sha || NULL_SHA.test(sha)) continue // Branch auf dem Server löschen
    if ((entfernteRef ?? lokaleRef ?? '').startsWith('refs/tags/')) continue
    refs.push({ sha, ref: entfernteRef ?? lokaleRef ?? '' })
  }
  return refs
}

/** Die verschiedenen Commits der Eingabe. */
export function zuPruefendeCommits(eingabe) {
  return [...new Set(zuPruefendeRefs(eingabe).map((r) => r.sha))]
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

/** Was gerade läuft: der Schritt (eigene Prozessgruppe) und die Aufräum-Funktion der Arbeitskopie. */
const laufend = { kind: null, aufraeumen: null }

/** Beendet die Prozessgruppe des laufenden Schritts: erst SIGTERM, nach `fristMs` SIGKILL; wartet höchstens so lange. */
function beendeKind(fristMs = 5000) {
  const kind = laufend.kind
  if (!kind || kind.exitCode !== null || kind.signalCode !== null) return Promise.resolve()
  return new Promise((fertig) => {
    const hart = setTimeout(() => {
      try { process.kill(-kind.pid, 'SIGKILL') } catch { /* schon beendet */ }
      fertig()
    }, fristMs)
    kind.once('close', () => { clearTimeout(hart); fertig() })
    try { process.kill(-kind.pid, 'SIGTERM') } catch { clearTimeout(hart); fertig() }
  })
}

let abbruchLaeuft = false
/** Strg-C, SIGTERM, SIGHUP (Terminal zu): laufenden Schritt beenden, dann Arbeitskopie weg, Exit 130. */
async function abbruch(signal) {
  if (abbruchLaeuft) return
  abbruchLaeuft = true
  console.error(`\n✖ vor-push: abgebrochen (${signal}) – beende den laufenden Schritt und räume die Arbeitskopie weg.`)
  await beendeKind()
  laufend.aufraeumen?.()
  process.exit(130)
}

/** Führt einen Schritt in eigener Prozessgruppe aus; Ausgabe läuft durch. Zeitgrenze beendet die ganze Gruppe. */
function schritt(name, befehl, args, { cwd, env = {}, grenzeMs }) {
  const start = Date.now()
  console.log(`\n▶ ${name}  (${[befehl, ...args].join(' ')}; Grenze ${dauer(grenzeMs)})`)
  return new Promise((ok) => {
    const p = spawn(befehl, args, { cwd, env: { ...ohneGitUmgebung(), ...env }, stdio: ['ignore', 'inherit', 'inherit'], detached: true })
    laufend.kind = p
    let ueberzogen = false
    const uhr = setTimeout(() => {
      ueberzogen = true
      void beendeKind(10_000)
    }, grenzeMs)
    p.on('close', (code) => {
      clearTimeout(uhr)
      if (laufend.kind === p) laufend.kind = null
      ok({ name, ok: code === 0 && !ueberzogen, code, ueberzogen, ms: Date.now() - start, grenzeMs })
    })
  })
}

/** Remote-Name („origin“) oder Adresse? Für die Meldungen. */
const hauptzweigName = (remote) => (/[:/\\]/.test(remote) ? 'Hauptzweig' : `${remote}/main`)

function protokolliereSicherung(cwd, eintrag) {
  try {
    const common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']).stdout.trim()
    appendFileSync(join(common, 'vor-push-sicherung.log'), `${new Date().toISOString()} ${eintrag}\n`)
  } catch (e) {
    console.error(`vor-push: Protokoll der Sicherung nicht geschrieben (${e instanceof Error ? e.message : String(e)})`)
  }
}

export async function main(argv = process.argv.slice(2)) {
  const [remote = 'origin'] = argv
  const cwd = git(process.cwd(), ['rev-parse', '--show-toplevel']).stdout.trim()
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { void abbruch(s) })
  alteArbeitskopienAufraeumen(cwd)

  let eingabe = ''
  if (!process.stdin.isTTY) for await (const teil of process.stdin) eingabe += teil
  const refs = zuPruefendeRefs(eingabe)
  if (refs.length === 0) {
    console.log('vor-push: nichts zu prüfen (Löschen oder Tag).')
    return 0
  }

  const modus = process.env.VOR_PUSH_MODUS ?? ''
  if (modus !== '' && modus !== 'sicherung') {
    console.error(`✖ vor-push: unbekannter VOR_PUSH_MODUS „${modus}“ (erlaubt: sicherung).`)
    return 1
  }
  const sicherung = modus === 'sicherung'
  if (sicherung) {
    const fremd = refs.filter((r) => !r.ref.startsWith(SICHERUNG_PRAEFIX))
    if (fremd.length > 0) {
      console.error(`✖ vor-push: VOR_PUSH_MODUS=sicherung gilt nur für Branches „sicherung/…“, nicht für ${fremd.map((r) => r.ref).join(', ')}.`)
      return 1
    }
    console.log('\n⚠ vor-push: SICHERUNG – nicht geprüft wie die CI (nur Konflikt-Erkennung, Lint, Typen). Vor dem PR normal pushen.\n')
  }

  const gesamtStart = Date.now()
  const name = hauptzweigName(remote)
  console.log(`vor-push: hole ${name} …`)
  const fetchMs = Number(process.env.VOR_PUSH_FETCH_SEKUNDEN ?? 60) * 1000
  try {
    // Schreibt FETCH_HEAD (auch bei einer Adresse statt eines Remote-Namens) und bei Remote-Namen zusätzlich <remote>/main.
    git(cwd, ['fetch', '--quiet', remote, 'main'], { timeoutMs: fetchMs })
  } catch (e) {
    const zeit = e instanceof Error && e.zeitgrenze
    throw new Error(zeit
      ? `neuester Hauptzweig nicht abrufbar: ${remote} antwortet nicht (Zeitgrenze ${String(fetchMs / 1000)} s) – ohne Netz kein Hochladen.`
      : `neuester Hauptzweig nicht abrufbar (${e instanceof Error ? e.message : String(e)}).`)
  }
  const basis = git(cwd, ['rev-parse', 'FETCH_HEAD']).stdout.trim()

  for (const sha of [...new Set(refs.map((r) => r.sha))]) {
    const geaendert = geaenderteDateien(cwd, sha, basis)
    if (geaendert.length === 0) {
      console.log(`vor-push: ${sha.slice(0, 8)} bringt gegenüber ${name} nichts Neues, keine Prüfung nötig.`)
      continue
    }
    let stand = probeStand(cwd, sha, basis)
    if (stand.art === 'konflikt') {
      const liste = stand.konflikte.map((d) => `   - ${d}`).join('\n')
      if (!sicherung) {
        console.error(`\n✖ vor-push: ${sha.slice(0, 8)} lässt sich nicht konfliktfrei mit ${name} (${basis.slice(0, 8)}) zusammenführen.`)
        console.error(`  Dateien mit Konflikt:\n${liste}`)
        console.error(`  Lösung: git merge ${name} (kein Rebase), Konflikte lösen, committen, erneut pushen.`)
        return 1
      }
      console.log(`\n⚠ vor-push: WARNUNG – Konflikt mit ${name}; geprüft wird der Commit selbst.\n  Dateien mit Konflikt:\n${liste}`)
      stand = { art: 'aktuell', commit: sha, konflikt: true }
    }
    console.log(stand.art === 'aktuell'
      ? `vor-push: geprüft wird ${sha.slice(0, 8)} selbst${stand.konflikt ? '' : ` (enthält ${name} schon)`}.`
      : `vor-push: ${sha.slice(0, 8)} + ${name} ${basis.slice(0, 8)} → Probe-Commit ${stand.commit.slice(0, 8)} (Arbeitsbaum unberührt).`)

    const abweichung = pruefeAbhaengigkeiten(cwd, stand.commit)
    if (abweichung) {
      console.error(`\n✖ vor-push: ${abweichung}`)
      return 1
    }

    const { ziel, aufraeumen } = probeArbeitskopie(cwd, stand.commit)
    laufend.aufraeumen = aufraeumen
    const ergebnisse = []
    try {
      const leer = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }
      const plan = []
      if (sicherung) {
        // Lint gemessen 3:39 min (Last ~15) bis 10:58 min (Last ~35, 31.10.); Grenze mit Reserve gegen Hängen, nicht gegen Last.
        plan.push(['Lint', 'npm', ['run', '--silent', 'lint'], {}, 25 * MIN])
        plan.push(['Typen', 'npx', ['tsc', '--noEmit'], {}, 10 * MIN])
      } else {
        plan.push(['Design-Token-Gleichlauf', 'npm', ['run', '--silent', 'tokens:check'], {}, 5 * MIN])
        plan.push(['Terminologie-Gleichlauf', 'npm', ['run', '--silent', 'terms:check'], {}, 5 * MIN])
        plan.push(['Lint', 'npm', ['run', '--silent', 'lint'], {}, 25 * MIN])
        plan.push([stand.art === 'aktuell' ? 'Build' : 'Build nach dem Zusammenführen', 'npm', ['run', '--silent', 'build'], leer, 15 * MIN])
        plan.push(['Szenario-Prüfung gegen den Hauptzweig', 'npm', ['run', '--silent', 'test:scenarios', '--', '--base', basis], {}, 5 * MIN])
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
            // 2 Worker statt der 4 der CI: lokal laufen parallele Spuren (wie VITEST_MAX_WORKERS=2). Wiederholungen bleiben
            // wie in der CI (CI=true → 2); ein so bestandener Test steht in der Ausgabe als „flaky“ und bleibt sichtbar.
            ['playwright', 'test', '--project=desktop', '--workers=2', `--global-timeout=${String(minuten * MIN)}`, '--reporter=line', ...auswahl.specs],
            // Vorschau des eben gebauten dist/ (gebaut mit leeren VITE_SUPABASE_*), freier Port statt 3000,
            // ohne den zweiten Server gegen den lokalen Supabase-Stack (E2E_OHNE_CLOUD_SERVER, playwright.config.ts).
            { ...leer, CI: 'true', CI_E2E_USE_PREVIEW: 'true', PORT: String(port), E2E_OHNE_CLOUD_SERVER: '1' },
            // Reserve für Start und Abbau des Vorschau-Servers: so lang wie der Lauf selbst, höchstens 2 Minuten.
            minuten * MIN + Math.min(2 * MIN, minuten * MIN)])
        } else {
          console.log('vor-push: keine Playwright-Specs gewählt (keine Änderung an App oder Specs).')
        }
      }

      for (const [schrittName, befehl, args, env, grenzeMs] of plan) {
        const e = await schritt(schrittName, befehl, args, { cwd: ziel, env, grenzeMs })
        ergebnisse.push(e)
        if (!e.ok) break
      }
    } finally {
      laufend.aufraeumen = null
      aufraeumen()
    }

    console.log(`\nvor-push: Zusammenfassung${sicherung ? ' (SICHERUNG – nicht geprüft wie die CI)' : ''}`)
    for (const e of ergebnisse) console.log(`  ${e.ok ? '✓' : '✖'} ${e.name}  ${dauer(e.ms)}${e.ueberzogen ? `  ZEITGRENZE ${dauer(e.grenzeMs)} ÜBERSCHRITTEN, abgebrochen` : ''}`)
    console.log(`  gesamt ${dauer(Date.now() - gesamtStart)}`)
    const rot = ergebnisse.find((e) => !e.ok)
    if (sicherung) {
      const zielRefs = refs.filter((r) => r.sha === sha).map((r) => r.ref).join(',')
      protokolliereSicherung(cwd, `${zielRefs} ${sha} ${rot ? `rot:${rot.name}` : 'gruen'}${stand.konflikt ? ' konflikt' : ''}`)
    }
    if (rot) {
      console.error(`\n✖ vor-push: Schritt „${rot.name}“ ${rot.ueberzogen ? `hat seine Zeitgrenze (${dauer(rot.grenzeMs)}) überschritten` : 'ist rot'} – nicht hochgeladen.`)
      if (stand.art === 'zusammengefuehrt') console.error(`  Geprüft wurde der Stand nach dem Zusammenführen mit ${name}; lokal nachstellen: git merge ${name}`)
      return 1
    }
  }
  return 0
}

/** Für start.mjs: Exit-Code setzen, Fehler lesbar ausgeben. */
export function starte() {
  main().then((code) => { process.exit(code) }, (err) => {
    console.error(`✖ vor-push: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}

