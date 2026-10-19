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
      const von = i
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      out += ' ' + src.slice(von, i).replace(/[^\n]/g, '')
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

/** Verweis auf einen Defekt (`@DF-001`, `DF-001`; genau drei Ziffern) - TM-1 R-TM1-2. */
const DEFEKT_VERWEIS = /(?<![A-Za-z0-9])@?DF-\d{3}(?!\d)/g
/** Verweis auf einen Befund (`C-COCKPIT-TABLET-OHNE-PROTOKOLL`, nur Grossbuchstaben, Ziffern, Umlaute). */
const BEFUND_VERWEIS = /(?<![A-Za-z0-9-])C-[A-Z0-9ÄÖÜ]+(?:-[A-Z0-9ÄÖÜ]+)*(?![A-Za-z0-9-])/g
/** Markierung "erwartet rot" am Aufruf: it.fails / test.fail. */
const ERWARTET_ROT = /\.(?:fails|fail)(?![A-Za-z])/

/** Alle Verweise (Defekt und Befund) in einem Text, ohne fuehrendes `@`, in Reihenfolge, ohne Dubletten. */
export function verweiseIn(text) {
  const treffer = [...text.matchAll(DEFEKT_VERWEIS), ...text.matchAll(BEFUND_VERWEIS)]
    .sort((a, b) => a.index - b.index)
    .map((t) => t[0].replace(/^@/, ''))
  return [...new Set(treffer)]
}

/** Statischer Text eines String-Literals: ohne Anfuehrungszeichen, bei Template-Literalen ohne `${...}`. */
function statischerText(literal) {
  if (literal === '') return ''
  if (literal[0] !== '`') return literal.slice(1, -1)
  let out = ''
  for (let i = 1; i < literal.length - 1; ) {
    if (literal[i] === '$' && literal[i + 1] === '{') i = klammerEnde(literal, i + 1, '{', '}')
    else out += literal[i++]
  }
  return out
}

/** String-Literal des zweiten Arguments eines Aufrufs (ab = Index bei/vor der oeffnenden Klammer); '' wenn keins. */
function zweitesArgument(src, ab) {
  let i = ab
  while (i < src.length && /\s/.test(src[i])) i++
  if (src[i] !== '(') return ''
  i++
  let tiefe = 0
  while (i < src.length) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      i = stringEnde(src, i)
      continue
    }
    if (c === '(' || c === '[' || c === '{') tiefe++
    else if (c === ')' || c === ']' || c === '}') {
      if (tiefe === 0) return ''
      tiefe--
    } else if (c === ',' && tiefe === 0) return erstesStringLiteral(src, i + 1)
    i++
  }
  return ''
}

/**
 * Texte, in denen Kennungen als Test-Nachweis zaehlen: Testtitel und each-Tabellen.
 * Liefert je Eintrag { text, regulaer, markiert, verweise, eigene, zeile, titel }:
 *  - regulaer ist false bei skip/todo/fails/fail/fixme am Aufruf, bei x-Praefix (xit/xtest/xdescribe), bei
 *    unbedingter Markierung im Rumpf oder wenn der Eintrag in einem uebersprungenen Bereich (describe.skip,
 *    test.describe.fixme, test.skip mit Schritten darin) steht.
 *  - markiert (TM-1): "erwartet rot" = Modifikator .fails/.fail am Aufruf oder jeder Rumpf-Aufruf
 *    test.fail(..) / testInfo.fail(..), bedingt oder unbedingt. Je Vorkommen ein Eintrag (eine each-Tabelle = 1).
 *  - verweise: bei markierten Eintraegen alle Verweise im Titel, in den umgebenden describe-Titeln, bei
 *    Rumpf-Markierungen zusaetzlich im Titel des umgebenden Tests und in der Begruendung (2. Argument).
 *    Kommentare zaehlen nie, Template-Literale nur mit statischem Text.
 *  - eigene: Verweise im eigenen Titel bzw. in der eigenen Begruendung (jeder Eintrag, auch regulaere Tests).
 *  - zeile (1-basiert, im Originalquelltext) und titel (Titel, bei Rumpf-Markierungen der des umgebenden Tests).
 */
export function testTexte(quelltext) {
  const src = ohneKommentare(quelltext)
  const maske = stringsMaskieren(src)
  const zeilenAnfang = [0]
  for (let k = 0; k < src.length; k++) if (src[k] === '\n') zeilenAnfang.push(k + 1)
  const zeileVon = (pos) => {
    let lo = 0
    let hi = zeilenAnfang.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (zeilenAnfang[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
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
    a.ende = rumpfEnde()
    a.titelText = a.titel ? erstesStringLiteral(src, tabelle ? tabelleEnde : a.ab) : ''
    if (!regulaer) {
      uebersprungen.push([a.start, a.ende])
    } else if (!a.behaelter && !a.schritt) {
      if (UNBEDINGT.test(maske.slice(tabelle ? tabelleEnde : a.ab + 1, a.ende))) {
        regulaer = false
        uebersprungen.push([a.start, a.ende])
      }
    }
    // Rumpf-Markierung (test.fail(..) ohne Titel) oder Deklaration mit .fails/.fail
    const markiert = ERWARTET_ROT.test(a.mods)
    const imRumpf = markiert && a.titelText === '' && !tabelle
    if (tabelle) {
      texte.push({ text: src.slice(a.ab, tabelleEnde), regulaer, start: a.start, a: null, markiert: false })
      texte.push({ text: a.titelText, regulaer, start: a.start, a, markiert })
    } else {
      texte.push({ text: a.titelText, regulaer, start: a.start, a, markiert, imRumpf })
    }
  })
  // testInfo.fail(..) und test.info().fail(..) haben keinen Aufruf-Eintrag: eigene Rumpf-Markierung ohne Titel
  for (const t of maske.matchAll(/(?<![.\w$])(?:testInfo|test\.info\(\))\.fail\s*(?=\()/g)) {
    texte.push({ text: '', regulaer: true, start: t.index, a: { start: t.index, ab: t.index + t[0].length, titelText: '', mods: '' }, markiert: true, imRumpf: true })
  }
  const innerhalb = (x, pos) => x.start < pos && pos < x.ende
  const titelDe = (x) => statischerText(x.titelText)
  return texte.map((t) => {
    const pos = t.start
    const a = t.a
    const eigenerText = a ? (t.imRumpf ? statischerText(zweitesArgument(src, a.ab)) : statischerText(t.text)) : ''
    const eigene = verweiseIn(eigenerText)
    let titel = a ? titelDe(a) : ''
    let verweise = eigene
    if (t.markiert) {
      const umgebend = aufrufe.filter((x) => x !== a && x.behaelter && innerhalb(x, pos)).map(titelDe)
      let test = ''
      if (t.imRumpf) {
        const huelle = aufrufe.filter((x) => x !== a && !x.behaelter && !x.schritt && x.titel && innerhalb(x, pos)).pop()
        test = huelle ? titelDe(huelle) : ''
        titel = test
      }
      verweise = verweiseIn([eigenerText, test, ...umgebend].join('\n'))
    }
    return {
      text: t.text,
      regulaer: t.regulaer && !uebersprungen.some(([von, bis]) => t.start > von && t.start < bis),
      markiert: Boolean(t.markiert),
      verweise,
      eigene,
      zeile: zeileVon(pos),
      titel,
    }
  })
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
