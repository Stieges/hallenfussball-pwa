#!/usr/bin/env node
// A-09 (@TA-001 bis @TA-005, @TA-009): Abdeckung je Bereich und je geaenderter Datei,
// Untergrenzen-Ratchet gegen den Hauptzweig.
//
// Aufruf:
//   node scripts/coverage-report.mjs [bereich ...] [--files a.ts,b.tsx] [--neu c.ts]
//        [--vorher <coverage-summary.json>] [--base <git-ref>] [--summary <pfad>]
//        [--floors <pfad>] [--base-floors <pfad>] [--root <ordner>]
//
// Ohne Bereichsnamen werden alle Bereiche geprueft. Exit 1 bei:
//   - Bereich unter seiner Untergrenze (Messung < floor),
//   - Untergrenze gesenkt gegenueber dem Hauptzweig (floor_neu < floor_main, je Schluessel),
//   - geaenderter Datei, die gegenueber --vorher schlechter abgedeckt ist,
//   - neuer Datei (--neu oder nicht in --vorher) mit weniger als 80 % Zeilen.
// Die Untergrenze des Hauptzweigs kommt aus `git show <base>:coverage-floors.json`
// (Standard-Base: origin/main) oder aus --base-floors. Fehlt sie dort (erste Einfuehrung), wird
// der Ratchet-Vergleich uebersprungen und das ausgewiesen.
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { relative, resolve, sep } from 'node:path'

const METRIKEN = ['statements', 'branches', 'functions', 'lines']
const NEUE_DATEI_MINDEST = 80

