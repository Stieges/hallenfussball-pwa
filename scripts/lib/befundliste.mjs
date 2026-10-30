// Befundliste (docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md) finden und ihre Kennungen lesen (@TA-023, @TA-024).
// Die Liste ist lokal (docs/ ist gitignored): in der CI fehlt sie, in Arbeitskopien liegt sie im Hauptrepo.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const BEFUNDLISTE_REL = 'docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md'

/** Kandidaten in dieser Reihenfolge: --befunde, BEFUNDE_PFAD, <root>/docs/…, Hauptrepo (git-common-dir/..)/docs/…. */
export function befundlisteKandidaten(root, explizit) {
  const liste = [explizit, process.env.BEFUNDE_PFAD, resolve(root, BEFUNDLISTE_REL)].filter(Boolean)
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    liste.push(resolve(common, '..', BEFUNDLISTE_REL))
  } catch {
    // kein Git-Repo: nur die anderen Kandidaten
  }
  return liste
}

/** Pfad der Befundliste oder null (CI). Ein ausdrücklich genannter, fehlender Pfad ist ein Fehler. */
export function findeBefundliste(root, explizit) {
  if (explizit && !existsSync(explizit)) throw new Error(`Befundliste ${explizit} (--befunde) fehlt`)
  return befundlisteKandidaten(root, explizit).find((k) => existsSync(k)) ?? null
}

/** IDs = erste Tabellenzelle jeder Tabellenzeile ("**" entfernt); Kopf- und Trennzeilen sind keine Kennungen. */
export function befundIds(text) {
  const ids = []
  for (const zeile of text.split('\n')) {
    if (!zeile.startsWith('|')) continue
    const id = zeile.split('|')[1]?.replaceAll('**', '').trim() ?? ''
    if (/^(?:C-[A-Z0-9ÄÖÜ]+(?:-[A-Z0-9ÄÖÜ]+)*|DF-\d{3})$/.test(id)) ids.push(id)
  }
  return ids
}

/** Kennungen der Befundliste als Menge; doppelte Kennungen sind ein Fehler der Liste. */
export function leseBefundliste(pfad) {
  const ids = befundIds(readFileSync(pfad, 'utf8'))
  const doppelt = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
  return { bekannt: new Set(ids), doppelt }
}
