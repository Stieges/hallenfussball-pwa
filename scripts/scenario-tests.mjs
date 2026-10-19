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
// TA-CI: "mit Test" heisst mindestens ein REGULAERER Test. Nicht regulaer sind: it.fails / test.fail /
// it.todo / skip / fixme am Aufruf, x-Praefix (xit, xdescribe), describe.skip und test.describe.skip/fixme
// samt allen Tests und Schritten darin sowie eine UNBEDINGTE Markierung im Rumpf (test.fail(true, ..),
// test.fixme(), test.skip(), ctx.skip()). BEDINGTE Markierungen (test.skip(!desktop, ..)) bleiben regulaer,
// weil der Test in der CI auf einem Projekt laeuft - das gilt nur fuer die ARGUMENTFORM test.skip(cond, ..);
// `if (mobile) test.skip()` zaehlt konservativ als unbedingt, also nicht regulaer. Nicht erkannt (zaehlt daher nicht): skipIf/runIf.
// `@XX-nnn:teil` im Testnamen markiert Teilabdeckung: eigene Spalte "teilweise", kein "mit Test".
// Ratchet (--base <ref>, in der CI origin/main; PRs gegen develop vergleichen ebenfalls mit main): der Stand
// von <ref> wird GEMESSEN (git archive in ein Temp-Verzeichnis, gleiche Zaehlregel). Rot, wenn die Zahl
// "MVP-Kennung mit regulaerem Test" darunter faellt; "neu verloren" nennt die Kennungen. Die Datei
// tests/meta/szenario-floor.json ist nur die absolute Untergrenze (nie senken, auch nicht gegenueber <ref>).
// --floor-schreiben schreibt die gemessene Zahl dorthin (danach committen).
// Optionen dazu: [--base <git-ref>] [--floor <pfad>] [--summary <pfad>]
// (Standard fuer --summary: Umgebungsvariable GITHUB_STEP_SUMMARY).
//
// TM-1 (@TA-013 bis @TA-015, @TA-018): Rot markierte Tests ("erwartet rot") brauchen einen Verweis auf einen Befund oder Defekt.
//  - Markierung: Modifikator .fails/.fail am Aufruf (it.fails, test.fail('Titel', fn)) oder jeder Rumpf-Aufruf
//    test.fail(..) / testInfo.fail(..), bedingt oder unbedingt. skip/fixme/todo sind keine Markierung im Sinn von TM-1.
//  - Verweis: "@DF-nnn"/"DF-nnn" (genau drei Ziffern) oder eine Befund-Kennung "C-..." in Grossbuchstaben, gesucht in
//    Testtitel, Titeln der umgebenden describe-Bloecke, bei Rumpf-Markierungen im Titel des umgebenden Tests und im
//    String der Begruendung (2. Argument). Kommentare zaehlen nie; Template-Literale nur mit statischem Text.
//  - Ratsche: Zahl der Markierungen ohne Verweis <= Zahl auf --base (gemessen); darueber rot und die neuen Tests genannt.
//    Ohne --base nur Bericht. Sinkt die Zahl: gruen mit HINWEIS.
//  - Jeder Verweis in einem Titel oder einer Begruendung (auch in regulaeren Tests) muss in tests/meta/befund-kennungen.json
//    stehen (erzeugt von scripts/befund-kennungen-erzeugen.mjs, Option --befund-kennungen <pfad>), sonst sofort rot.
//    Rueckrichtung: jede Kennung der Liste muss von mindestens einem Test genannt werden, sonst rot (Liste veraltet
//    oder von Hand ergaenzt).
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { sammleStepModule, sammleTestDateien, stepBefunde, testTexte } from './lib/testtexte.mjs'

const KENNUNG = /(?<![A-Za-z0-9])[A-Z][A-Z0-9]{0,3}-\d{3}(?!\d)/g

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
    else if (a === '--floor') o.floor = wert()
    else if (a === '--befund-kennungen') o.befundKennungen = wert()
    else if (a === '--summary') o.summary = wert()
    else if (a === '--floor-schreiben') o.floorSchreiben = true
    else throw new Error(`Unbekannte Option ${a}`)
  }
  return o
}

