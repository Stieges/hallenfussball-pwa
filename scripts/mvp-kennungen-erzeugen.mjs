#!/usr/bin/env node
// A-09/F7: erzeugt tests/meta/mvp-kennungen.json aus der MVP-Markierung am Szenario.
//
// Quelle ist `anf.py mvp --json` des Anforderungs-Werkzeugs (maßgeblich ist die Klasse am Szenario):
//   {klasse, soll, kennungen: [...], je_record: {record: anzahl}, zahlen}
// docs/ liegt nicht im Git und fehlt in CI und Worktrees; deshalb wird die erzeugte JSON committet
// und die CI liest nur sie. Die Ausgabe nennt die Kennungen je Record in der Reihenfolge von je_record.
//
// Aufruf (eine Quelle waehlen):
//   node scripts/mvp-kennungen-erzeugen.mjs --repo <Hauptrepo>      (oder Umgebungsvariable HAUPTREPO_PFAD)
//   node scripts/mvp-kennungen-erzeugen.mjs --anf-json <datei.json> (Ausgabe von anf.py mvp --json)
// Optionen: [--out tests/meta/mvp-kennungen.json]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const out = opt('--out') ?? 'tests/meta/mvp-kennungen.json'
const repo = opt('--repo') ?? process.env.HAUPTREPO_PFAD
const jsonPfad = opt('--anf-json')

let roh
if (jsonPfad) {
  roh = JSON.parse(readFileSync(jsonPfad, 'utf8'))
} else if (repo) {
  roh = JSON.parse(
    execFileSync('python3', [resolve(repo, 'docs/anforderungen/_tools/anf.py'), 'mvp', '--json'], { encoding: 'utf8', cwd: resolve(repo) }),
  )
} else {
  console.error('Aufruf: node scripts/mvp-kennungen-erzeugen.mjs --repo <Hauptrepo> | --anf-json <datei> [--out <pfad>]')
  process.exit(1)
}

if (roh.klasse !== 'mvp') throw new Error(`Klasse "${roh.klasse}" statt "mvp"`)
const alle = roh.kennungen
if (new Set(alle).size !== alle.length) throw new Error('Doppelte Kennung in der Ausgabe')
if (alle.length !== roh.soll) throw new Error(`Ausgabe nennt soll ${roh.soll}, hat aber ${alle.length} Kennungen`)

// Kennungen sind je Record zusammenhaengend; je_record gibt die Laengen in derselben Reihenfolge.
const records = {}
let pos = 0
for (const [rec, anzahl] of Object.entries(roh.je_record)) {
  if (anzahl === 0) continue
  records[rec] = alle.slice(pos, pos + anzahl)
  pos += anzahl
}
if (pos !== alle.length) throw new Error(`je_record summiert auf ${pos}, Kennungen: ${alle.length}`)
const praefixVon = new Map()
for (const [rec, ids] of Object.entries(records)) {
  for (const id of ids) {
    const praefix = id.split('-')[0]
    if (praefixVon.has(praefix) && praefixVon.get(praefix) !== rec) {
      throw new Error(`Praefix ${praefix} in zwei Records (${praefixVon.get(praefix)}, ${rec}) - Reihenfolge von je_record passt nicht`)
    }
    praefixVon.set(praefix, rec)
  }
}

const ergebnis = {
  _hinweis: 'Erzeugt von scripts/mvp-kennungen-erzeugen.mjs aus `anf.py mvp --json` (Klasse am Szenario). Nicht von Hand pflegen; soll aendert sich nur mit einer Entscheidung ueber den MVP-Schnitt.',
  quelle: 'anf.py mvp --json',
  soll: roh.soll,
  records,
}
writeFileSync(out, `${JSON.stringify(ergebnis, null, 1)}\n`)
console.log(`${out}: ${roh.soll} MVP-Kennungen in ${Object.keys(records).length} Records.`)
