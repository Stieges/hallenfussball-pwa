#!/usr/bin/env node
// A-09 (@TA-006, @TA-007, @TA-008): hat jede MVP-Kennung einen Test?
//
// Aufruf: node scripts/scenario-tests.mjs [--task <ID>] [--strict] [--root <ordner>]
//   [--kennungen <pfad>] [--nachweis <pfad>] [--plan <bauplan.md>] [--scan src,tests,scripts]
//
// Rot (Exit 1) bei: Zahl der Kennungen != soll, doppelte oder fehlende Eintraege, mehr als `max`
// Nachweise aus der Generalprobe, Nachweis-Kennung ausserhalb der MVP-Liste. Kennungen ohne Test
// werden im MVP nur gemeldet; mit --strict (ab Woche 6 fuer abgenommene Aufgaben) sind sie rot.
// --task <ID> schraenkt auf die Kennungen der Zeile "Szenarien:" der Aufgabe im Bauplan ein.
//
// Gezaehlt wird eine Kennung nur, wenn sie in einem Testnamen (it/test/describe/step), im Titel
// oder in der each-Tabelle eines Tests steht - nicht in Kommentaren und nicht in sonstigen Strings.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const KENNUNG = /(?<![A-Za-z0-9])[A-Z][A-Z0-9]{0,3}-\d{3}(?!\d)/g
const TEST_DATEI = /\.(test|spec)\.(ts|tsx|mjs|js)$/
const AUFRUF = /\b(?:it|test|describe)((?:\.(?:each|skip|only|todo|concurrent|fails|sequential|step|for))*)\s*(?=[(`])/g

function parseArgs(argv) {
  const o = { strict: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const wert = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Wert fuer ${a} fehlt`)
      return v
    }
    if (a === '--strict') o.strict = true
    else if (a === '--task') o.task = wert()
    else if (a === '--root') o.root = wert()
    else if (a === '--kennungen') o.kennungen = wert()
    else if (a === '--nachweis') o.nachweis = wert()
    else if (a === '--plan') o.plan = wert()
    else if (a === '--scan') o.scan = wert().split(',')
    else throw new Error(`Unbekannte Option ${a}`)
  }
  return o
}

/** Entfernt Kommentare; Strings und Template-Literale bleiben unveraendert erhalten. */
function ohneKommentare(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (c === '/' && n === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      out += ' '
    } else if (c === "'" || c === '"' || c === '`') {
      const ende = stringEnde(src, i)
      out += src.slice(i, ende)
      i = ende
    } else {
      out += c
      i++
    }
  }
  return out
}

/** Index hinter dem schliessenden Anführungszeichen (Template-Ausdruecke ${...} bleiben im String). */
function stringEnde(src, start) {
  const q = src[start]
  let i = start + 1
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') i += 2
    else if (c === q) return i + 1
    else if (q === '`' && c === '$' && src[i + 1] === '{') {
      i = klammerEnde(src, i + 1, '{', '}')
    } else i++
  }
  return src.length
}

/** Index hinter der passenden schliessenden Klammer; Strings werden uebersprungen. */
function klammerEnde(src, start, auf, zu) {
  let tiefe = 0
  let i = start
  while (i < src.length) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      i = stringEnde(src, i)
      continue
    }
    if (c === auf) tiefe++
    else if (c === zu) {
      tiefe--
      if (tiefe === 0) return i + 1
    }
    i++
  }
  return src.length
}

function erstesStringLiteral(src, ab) {
  let i = ab
  while (i < src.length && /\s/.test(src[i])) i++
  if (src[i] === '(') i++
  while (i < src.length && /\s/.test(src[i])) i++
  if (src[i] === "'" || src[i] === '"' || src[i] === '`') return src.slice(i, stringEnde(src, i))
  return ''
}

/** Texte, in denen Kennungen als Test-Nachweis zaehlen: Testtitel und each-Tabellen. */
function testTexte(quelltext) {
  const src = ohneKommentare(quelltext)
  const texte = []
  AUFRUF.lastIndex = 0
  let m
  while ((m = AUFRUF.exec(src)) !== null) {
    const mods = m[1]
    const ab = AUFRUF.lastIndex
    if (mods.includes('.each') || mods.includes('.for')) {
      // it.each([...])('Titel', fn) bzw. it.each`tabelle`('Titel', fn)
      const tabelleEnde = src[ab] === '`' ? stringEnde(src, ab) : klammerEnde(src, ab, '(', ')')
      texte.push(src.slice(ab, tabelleEnde))
      texte.push(erstesStringLiteral(src, tabelleEnde))
    } else {
      texte.push(erstesStringLiteral(src, ab))
    }
  }
  return texte
}

function sammleTestDateien(root, scan) {
  const dateien = []
  const gehe = (ordner) => {
    for (const name of readdirSync(ordner)) {
      if (name === 'node_modules' || name === '.git' || name === 'coverage' || name === 'dist') continue
      const pfad = join(ordner, name)
      const st = statSync(pfad)
      if (st.isDirectory()) gehe(pfad)
      else if (TEST_DATEI.test(name)) dateien.push(pfad)
    }
  }
  for (const s of scan) {
    const ordner = resolve(root, s)
    if (existsSync(ordner)) gehe(ordner)
  }
  return dateien
}

