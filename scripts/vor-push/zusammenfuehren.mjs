// Vor-Push-Prüfung (@TA-019): den hochzuladenden Stand mit dem Hauptzweig zusammenführen, OHNE Arbeitsbaum, Index
// oder Branch des Umsetzers anzufassen. `git merge-tree --write-tree` (ab Git 2.38) rechnet das Ergebnis nur im
// Objektspeicher; `git commit-tree` macht daraus einen losen Commit, den eine eigene, temporäre Arbeitskopie auscheckt.
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Umgebung ohne GIT_*-Variablen: ein Hook bekommt u. a. GIT_DIR gesetzt; in der temporären Arbeitskopie würde git
 * damit Stand und HEAD des Aufrufers lesen statt den Probe-Commit.
 */
export function ohneGitUmgebung(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('GIT_')))
}

/**
 * git ohne Identitäts- und Signier-Abhängigkeit; Fehler werfen mit stderr. `timeoutMs` beendet git nach der Frist
 * (Fehler mit `zeitgrenze: true`), z. B. für `fetch` bei hängender Verbindung.
 */
export function git(cwd, args, { erlaubt = [0], timeoutMs } = {}) {
  const r = spawnSync('git', ['-c', 'user.name=vor-push', '-c', 'user.email=vor-push@localhost', '-c', 'commit.gpgsign=false', ...args], { cwd, env: ohneGitUmgebung(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, killSignal: 'SIGKILL' })
  if (r.error && r.error.code === 'ETIMEDOUT') throw Object.assign(new Error(`git ${args.join(' ')}: Zeitgrenze überschritten`), { zeitgrenze: true })
  if (r.error) throw r.error
  if (!erlaubt.includes(r.status)) throw new Error(`git ${args.join(' ')} (Exit ${String(r.status)}): ${r.stderr.trim()}`)
  return r
}

const PRAEFIX = 'vor-push-'

/** Löst die Verknüpfung auf die echten node_modules, damit kein Aufräumschritt hineingreift. */
function loeseVerknuepfung(ordner) {
  const verknuepfung = join(ordner, 'node_modules')
  try {
    if (lstatSync(verknuepfung).isSymbolicLink()) unlinkSync(verknuepfung)
  } catch {
    // keine Verknüpfung
  }
}

/**
 * Arbeitskopien früherer Läufe, die liegen geblieben sind (SIGKILL, Absturz): nur eigene (`vor-push-*` im Temp-Ordner,
 * gehört diesem Benutzer, ist eine git-Arbeitskopie mit `.git`-Datei) und älter als `alterMs`. Danach `git worktree prune`.
 */
export function alteArbeitskopienAufraeumen(cwd, { ordner = tmpdir(), alterMs = 6 * 60 * 60 * 1000, jetzt = Date.now() } = {}) {
  const geraeumt = []
  let namen = []
  try { namen = readdirSync(ordner) } catch { return geraeumt }
  for (const name of namen) {
    if (!name.startsWith(PRAEFIX)) continue
    const pfad = join(ordner, name)
    try {
      const st = statSync(pfad)
      const eigen = typeof process.getuid !== 'function' || st.uid === process.getuid()
      if (!st.isDirectory() || !eigen || jetzt - st.mtimeMs < alterMs) continue
      if (!lstatSync(join(pfad, '.git')).isFile()) continue
      loeseVerknuepfung(pfad)
      rmSync(pfad, { recursive: true, force: true })
      geraeumt.push(pfad)
    } catch {
      // nicht lesbar oder schon weg: liegen lassen
    }
  }
  if (geraeumt.length > 0) {
    git(cwd, ['worktree', 'prune'], { erlaubt: [0, 128] })
    console.log(`vor-push: ${String(geraeumt.length)} liegen gebliebene Arbeitskopien früherer Läufe entfernt.`)
  }
  return geraeumt
}

/** Geänderte Pfade des Branches seit dem gemeinsamen Vorfahren mit der Basis (wie die Dateiliste eines PRs). */
export function geaenderteDateien(cwd, sha, basis) {
  const vorfahr = git(cwd, ['merge-base', sha, basis]).stdout.trim()
  return git(cwd, ['diff', '--name-only', '--no-renames', vorfahr, sha]).stdout.split('\n').filter(Boolean)
}

/**
 * Probe-Stand für `sha` gegen `basis`.
 * - `aktuell`: die Basis ist schon enthalten, geprüft wird `sha` selbst.
 * - `zusammengefuehrt`: loser Merge-Commit (Eltern `sha`, `basis`), den die CI eines PRs ebenso bauen würde.
 * - `konflikt`: Dateien, die sich nicht automatisch zusammenführen lassen.
 */
export function probeStand(cwd, sha, basis) {
  const istVorfahr = git(cwd, ['merge-base', '--is-ancestor', basis, sha], { erlaubt: [0, 1] }).status === 0
  if (istVorfahr) return { art: 'aktuell', commit: sha }
  const r = git(cwd, ['merge-tree', '--write-tree', '--name-only', '--no-messages', sha, basis], { erlaubt: [0, 1] })
  const zeilen = r.stdout.split('\n').filter(Boolean)
  if (r.status === 1) return { art: 'konflikt', konflikte: [...new Set(zeilen.slice(1))] }
  const baum = zeilen[0]
  const commit = git(cwd, ['commit-tree', baum, '-p', sha, '-p', basis, '-m', 'vor-push: Probe-Zusammenführung mit dem Hauptzweig']).stdout.trim()
  return { art: 'zusammengefuehrt', commit }
}

/**
 * Checkt `commit` in eine temporäre Arbeitskopie aus (losgelöst, ohne Branch) und verlinkt `node_modules` des Aufrufers.
 * Liefert den Pfad und eine Aufräum-Funktion, die die Arbeitskopie wieder abmeldet und löscht.
 */
export function probeArbeitskopie(cwd, commit, { nodeModules = join(cwd, 'node_modules') } = {}) {
  const ziel = mkdtempSync(join(tmpdir(), PRAEFIX))
  git(cwd, ['worktree', 'add', '--detach', '--quiet', ziel, commit])
  if (existsSync(nodeModules)) symlinkSync(nodeModules, join(ziel, 'node_modules'), 'dir')
  let erledigt = false
  const aufraeumen = () => {
    if (erledigt) return
    erledigt = true
    // Erst die Verknüpfung lösen, damit kein Aufräumschritt je in die echten node_modules greift.
    loeseVerknuepfung(ziel)
    git(cwd, ['worktree', 'remove', '--force', ziel], { erlaubt: [0, 128] })
    rmSync(ziel, { recursive: true, force: true })
    git(cwd, ['worktree', 'prune'], { erlaubt: [0, 128] })
  }
  return { ziel, aufraeumen }
}
