// Gemeinsamer Parser fuer Testtitel (TA-CI, TM-1): wird von scenario-tests.mjs und
// befund-kennungen-erzeugen.mjs genutzt. Liest Quelltext ohne TypeScript-Parser.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const TEST_DATEI = /\.(test|spec)\.(ts|tsx|mjs|js)$/
// Aufrufname nicht nach '.', Wortzeichen oder '$' (sonst zaehlt `/x/.test('...')`), Modifikatoren inkl. describe/step.
const AUFRUF = /(?<![.\w$])(x?)(it|test|describe)((?:\.(?:each|skip|only|todo|concurrent|fails|fail|fixme|sequential|step|for|describe))*)\s*(?=[(`])/g

/** Entfernt Kommentare; Strings und Template-Literale bleiben unveraendert erhalten. */
export function ohneKommentare(src) {
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
export function stringEnde(src, start) {
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
export function klammerEnde(src, start, auf, zu) {
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

export function erstesStringLiteral(src, ab) {
  let i = ab
  while (i < src.length && /\s/.test(src[i])) i++
  if (src[i] === '(') i++
  while (i < src.length && /\s/.test(src[i])) i++
  if (src[i] === "'" || src[i] === '"' || src[i] === '`') return src.slice(i, stringEnde(src, i))
  return ''
}

/** Ersetzt den Inhalt aller Strings durch Leerzeichen (gleiche Laenge, Zeilenumbrueche bleiben). */
export function stringsMaskieren(src) {
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
/** Unbedingte Markierung im Rumpf: test.fail(true, ..), test.fixme(), test.skip(), ctx.skip(). Bedingte (test.skip(!desktop, ..)) bleiben regulaer. */
const UNBEDINGT = /(?<![.\w$])(?:test|it|ctx|context|testInfo)\.(?:fail|fixme|skip)\(\s*(?:true\s*)?[,)]/

/**
 * Texte, in denen Kennungen als Test-Nachweis zaehlen: Testtitel und each-Tabellen.
 * Liefert { text, regulaer }; regulaer ist false bei skip/todo/fails/fail/fixme am Aufruf, bei x-Praefix
 * (xit/xtest/xdescribe), bei unbedingter Markierung im Rumpf oder wenn der Eintrag in einem
 * uebersprungenen Bereich (describe.skip, test.describe.fixme, test.skip mit Schritten darin) steht.
 */
export function testTexte(quelltext) {
  const src = ohneKommentare(quelltext)
  const maske = stringsMaskieren(src)
  const aufrufe = []
  AUFRUF.lastIndex = 0
  let m
  // Suche in der maskierten Kopie (Strings leer), Auslesen im Original gleicher Laenge:
  // `const s = "it('X-001')"` ist kein Test.
  while ((m = AUFRUF.exec(maske)) !== null) {
    const mods = m[3]
    aufrufe.push({ start: m.index, ab: AUFRUF.lastIndex, mods, x: m[1] === 'x', behaelter: m[2] === 'describe' || mods.includes('.describe'), schritt: mods.includes('.step'), titel: mods.includes('.each') || mods.includes('.for') || erstesStringLiteral(src, AUFRUF.lastIndex) !== '' })
  }
  const texte = []
  const uebersprungen = [] // [von, bis) Bereiche, deren Inhalt nicht regulaer ist
  aufrufe.forEach((a, i) => {
    const tabelle = a.mods.includes('.each') || a.mods.includes('.for')
    const tabelleEnde = tabelle ? (src[a.ab] === '`' ? stringEnde(src, a.ab) : klammerEnde(src, a.ab, '(', ')')) : a.ab
    let regulaer = !a.x && !NICHT_REGULAER.test(a.mods)
    // Ende des Aufrufs. Ein Test kann keinen weiteren Test (nur Schritte) enthalten: die naechste Nicht-Schritt-
    // Deklaration begrenzt den Rumpf, damit eine unausgewogene Klammer (Regex-Literal, Apostroph) nicht ueberlaeuft.
    const rumpfEnde = () => {
      const roh = tabelle ? klammerEnde(src, tabelleEnde, '(', ')') : klammerEnde(src, a.ab, '(', ')')
      if (a.behaelter) return roh
      // Markierungen im Rumpf (test.fail(true, ..)) haben keinen Titel und begrenzen nichts.
      const naechste = aufrufe.slice(i + 1).find((n) => !n.schritt && n.titel)
      return naechste ? Math.min(roh, naechste.start) : roh
    }
    if (!regulaer) {
      uebersprungen.push([a.start, rumpfEnde()])
    } else if (!a.behaelter && !a.schritt) {
      const ende = rumpfEnde()
      if (UNBEDINGT.test(maske.slice(tabelle ? tabelleEnde : a.ab + 1, ende))) {
        regulaer = false
        uebersprungen.push([a.start, ende])
      }
    }
    if (tabelle) {
      texte.push({ text: src.slice(a.ab, tabelleEnde), regulaer, start: a.start })
      texte.push({ text: erstesStringLiteral(src, tabelleEnde), regulaer, start: a.start })
    } else {
      texte.push({ text: erstesStringLiteral(src, a.ab), regulaer, start: a.start })
    }
  })
  return texte.map((t) => ({
    text: t.text,
    regulaer: t.regulaer && !uebersprungen.some(([von, bis]) => t.start > von && t.start < bis),
  }))
}

export function sammleTestDateien(root, scan) {
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