function kennungenDerAufgabe(planPfad, task) {
  if (!existsSync(planPfad)) throw new Error(`Bauplan ${planPfad} fehlt (fuer --task)`)
  const zeilen = readFileSync(planPfad, 'utf8').split('\n')
  const kopf = zeilen.findIndex((z) => new RegExp(`^\\*\\*${task.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ *]`).test(z))
  if (kopf < 0) throw new Error(`Aufgabe ${task} im Bauplan nicht gefunden`)
  const ids = new Set()
  for (let i = kopf + 1; i < zeilen.length && !/^\*\*[A-Z]+-\d/.test(zeilen[i]) && !zeilen[i].startsWith('#'); i++) {
    if (!/\*\*Szenarien/.test(zeilen[i])) continue
    for (const k of zeilen[i].matchAll(/@([A-Z][A-Z0-9]{0,3}-\d{3})/g)) ids.add(k[1])
  }
  return ids
}

function main() {
  const opt = parseArgs(process.argv.slice(2))
  const root = resolve(opt.root ?? process.cwd())
  const kennPfad = opt.kennungen ?? resolve(root, 'tests/meta/mvp-kennungen.json')
  const nachPfad = opt.nachweis ?? resolve(root, 'tests/meta/nachweis-generalprobe.json')
  const fehler = []

  const liste = JSON.parse(readFileSync(kennPfad, 'utf8'))
  const recordVon = new Map()
  for (const [rec, ids] of Object.entries(liste.records)) {
    for (const id of ids) {
      if (recordVon.has(id)) fehler.push(`Kennung ${id} doppelt in der Liste (${recordVon.get(id)} und ${rec})`)
      recordVon.set(id, rec)
    }
  }
  if (recordVon.size !== liste.soll) {
    fehler.push(`Abweichung: Liste hat ${recordVon.size} MVP-Kennungen, soll ist ${liste.soll}`)
  }

  const nachweis = existsSync(nachPfad) ? JSON.parse(readFileSync(nachPfad, 'utf8')) : { max: 15, kennungen: [] }
  if (nachweis.kennungen.length > nachweis.max) {
    fehler.push(`Nachweise aus der Generalprobe: ${nachweis.kennungen.length} > Grenze ${nachweis.max}`)
  }
  for (const k of nachweis.kennungen) if (!recordVon.has(k)) fehler.push(`Nachweis ${k} ist keine MVP-Kennung`)

  const gefunden = new Set()
  const dateien = sammleTestDateien(root, opt.scan ?? ['src', 'tests', 'scripts'])
  for (const datei of dateien) {
    for (const t of testTexte(readFileSync(datei, 'utf8'))) {
      for (const k of t.matchAll(KENNUNG)) if (recordVon.has(k[0])) gefunden.add(k[0])
    }
  }

  let zuPruefen = [...recordVon.keys()]
  if (opt.task) {
    const ids = kennungenDerAufgabe(opt.plan ?? resolve(root, 'docs/superpowers/plans/2026-10-03-mvp-bauplan.md'), opt.task)
    zuPruefen = zuPruefen.filter((k) => ids.has(k))
    for (const k of ids) if (!recordVon.has(k)) console.log(`HINWEIS: ${k} (Aufgabe ${opt.task}) ist keine MVP-Kennung der Liste`)
  }
  const nachweisSet = new Set(nachweis.kennungen)
  const ohneTest = zuPruefen.filter((k) => !gefunden.has(k) && !nachweisSet.has(k))

  const gesamt = zuPruefen.length
  console.log(`MVP-Kennungen: ${gesamt}${opt.task ? ` (Aufgabe ${opt.task})` : ''}, soll ${liste.soll}`)
  console.log(`mit Test: ${zuPruefen.filter((k) => gefunden.has(k)).length}, mit Nachweis Generalprobe: ${zuPruefen.filter((k) => !gefunden.has(k) && nachweisSet.has(k)).length}, ohne Test: ${ohneTest.length}`)
  console.log(`(${dateien.length} Testdateien durchsucht in: ${(opt.scan ?? ['src', 'tests', 'scripts']).join(', ')})`)
  console.log('\nOhne Test je Record:')
  const je = new Map()
  for (const k of ohneTest) je.set(recordVon.get(k), [...(je.get(recordVon.get(k)) ?? []), k])
  for (const rec of Object.keys(liste.records)) {
    const von = zuPruefen.filter((k) => recordVon.get(k) === rec).length
    if (von === 0) continue
    const fehlend = je.get(rec) ?? []
    const namen = fehlend.length > 0 && fehlend.length <= 5 ? `  ${fehlend.join(', ')}` : ''
    console.log(`  ${rec.padEnd(34)} ${String(fehlend.length).padStart(4)} von ${String(von).padEnd(4)}${namen}`)
  }
  if (opt.task) console.log(`\nOhne Test (Aufgabe ${opt.task}): ${ohneTest.join(', ') || '-'}`)

  if (opt.strict && ohneTest.length > 0) fehler.push(`${ohneTest.length} MVP-Kennungen ohne Test (--strict)`)
  if (fehler.length > 0) {
    console.error('\nFEHLER:')
    for (const f of fehler) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log(opt.strict ? '\nOK: jede gepruefte Kennung hat einen Test.' : '\nOK (Bericht, Kennungen ohne Test sind im MVP nicht blockierend).')
}

try {
  main()
} catch (e) {
  console.error(`FEHLER: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
}
