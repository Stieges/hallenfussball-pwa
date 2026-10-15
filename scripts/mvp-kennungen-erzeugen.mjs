#!/usr/bin/env node
// A-09: erzeugt tests/meta/mvp-kennungen.json aus dem MVP-Schnitt der Anforderungen.
//
// Das Anforderungs-Werkzeug (docs/anforderungen/_tools/anf.py) kennt keine MVP-Klasse; die steht nur
// in docs/anforderungen/_generiert/MVP-SCHNITT.md, Abschnitt 2 "Tabelle je Record" (Spalte
// "MVP-Kennungen (Bereiche)", z. B. "FU-001-007, FU-009"). Dieses Skript expandiert die Bereiche
// und prueft sie gegen die Zahlen der Tabelle (je Record und Summe). Nachtraege nach dem Stand v4
// (Abschnitt "Nachtrag ...") sind Prosa und nicht maschinenlesbar - sie gehen erst mit einer
// Entscheidung ueber den Schnitt in die Liste ein (Soll aendern = Entscheidung, siehe @TA-006).
//
// Aufruf: node scripts/mvp-kennungen-erzeugen.mjs <MVP-SCHNITT.md> [--out tests/meta/mvp-kennungen.json]
//                                                 [--szenarien <szenarien.json>]
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const quelle = args.find((a) => !a.startsWith('--'))
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
if (!quelle) {
  console.error('Aufruf: node scripts/mvp-kennungen-erzeugen.mjs <MVP-SCHNITT.md> [--out <pfad>] [--szenarien <json>]')
  process.exit(1)
}
const out = opt('--out') ?? 'tests/meta/mvp-kennungen.json'

const text = readFileSync(quelle, 'utf8')
const start = text.indexOf('## 2 Tabelle je Record')
if (start < 0) throw new Error('Abschnitt "## 2 Tabelle je Record" nicht gefunden')
const ende = text.indexOf('\n## ', start + 5)
const zeilen = text.slice(start, ende < 0 ? undefined : ende).split('\n').filter((z) => z.startsWith('|'))

function expandiere(feld) {
  const ids = []
  for (const teil of feld.split(',').map((t) => t.trim()).filter((t) => t && t !== '–')) {
    const m = teil.match(/^([A-Z][A-Z0-9]*)-(\d+)(?:[–-](\d+))?$/)
    if (!m) throw new Error(`Bereich nicht lesbar: "${teil}"`)
    const [, praefix, von, bis] = m
    const breite = von.length
    for (let n = Number(von); n <= Number(bis ?? von); n++) ids.push(`${praefix}-${String(n).padStart(breite, '0')}`)
  }
  return ids
}

const records = {}
let summeTabelle = null
for (const z of zeilen) {
  const zellen = z.split('|').slice(1, -1).map((c) => c.trim())
  if (zellen.length < 6) continue
  const kopf = zellen[0].match(/^([a-z0-9-]+) \((\d+)\)$/)
  if (!kopf) {
    if (zellen[0].replace(/\*/g, '') === 'Summe') summeTabelle = Number(zellen[1].replace(/\*/g, ''))
    continue
  }
  const ids = expandiere(zellen[5])
  const erwartet = Number(zellen[1])
  if (ids.length !== erwartet) throw new Error(`${kopf[1]}: Tabelle nennt ${erwartet} MVP, Bereiche ergeben ${ids.length}`)
  records[kopf[1]] = ids
}
const alle = Object.values(records).flat()
if (new Set(alle).size !== alle.length) throw new Error('Doppelte Kennung ueber Records hinweg')
if (summeTabelle !== null && summeTabelle !== alle.length) {
  throw new Error(`Summenzeile nennt ${summeTabelle}, Bereiche ergeben ${alle.length}`)
}

const szenPfad = opt('--szenarien')
if (szenPfad) {
  const bekannt = new Set(JSON.parse(readFileSync(szenPfad, 'utf8')).map((s) => s.kennung))
  const unbekannt = alle.filter((k) => !bekannt.has(k))
  if (unbekannt.length > 0) throw new Error(`Nicht in szenarien.json: ${unbekannt.join(', ')}`)
  console.log(`Alle ${alle.length} Kennungen kommen in ${szenPfad} vor.`)
}

const ergebnis = {
  _hinweis: 'Erzeugt von scripts/mvp-kennungen-erzeugen.mjs aus MVP-SCHNITT.md Abschnitt 2 (Stand v4). Nicht von Hand pflegen; soll aendert sich nur mit einer Entscheidung ueber den MVP-Schnitt.',
  quelle: 'docs/anforderungen/_generiert/MVP-SCHNITT.md, Abschnitt 2',
  soll: alle.length,
  records,
}
writeFileSync(out, `${JSON.stringify(ergebnis, null, 1)}\n`)
console.log(`${out}: ${alle.length} MVP-Kennungen in ${Object.keys(records).length} Records.`)