function parseArgs(argv) {
  const opt = { bereiche: [], files: [], neu: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const wert = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Wert fuer ${a} fehlt`)
      return v
    }
    if (a === '--files') opt.files.push(...wert().split(',').filter(Boolean))
    else if (a === '--neu') opt.neu.push(...wert().split(',').filter(Boolean))
    else if (a === '--vorher') opt.vorher = wert()
    else if (a === '--base') opt.base = wert()
    else if (a === '--summary') opt.summary = wert()
    else if (a === '--floors') opt.floors = wert()
    else if (a === '--base-floors') opt.baseFloors = wert()
    else if (a === '--root') opt.root = wert()
    else if (a.startsWith('--')) throw new Error(`Unbekannte Option ${a}`)
    else opt.bereiche.push(a)
  }
  return opt
}

const lies = (pfad) => JSON.parse(readFileSync(pfad, 'utf8'))
const runde = (n) => Math.round(n * 100) / 100
const fmt = (n) => (n === undefined || n === null ? '   -  ' : `${n.toFixed(2).padStart(6)}`)

/** Summary-Schluessel (absolut oder relativ) -> relativer Posix-Pfad ab Wurzel. */
function relPfad(schluessel, root) {
  const abs = resolve(root, schluessel)
  return relative(root, abs).split(sep).join('/')
}

function dateienDerSummary(summary, root) {
  const out = new Map()
  for (const [k, v] of Object.entries(summary)) {
    if (k === 'total') continue
    out.set(relPfad(k, root), v)
  }
  return out
}

const imBereich = (pfad, pfade) => pfade.some((p) => pfad.startsWith(p))

/** Aggregiert covered/total ueber alle Dateien eines Bereichs (nicht Mittelwert der Prozente). */
function bereichsWerte(dateien, pfade) {
  const acc = Object.fromEntries(METRIKEN.map((m) => [m, { covered: 0, total: 0 }]))
  let anzahl = 0
  for (const [pfad, werte] of dateien) {
    if (!imBereich(pfad, pfade)) continue
    anzahl++
    for (const m of METRIKEN) {
      acc[m].covered += werte[m]?.covered ?? 0
      acc[m].total += werte[m]?.total ?? 0
    }
  }
  const pct = Object.fromEntries(
    METRIKEN.map((m) => [m, acc[m].total === 0 ? 100 : runde((acc[m].covered / acc[m].total) * 100)]),
  )
  return { anzahl, pct }
}

function baseFloors(opt, root, fehler, hinweise) {
  if (opt.baseFloors) {
    if (!existsSync(opt.baseFloors)) {
      fehler.push(`--base-floors ${opt.baseFloors} nicht gefunden`)
      return null
    }
    return lies(opt.baseFloors)
  }
  const ref = opt.base ?? 'origin/main'
  try {
    const text = execFileSync('git', ['show', `${ref}:coverage-floors.json`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(text)
  } catch {
    hinweise.push(`Ratchet: ${ref} kennt coverage-floors.json nicht (erste Einfuehrung oder Ref fehlt) - Vergleich uebersprungen`)
    return null
  }
}

function main() {
  const opt = parseArgs(process.argv.slice(2))
  const root = resolve(opt.root ?? process.cwd())
  const summaryPfad = opt.summary ?? resolve(root, 'coverage/coverage-summary.json')
  const floorsPfad = opt.floors ?? resolve(root, 'coverage-floors.json')
  const fehler = []
  const hinweise = []

  if (!existsSync(summaryPfad)) {
    console.error(`FEHLER: ${summaryPfad} fehlt - erst "npx vitest run --coverage" laufen lassen`)
    process.exit(1)
  }
  const floors = lies(floorsPfad)
  const dateien = dateienDerSummary(lies(summaryPfad), root)
  const vorherDateien = opt.vorher ? dateienDerSummary(lies(opt.vorher), root) : null
  const hauptFloors = baseFloors(opt, root, fehler, hinweise)

  const namen = Object.keys(floors.bereiche)
  for (const b of opt.bereiche) if (!namen.includes(b)) fehler.push(`Unbekannter Bereich "${b}" (bekannt: ${namen.join(', ')})`)
  const gewaehlt = opt.bereiche.length > 0 ? opt.bereiche.filter((b) => namen.includes(b)) : namen

  console.log('Bereich               Dateien  Statements  Branches  Functions  Lines   Untergrenze (S/B/F/L)')
  for (const name of gewaehlt) {
    const b = floors.bereiche[name]
    const { anzahl, pct } = bereichsWerte(dateien, b.pfade)
    const f = b.floors
    console.log(
      `${name.padEnd(22)}${String(anzahl).padStart(5)}  ${fmt(pct.statements)}    ${fmt(pct.branches)}   ${fmt(pct.functions)}   ${fmt(pct.lines)}   ${METRIKEN.map((m) => f[m]).join(' / ')}`,
    )
    if (anzahl === 0 && METRIKEN.some((m) => f[m] > 0)) fehler.push(`${name}: keine Datei der Messung liegt im Bereich (Pfade ${b.pfade.join(', ')})`)
    for (const m of METRIKEN) {
      if (pct[m] < f[m]) fehler.push(`${name}.${m}: gemessen ${pct[m]} < Untergrenze ${f[m]}`)
      const alt = hauptFloors?.bereiche?.[name]?.floors?.[m]
      if (alt !== undefined && f[m] < alt) fehler.push(`${name}.${m}: Untergrenze ${f[m]} < Hauptzweig ${alt} (Senken verboten)`)
    }
  }
  if (hauptFloors) {
    // Ratchet gilt immer fuer alle Bereiche des Hauptzweigs, auch bei eingeschraenkter Auswahl.
    for (const [name, b] of Object.entries(hauptFloors.bereiche ?? {})) {
      const neu = floors.bereiche[name]
      if (!neu) {
        fehler.push(`${name}: Bereich im Hauptzweig vorhanden, hier entfernt (Untergrenze entfallen)`)
        continue
      }
      if (gewaehlt.includes(name)) continue
      for (const m of METRIKEN) {
        if (neu.floors[m] < b.floors[m]) fehler.push(`${name}.${m}: Untergrenze ${neu.floors[m]} < Hauptzweig ${b.floors[m]} (Senken verboten)`)
      }
    }
  }

  if (opt.files.length > 0 || opt.neu.length > 0) {
    console.log('\nDatei                                              Lines vorher -> nachher')
    const alle = [...new Set([...opt.files, ...opt.neu])].map((p) => relPfad(p, root))
    const neuSet = new Set(opt.neu.map((p) => relPfad(p, root)))
    for (const pfad of alle) {
      const nachher = dateien.get(pfad)?.lines?.pct
      const vorher = vorherDateien?.get(pfad)?.lines?.pct
      const istNeu = neuSet.has(pfad) || (vorherDateien !== null && !vorherDateien.has(pfad))
      console.log(`${pfad.padEnd(50)} ${fmt(vorher)} -> ${fmt(nachher)}${istNeu ? '  (neu)' : ''}`)
      if (nachher === undefined) {
        fehler.push(`${pfad}: nicht in der Messung (0 % oder ausgeschlossen)`)
      } else if (istNeu) {
        if (nachher < NEUE_DATEI_MINDEST) fehler.push(`${pfad}: neue Datei mit ${nachher} % < ${NEUE_DATEI_MINDEST} %`)
      } else if (vorher !== undefined && nachher < vorher) {
        fehler.push(`${pfad}: Verschlechterung ${vorher} % -> ${nachher} %`)
      }
    }
  }

  for (const h of hinweise) console.log(`\nHINWEIS: ${h}`)
  if (fehler.length > 0) {
    console.error('\nFEHLER:')
    for (const f of fehler) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log('\nOK: Untergrenzen eingehalten, keine gesenkt.')
}

try {
  main()
} catch (e) {
  console.error(`FEHLER: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
}