/** Zaehlt Kennungen mit regulaerem Test (gefunden) bzw. nur :teil-Test (teilweise) unter root/scan. */
function messe(root, scan, istKennung) {
  const gefunden = new Set()
  const teilweise = new Set()
  const markiert = [] // TM-1: jede "erwartet rot"-Markierung { datei, zeile, titel, verweise }
  const stellen = [] // TM-1: jeder Verweis in einem Titel oder einer Begruendung { datei, zeile, kennung }
  const dateien = sammleTestDateien(root, scan)
  for (const datei of dateien) {
    const rel = relative(root, datei)
    for (const t of testTexte(readFileSync(datei, 'utf8'))) {
      if (t.markiert) markiert.push({ datei: rel, zeile: t.zeile, titel: t.titel, verweise: t.verweise })
      for (const kennung of t.eigene) stellen.push({ datei: rel, zeile: t.zeile, kennung })
      if (!t.regulaer) continue
      for (const k of t.text.matchAll(KENNUNG)) {
        if (!istKennung(k[0])) continue
        // :teil mit Wortgrenze (":teilweise" ist keine Markierung)
        if (/^:teil(?![\p{L}\d])/u.test(t.text.slice(k.index + k[0].length))) teilweise.add(k[0])
        else gefunden.add(k[0])
      }
    }
  }
  // Durchstich-Schritte tragen ihre Befunde als Daten (`befunde: [...]`); sie zaehlen als Verweis wie ein Testtitel.
  for (const datei of sammleStepModule(root, scan)) {
    const rel = relative(root, datei)
    for (const t of stepBefunde(readFileSync(datei, 'utf8'))) stellen.push({ datei: rel, zeile: t.zeile, kennung: t.kennung })
  }
  return { gefunden, teilweise, dateien, markiert, stellen }
}

