// Vor-Push-Prüfung (@TA-019, Review #420 Fund 🟡2): passen die installierten node_modules zur package-lock.json des
// geprüften Stands? Die Probe-Arbeitskopie verlinkt die node_modules des Aufrufers; ändert der Branch oder der Hauptzweig
// seit dem letzten `npm ci` die Sperrdatei (z. B. Dependabot), prüften Lint, Build und Playwright sonst mit fremden
// Abhängigkeiten. Verglichen wird je Paket die Version aus der Sperrdatei des Probe-Commits mit der Liste, die npm beim
// Installieren schreibt (node_modules/.package-lock.json). Optionale Pakete (andere Plattform) dürfen fehlen.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { git } from './zusammenfuehren.mjs'

/** Abweichungen als Liste „paket: soll x, ist y“ (leer = passt). */
export function vergleicheSperrdateien(soll, ist) {
  const abw = []
  for (const [schluessel, eintrag] of Object.entries(soll.packages ?? {})) {
    if (!schluessel.startsWith('node_modules/')) continue
    const vorhanden = ist.packages?.[schluessel]
    if (!vorhanden) {
      if (eintrag.optional || eintrag.devOptional || eintrag.peer) continue
      abw.push(`${schluessel.slice('node_modules/'.length)}: soll ${String(eintrag.version)}, fehlt`)
    } else if (eintrag.version !== undefined && vorhanden.version !== eintrag.version) {
      abw.push(`${schluessel.slice('node_modules/'.length)}: soll ${String(eintrag.version)}, ist ${String(vorhanden.version)}`)
    }
  }
  return abw
}

/** null, wenn alles passt; sonst die Meldung für den Abbruch. Ohne package-lock.json im Commit gibt es nichts zu prüfen. */
export function pruefeAbhaengigkeiten(cwd, commit, { nodeModules = join(cwd, 'node_modules') } = {}) {
  const r = git(cwd, ['show', `${commit}:package-lock.json`], { erlaubt: [0, 128] })
  if (r.status !== 0) return null
  const versteckt = join(nodeModules, '.package-lock.json')
  const hinweis = 'Lösung: npm ci (nach git merge origin/main, falls der Hauptzweig die Sperrdatei geändert hat), dann erneut pushen.'
  if (!existsSync(versteckt)) return `node_modules passen nicht sicher zur package-lock.json (${versteckt} fehlt). ${hinweis}`
  const abw = vergleicheSperrdateien(JSON.parse(r.stdout), JSON.parse(readFileSync(versteckt, 'utf8')))
  if (abw.length === 0) return null
  const zeigen = abw.slice(0, 5).map((a) => `   - ${a}`).join('\n')
  return `installierte node_modules passen nicht zur package-lock.json des geprüften Stands (${String(abw.length)} Pakete):\n${zeigen}${abw.length > 5 ? '\n   - …' : ''}\n  ${hinweis}`
}
