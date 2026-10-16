#!/usr/bin/env node
// A-09 (@TA-006, @TA-007, @TA-008): hat jede MVP-Kennung einen Test?
//
// Aufruf: node scripts/scenario-tests.mjs [--task <ID>] [--strict] [--root <ordner>]
//   [--kennungen <pfad>] [--nachweis <pfad>] [--plan <bauplan.md> | Umgebungsvariable BAUPLAN_PFAD] [--scan src,tests,scripts]
//
// Rot (Exit 1) bei: Zahl der Kennungen != soll, doppelte oder fehlende Eintraege, mehr als `max`
// Nachweise aus der Generalprobe, Nachweis-Kennung ausserhalb der MVP-Liste. Kennungen ohne Test
// werden im MVP nur gemeldet; mit --strict (ab Woche 6 fuer abgenommene Aufgaben) sind sie rot.
// --task <ID> schraenkt auf die Kennungen der Zeile "Szenarien:" der Aufgabe im Bauplan ein.
//
// Gezaehlt wird eine Kennung nur, wenn sie in einem Testnamen (it/test/describe/step), im Titel
// oder in der each-Tabelle eines Tests steht - nicht in Kommentaren und nicht in sonstigen Strings.
//
// TA-CI Schritt 1: "mit Test" heisst mindestens ein REGULAERER Test. it.fails / test.fail /
// it.todo / skip / test.skip / fixme / describe.skip (samt allen Tests darin) zaehlen nicht.
// `@XX-nnn:teil` im Testnamen markiert Teilabdeckung: eigene Spalte "teilweise", kein "mit Test".
// Ratchet (--base <ref>): die Zahl "MVP-Kennung mit regulaerem Test" darf nicht unter den Wert
// in tests/meta/szenario-floor.json des Hauptzweigs fallen; die Datei selbst darf nicht sinken.
// --floor-schreiben schreibt die gemessene Zahl nach tests/meta/szenario-floor.json (danach committen).
// Optionen dazu: [--base <git-ref>] [--base-floor <pfad>] [--floor <pfad>] [--summary <pfad>]
// (Standard fuer --summary: Umgebungsvariable GITHUB_STEP_SUMMARY).
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const KENNUNG = /(?<![A-Za-z0-9])[A-Z][A-Z0-9]{0,3}-\d{3}(?!\d)/g
const TEST_DATEI = /\.(test|spec)\.(ts|tsx|mjs|js)$/
// Aufrufname nicht nach '.', Wortzeichen oder '$' (sonst zaehlt `/x/.test('...')`), Modifikatoren inkl. describe/step.
const AUFRUF = /(?<![.\w$])(?:it|test|describe)((?:\.(?:each|skip|only|todo|concurrent|fails|fail|fixme|sequential|step|for|describe))*)\s*(?=[(`])/g

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
    else if (a === '--base') o.base = wert()
    else if (a === '--base-floor') o.baseFloor = wert()
    else if (a === '--floor') o.floor = wert()
    else if (a === '--summary') o.summary = wert()
    else if (a === '--floor-schreiben') o.floorSchreiben = true
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

/** Ersetzt den Inhalt aller Strings durch Leerzeichen (gleiche Laenge, Zeilenumbrueche bleiben). */
function stringsMaskieren(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      const ende = stringEnde(src, i)
      out += c + src.slice(i + 1, ende - 1).replace(/[^\n]/g, ' ') + (ende - 1 > i ? src[ende - 1] : '')
      i = ende
    } else {
      out += c
      i++
    }
  }
  return out
}

/** Modifikatoren, die einen Test nicht regulaer laufen lassen. */
const NICHT_REGULAER = /\.(?:skip|todo|fails|fail|fixme)(?![A-Za-z])/

/**
 * Texte, in denen Kennungen als Test-Nachweis zaehlen: Testtitel und each-Tabellen.
 * Liefert { text, regulaer }; regulaer ist false bei skip/todo/fails/fail/fixme am Aufruf
 * oder wenn der Test in einem describe.skip / describe.todo steht.
 */
function testTexte(quelltext) {
  const src = ohneKommentare(quelltext)
  const maske = stringsMaskieren(src)
  const texte = []
  const uebersprungen = [] // [von, bis) Bereiche von describe.skip/todo
  AUFRUF.lastIndex = 0
  let m
  // Suche in der maskierten Kopie (Strings leer), Auslesen im Original gleicher Laenge:
  // `const s = "it('X-001')"` ist kein Test.
  while ((m = AUFRUF.exec(maske)) !== null) {
    const mods = m[1]
    const start = m.index
    const ab = AUFRUF.lastIndex
    const istDescribe = m[0].startsWith('describe')
    let regulaer = !NICHT_REGULAER.test(mods)
    if (!regulaer && istDescribe) {
      const ende = src[ab] === '`' ? stringEnde(src, ab) : klammerEnde(src, ab, '(', ')')
      const tabelle = mods.includes('.each') || mods.includes('.for')
      // describe.each(tabelle)('Titel', fn): Rumpf liegt hinter der Tabelle
      uebersprungen.push([start, tabelle ? klammerEnde(src, ende, '(', ')') : ende])
    }
    if (mods.includes('.each') || mods.includes('.for')) {
      // it.each([...])('Titel', fn) bzw. it.each`tabelle`('Titel', fn)
      const tabelleEnde = src[ab] === '`' ? stringEnde(src, ab) : klammerEnde(src, ab, '(', ')')
      texte.push({ text: src.slice(ab, tabelleEnde), regulaer, start })
      texte.push({ text: erstesStringLiteral(src, tabelleEnde), regulaer, start })
    } else {
      texte.push({ text: erstesStringLiteral(src, ab), regulaer, start })
    }
  }
  return texte.map((t) => ({
    text: t.text,
    regulaer: t.regulaer && !uebersprungen.some(([von, bis]) => t.start > von && t.start < bis),
  }))
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

/** Bauplan liegt in docs/ (gitignored) und fehlt in Worktrees: --plan, BAUPLAN_PFAD, Worktree, Hauptrepo. */
function planPfad(opt, root) {
  const rel = 'docs/superpowers/plans/2026-10-03-mvp-bauplan.md'
  const kandidaten = [opt.plan, process.env.BAUPLAN_PFAD, resolve(root, rel)].filter(Boolean)
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    kandidaten.push(resolve(common, '..', rel))
  } catch {
    // kein Git-Repo: nur die anderen Kandidaten
  }
  return kandidaten.find((k) => existsSync(k)) ?? kandidaten[0]
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

/** Ratchet: Zahl "MVP-Kennung mit regulaerem Test" gegen Untergrenze und Hauptzweig. */
function ratchet(opt, root, ids, zahlen, fehler) {
  const floorPfad = opt.floor ?? resolve(root, 'tests/meta/szenario-floor.json')
  const hinweise = []
  const aktuell = ids.length
  if (opt.floorSchreiben) {
    const inhalt = {
      _hinweis: 'Untergrenze fuer "MVP-Kennung mit regulaerem Test" (TA-CI). Nur anheben, nie senken; erzeugt mit `node scripts/scenario-tests.mjs --floor-schreiben`.',
      mitTest: aktuell,
      kennungen: ids,
    }
    writeFileSync(floorPfad, JSON.stringify(inhalt, null, 1) + '\n')
    console.log(`\nUntergrenze ${aktuell} nach ${floorPfad} geschrieben.`)
    return
  }
  let eigener = null
  if (existsSync(floorPfad)) eigener = JSON.parse(readFileSync(floorPfad, 'utf8'))
  else if (opt.base || opt.baseFloor) fehler.push(`Ratchet: ${floorPfad} fehlt`)
  let haupt = null
  if (opt.baseFloor) {
    if (existsSync(opt.baseFloor)) haupt = JSON.parse(readFileSync(opt.baseFloor, 'utf8'))
    else fehler.push(`--base-floor ${opt.baseFloor} nicht gefunden`)
  } else if (opt.base) {
    // Fail-closed: unbekannte Ref (Tippfehler, flacher Checkout) ist ein Fehler.
    let refDa = true
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${opt.base}^{commit}`], { cwd: root, stdio: 'ignore' })
    } catch {
      refDa = false
      fehler.push(`Ratchet: Base-Ref "${opt.base}" existiert nicht - Vergleich mit dem Hauptzweig nicht moeglich (Ref pruefen, fetch-depth)`)
    }
    if (refDa) {
      try {
        haupt = JSON.parse(execFileSync('git', ['show', `${opt.base}:tests/meta/szenario-floor.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
      } catch {
        hinweise.push(`${opt.base} kennt tests/meta/szenario-floor.json noch nicht (erster Merge) - Vergleich uebersprungen`)
      }
    }
  }
  if (eigener && aktuell < eigener.mitTest) fehler.push(`Szenario-Abdeckung: ${aktuell} Kennungen mit regulaerem Test < Untergrenze ${eigener.mitTest} in der Datei`)
  if (haupt) {
    if (aktuell < haupt.mitTest) fehler.push(`Szenario-Abdeckung: ${aktuell} Kennungen mit regulaerem Test < Hauptzweig ${haupt.mitTest} (Ratchet)`)
    if (eigener && eigener.mitTest < haupt.mitTest) fehler.push(`Untergrenze ${eigener.mitTest} < Hauptzweig ${haupt.mitTest} (Senken verboten)`)
  }
  if (eigener && aktuell > eigener.mitTest) hinweise.push(`Untergrenze kann angehoben werden: ${aktuell} > ${eigener.mitTest} (Datei per Commit anpassen)`)
  const verloren = haupt?.kennungen ? haupt.kennungen.filter((k) => !ids.includes(k)) : []
  for (const h of hinweise) console.log(`\nHINWEIS: ${h}`)
  if (verloren.length > 0) console.log(`\nGegenueber ${opt.baseFloor ?? opt.base} ohne regulaeren Test: ${verloren.join(', ')}`)

  const summaryPfad = opt.summary ?? process.env.GITHUB_STEP_SUMMARY
  if (summaryPfad) {
    const diff = haupt ? aktuell - haupt.mitTest : null
    const md = [
      '### Szenario-Abdeckung (MVP-Kennungen)',
      '',
      '| mit Test | teilweise | ohne Test | Hauptzweig | Veraenderung | Untergrenze |',
      '|---:|---:|---:|---:|---:|---:|',
      `| ${aktuell} | ${zahlen.nurTeilweise.length} | ${zahlen.ganzOhne.length} | ${haupt ? haupt.mitTest : '-'} | ${diff === null ? '-' : diff > 0 ? `+${diff}` : diff} | ${eigener ? eigener.mitTest : '-'} |`,
      '',
      verloren.length > 0 ? `Neu ohne regulaeren Test: ${verloren.map((k) => `\`${k}\``).join(', ')}` : 'Keine Kennung gegenueber dem Hauptzweig verloren.',
      '',
    ].join('\n')
    appendFileSync(summaryPfad, md + '\n')
  }
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

  const gefunden = new Set() // mindestens ein regulaerer Test
  const teilweise = new Set() // nur :teil-markierte regulaere Tests
  const dateien = sammleTestDateien(root, opt.scan ?? ['src', 'tests', 'scripts'])
  for (const datei of dateien) {
    for (const t of testTexte(readFileSync(datei, 'utf8'))) {
      if (!t.regulaer) continue
      for (const k of t.text.matchAll(KENNUNG)) {
        if (!recordVon.has(k[0])) continue
        const teil = t.text.startsWith(':teil', k.index + k[0].length)
        if (teil) teilweise.add(k[0])
        else gefunden.add(k[0])
      }
    }
  }

  let zuPruefen = [...recordVon.keys()]
  if (opt.task) {
    const ids = kennungenDerAufgabe(planPfad(opt, root), opt.task)
    zuPruefen = zuPruefen.filter((k) => ids.has(k))
    for (const k of ids) if (!recordVon.has(k)) console.log(`HINWEIS: ${k} (Aufgabe ${opt.task}) ist keine MVP-Kennung der Liste`)
  }
  const nachweisSet = new Set(nachweis.kennungen)
  const mitTest = zuPruefen.filter((k) => gefunden.has(k))
  const nurTeilweise = zuPruefen.filter((k) => !gefunden.has(k) && teilweise.has(k))
  const mitNachweis = zuPruefen.filter((k) => !gefunden.has(k) && !teilweise.has(k) && nachweisSet.has(k))
  // Ohne regulaeren Test: auch "teilweise" ist (noch) keine Abdeckung, wird aber getrennt gezaehlt.
  const ohneTest = zuPruefen.filter((k) => !gefunden.has(k) && !nachweisSet.has(k))
  const ganzOhne = ohneTest.filter((k) => !teilweise.has(k))

  const gesamt = zuPruefen.length
  console.log(`MVP-Kennungen: ${gesamt}${opt.task ? ` (Aufgabe ${opt.task})` : ''}, soll ${liste.soll}`)
  console.log(`mit Test: ${mitTest.length}, teilweise: ${nurTeilweise.length}, mit Nachweis Generalprobe: ${mitNachweis.length}, ohne Test: ${ganzOhne.length}`)
  console.log(`(${dateien.length} Testdateien durchsucht in: ${(opt.scan ?? ['src', 'tests', 'scripts']).join(', ')})`)
  console.log('\nOhne Test je Record (teilweise zaehlt hier mit):')
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

  if (!opt.task) ratchet(opt, root, [...gefunden].filter((k) => recordVon.has(k)).sort(), { mitTest, nurTeilweise, ganzOhne }, fehler)

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