/** Entpackt den Stand von <ref> (git archive) nach tmp und misst dort; raeumt immer auf. */
function messeRef(root, ref, scan, istKennung, fehler) {
  const tmp = mkdtempSync(join(tmpdir(), 'szenario-base-'))
  try {
    const baum = execFileSync('git', ['ls-tree', '--name-only', ref], { cwd: root, encoding: 'utf8' }).split('\n')
    const pfade = scan.filter((x) => baum.includes(x))
    if (pfade.length > 0) {
      const tar = execFileSync('git', ['archive', '--format=tar', ref, '--', ...pfade], { cwd: root, maxBuffer: 1024 * 1024 * 1024 })
      execFileSync('tar', ['-x', '-C', tmp], { input: tar })
    }
    return messe(tmp, scan, istKennung)
  } catch (e) {
    fehler.push(`Ratchet: Stand von "${ref}" nicht messbar (${e instanceof Error ? e.message.split('\n')[0] : String(e)})`)
    return null
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
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

/** Markierungen ohne Verweis im Arbeitsstand, die es als Schluessel (Datei::Titel) auf dem Hauptzweig nicht gab (Vielfachmenge). */
function neueOhneVerweis(aktuell, haupt) {
  const rest = new Map()
  for (const x of haupt) rest.set(`${x.datei}::${x.titel}`, (rest.get(`${x.datei}::${x.titel}`) ?? 0) + 1)
  return aktuell.filter((x) => {
    const k = `${x.datei}::${x.titel}`
    const n = rest.get(k) ?? 0
    if (n > 0) rest.set(k, n - 1)
    return n === 0
  })
}

/** TM-1 (@TA-015): jeder Verweis in einem Testtitel oder einer Begruendung muss in tests/meta/befund-kennungen.json stehen. */
function pruefeVerweise(opt, root, stellen, fehler) {
  const pfad = opt.befundKennungen ?? resolve(root, 'tests/meta/befund-kennungen.json')
  if (stellen.length === 0 && !existsSync(pfad)) return
  if (!existsSync(pfad)) {
    fehler.push(`Verweis ${stellen[0].kennung} in ${stellen[0].datei}:${stellen[0].zeile} (${stellen.length} Verweise insgesamt), aber ${pfad} fehlt (node scripts/befund-kennungen-erzeugen.mjs)`)
    return
  }
  const kennungen = JSON.parse(readFileSync(pfad, 'utf8')).kennungen
  const bekannt = new Set(kennungen)
  // Rueckrichtung (ohne docs/ pruefbar): die Liste nennt nur, was ein Test nennt (@TA-016).
  const genannt = new Set(stellen.map((x) => x.kennung))
  const ueberzaehlig = kennungen.filter((k) => !genannt.has(k))
  if (ueberzaehlig.length > 0) fehler.push(`Liste veraltet oder von Hand ergaenzt: ${ueberzaehlig.join(', ')} steht in ${relative(root, pfad)}, aber kein Test nennt es (neu erzeugen: node scripts/befund-kennungen-erzeugen.mjs)`)
  for (const s of stellen) {
    if (!bekannt.has(s.kennung)) fehler.push(`Unbekannter Verweis ${s.kennung} in ${s.datei}:${s.zeile} (nicht in ${relative(root, pfad)}; Tippfehler oder Liste mit node scripts/befund-kennungen-erzeugen.mjs neu erzeugen)`)
  }
}

/** Wie viele verlorene Kennungen die Job-Summary hoechstens nennt (stdout nennt alle). */
const SUMMARY_MAX = 30

/**
 * Ratchet: Zahl "MVP-Kennung mit regulaerem Test" gegen den GEMESSENEN Stand von <base> (git archive,
 * gleiche Zaehlregel) und gegen die absolute Untergrenze in szenario-floor.json (nie senken).
 */
function ratchet(opt, root, scan, istKennung, ids, zahlen, fehler) {
  const floorPfad = opt.floor ?? resolve(root, 'tests/meta/szenario-floor.json')
  const hinweise = []
  const aktuell = ids.length
  if (opt.floorSchreiben) {
    const inhalt = {
      _hinweis: 'Absolute Untergrenze fuer "MVP-Kennung mit regulaerem Test" (TA-CI), nie senken; der Ratchet misst main zusaetzlich selbst. Erzeugt mit `node scripts/scenario-tests.mjs --floor-schreiben`.',
      mitTest: aktuell,
      kennungen: ids,
    }
    writeFileSync(floorPfad, JSON.stringify(inhalt, null, 1) + '\n')
    console.log(`\nUntergrenze ${aktuell} nach ${floorPfad} geschrieben.`)
    return
  }
  let eigener = null
  if (existsSync(floorPfad)) eigener = JSON.parse(readFileSync(floorPfad, 'utf8'))
  else if (opt.base) fehler.push(`Ratchet: ${floorPfad} fehlt`)

  let haupt = null // { mitTest, kennungen } gemessen auf <base>
  if (opt.base) {
    // Fail-closed: unbekannte Ref (Tippfehler, flacher Checkout) ist ein Fehler.
    let refDa = true
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${opt.base}^{commit}`], { cwd: root, stdio: 'ignore' })
    } catch {
      refDa = false
      fehler.push(`Ratchet: Base-Ref "${opt.base}" existiert nicht - Vergleich mit dem Hauptzweig nicht moeglich (Ref pruefen, fetch-depth)`)
    }
    if (refDa) {
      const m = messeRef(root, opt.base, scan, istKennung, fehler)
      if (m) haupt = { mitTest: m.gefunden.size, kennungen: [...m.gefunden].sort(), markiert: m.markiert }
      // Die Untergrenze des Hauptzweigs darf nicht gesenkt werden. Fehlende Datei: Hinweis, defekte Datei: rot.
      let text = null
      try {
        text = execFileSync('git', ['show', `${opt.base}:tests/meta/szenario-floor.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      } catch {
        hinweise.push(`${opt.base} kennt tests/meta/szenario-floor.json noch nicht (erster Merge) - Senken-Pruefung der Datei uebersprungen`)
      }
      if (text !== null) {
        let hauptFloor = null
        try {
          hauptFloor = JSON.parse(text)
        } catch {
          fehler.push(`Ratchet: tests/meta/szenario-floor.json auf ${opt.base} ist kein gueltiges JSON`)
        }
        if (hauptFloor && eigener && eigener.mitTest < hauptFloor.mitTest) fehler.push(`Untergrenze ${eigener.mitTest} < Untergrenze ${hauptFloor.mitTest} auf ${opt.base} (Senken verboten)`)
      }
    }
  }
  if (eigener && aktuell < eigener.mitTest) fehler.push(`Szenario-Abdeckung: ${aktuell} Kennungen mit regulaerem Test < Untergrenze ${eigener.mitTest} in der Datei`)
  if (haupt && aktuell < haupt.mitTest) fehler.push(`Szenario-Abdeckung: ${aktuell} Kennungen mit regulaerem Test < Hauptzweig ${haupt.mitTest} (gemessen, Ratchet)`)
  if (eigener && aktuell > eigener.mitTest) hinweise.push(`Untergrenze kann angehoben werden: ${aktuell} > ${eigener.mitTest} (Datei per Commit anpassen)`)
  const verloren = haupt ? haupt.kennungen.filter((k) => !ids.includes(k)) : []
  const ohneVerweis = zahlen.markiert.filter((x) => x.verweise.length === 0)
  const hauptOhne = haupt ? haupt.markiert.filter((x) => x.verweise.length === 0) : null
  const neueOhne = hauptOhne ? neueOhneVerweis(ohneVerweis, hauptOhne) : []
  console.log(`\nErwartet rot (it.fails, test.fail): ${zahlen.markiert.length}, davon ohne Verweis auf Befund oder Defekt: ${ohneVerweis.length}${hauptOhne ? ` (Hauptzweig ${hauptOhne.length})` : ''}`)
  for (const x of ohneVerweis) console.log(`  erwartet rot ohne Verweis: ${x.datei}:${x.zeile}  ${x.titel}`)
  if (hauptOhne && ohneVerweis.length > hauptOhne.length) {
    fehler.push(`Erwartet rot ohne Verweis: ${ohneVerweis.length} > Hauptzweig ${hauptOhne.length} (Ratchet). Neu: ${neueOhne.map((x) => `${x.datei}:${x.zeile} "${x.titel}"`).join('; ')}. Verweis (@DF-nnn oder C-...) in den Testnamen aufnehmen.`)
  }
  if (hauptOhne && ohneVerweis.length < hauptOhne.length) hinweise.push(`Erwartet rot ohne Verweis gesunken: ${ohneVerweis.length} < ${hauptOhne.length} auf ${opt.base}`)
  for (const h of hinweise) console.log(`\nHINWEIS: ${h}`)
  if (verloren.length > 0) console.log(`\nGegenueber ${opt.base} ohne regulaeren Test (neu verloren): ${verloren.join(', ')}`)

  const summaryPfad = opt.summary ?? process.env.GITHUB_STEP_SUMMARY
  if (summaryPfad) {
    const diff = haupt ? aktuell - haupt.mitTest : null
    const genannt = verloren.slice(0, SUMMARY_MAX).map((k) => `\`${k}\``).join(', ')
    const rest = verloren.length > SUMMARY_MAX ? ` ... und ${verloren.length - SUMMARY_MAX} weitere (siehe scenario-bericht.txt)` : ''
    const md = [
      '### Szenario-Abdeckung (MVP-Kennungen)',
      '',
      '| mit Test | teilweise | ohne Test | Hauptzweig (gemessen) | Veraenderung | Untergrenze |',
      '|---:|---:|---:|---:|---:|---:|',
      `| ${aktuell} | ${zahlen.nurTeilweise.length} | ${zahlen.ganzOhne.length} | ${haupt ? haupt.mitTest : '-'} | ${diff === null ? '-' : diff > 0 ? `+${diff}` : diff} | ${eigener ? eigener.mitTest : '-'} |`,
      '',
      verloren.length > 0 ? `Neu ohne regulaeren Test: ${genannt}${rest}` : 'Keine Kennung gegenueber dem Hauptzweig verloren.',
      '',
      `Erwartet rot ohne Verweis: ${ohneVerweis.length} (Hauptzweig ${hauptOhne ? hauptOhne.length : '-'}) von ${zahlen.markiert.length} Markierungen.`,
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

  const scan = opt.scan ?? ['src', 'tests', 'scripts']
  const { gefunden, teilweise, dateien, markiert, stellen } = messe(root, scan, (k) => recordVon.has(k))
  pruefeVerweise(opt, root, stellen, fehler)

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

  if (!opt.task) ratchet(opt, root, scan, (k) => recordVon.has(k), [...gefunden].sort(), { mitTest, nurTeilweise, ganzOhne, markiert }, fehler)

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
