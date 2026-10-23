#!/usr/bin/env node
// TM-1 (@TA-016): erzeugt tests/meta/befund-kennungen.json aus der Befundliste (lokal, gitignored).
//
// Die Befundliste (docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md) fehlt in CI und Worktrees; deshalb wird der Auszug
// committet und die CI (scripts/scenario-tests.mjs) prueft Verweise in Testtiteln nur gegen ihn. Der Auszug nennt
// NUR die Kennungen, die ein Test als Verweis traegt (kein Befundtext, keine uebrigen Befunde).
// Abbruch (Exit 1, nichts geschrieben) bei doppelter Kennung in der Befundliste oder bei einem Verweis im Test,
// den die Befundliste nicht kennt.
//
// Aufruf: node scripts/befund-kennungen-erzeugen.mjs [--befunde <pfad>] [--root <ordner>] [--scan src,tests,scripts]
//   [--out tests/meta/befund-kennungen.json]
// Befundliste: --befunde, Umgebungsvariable BEFUNDE_PFAD, <root>/docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md,
// dann dasselbe im Hauptrepo (git-common-dir/..).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { sammleStepModule, sammleTestDateien, stepBefunde, testTexte } from './lib/testtexte.mjs'

const REL = 'docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md'

function parseArgs(argv) {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const wert = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Wert fuer ${a} fehlt`)
      return v
    }
    if (a === '--befunde') o.befunde = wert()
    else if (a === '--root') o.root = wert()
    else if (a === '--scan') o.scan = wert().split(',')
    else if (a === '--out') o.out = wert()
    else throw new Error(`Unbekannte Option ${a}`)
  }
  return o
}

function kandidaten(opt, root) {
  const liste = [opt.befunde, process.env.BEFUNDE_PFAD, resolve(root, REL)].filter(Boolean)
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    liste.push(resolve(common, '..', REL))
  } catch {
    // kein Git-Repo: nur die anderen Kandidaten
  }
  return liste
}

/** IDs = erste Tabellenzelle jeder Tabellenzeile ("**" entfernt); Kopf- und Trennzeilen sind keine Kennungen. */
function befundIds(text) {
  const ids = []
  for (const zeile of text.split('\n')) {
    if (!zeile.startsWith('|')) continue
    const id = zeile.split('|')[1]?.replaceAll('**', '').trim() ?? ''
    if (/^(?:C-[A-Z0-9ÄÖÜ]+(?:-[A-Z0-9ÄÖÜ]+)*|DF-\d{3})$/.test(id)) ids.push(id)
  }
  return ids
}

function main() {
  const opt = parseArgs(process.argv.slice(2))
  const root = resolve(opt.root ?? process.cwd())
  const out = resolve(root, opt.out ?? 'tests/meta/befund-kennungen.json')
  const versucht = kandidaten(opt, root)
  const pfad = versucht.find((k) => existsSync(k))
  if (!pfad) throw new Error(`Befundliste nicht gefunden. Versucht: ${versucht.join(', ')}`)

  const ids = befundIds(readFileSync(pfad, 'utf8'))
  const doppelt = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
  if (doppelt.length > 0) throw new Error(`Doppelte Kennung in der Befundliste ${pfad}: ${doppelt.join(', ')}`)

  const genannt = new Map() // Kennung -> erste Fundstelle
  for (const datei of sammleTestDateien(root, opt.scan ?? ['src', 'tests', 'scripts'])) {
    for (const t of testTexte(readFileSync(datei, 'utf8'))) {
      for (const k of t.eigene) if (!genannt.has(k)) genannt.set(k, `${relative(root, datei)}:${t.zeile}`)
    }
  }
  // Durchstich: die Step-Module tragen ihre Befunde als Daten (`befunde: [...]`), nicht im Testtitel.
  for (const datei of sammleStepModule(root, opt.scan ?? ['src', 'tests', 'scripts'])) {
    for (const t of stepBefunde(readFileSync(datei, 'utf8'))) {
      if (!genannt.has(t.kennung)) genannt.set(t.kennung, `${relative(root, datei)}:${t.zeile}`)
    }
  }
  const bekannt = new Set(ids)
  const fehlend = [...genannt].filter(([k]) => !bekannt.has(k))
  if (fehlend.length > 0) {
    throw new Error(`Verweis in Tests, den die Befundliste nicht hat: ${fehlend.map(([k, stelle]) => `${k} (${stelle})`).join(', ')}`)
  }

  const ergebnis = {
    _hinweis: 'Erzeugt von scripts/befund-kennungen-erzeugen.mjs aus der lokalen Befundliste; nennt nur Kennungen, die ein Test als Verweis traegt. Nicht von Hand pflegen.',
    quelle: 'BEFUNDE-HEUTIGER-CODE.md (nur von Tests genannte Kennungen)',
    kennungen: [...genannt.keys()].sort(),
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(ergebnis, null, 1)}\n`)
  console.log(`${relative(root, out)}: ${ergebnis.kennungen.length} Kennungen (von ${ids.length} in der Befundliste).`)
}

try {
  main()
} catch (e) {
  console.error(`FEHLER: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
}
