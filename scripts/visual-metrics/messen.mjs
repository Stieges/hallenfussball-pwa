#!/usr/bin/env node
// Visuelle Messung (Skill visuelle-pruefung, Plattform; Auftrag Daniel 2026-10-16).
// Misst eine URL oder HTML-Datei in einer Geraete-Matrix gegen grenzwerte.json und schreibt
// einen JSON-Bericht plus eine Befundliste. Exit 0 = gruen (Warnungen erlaubt), 1 = HART-Verstoss,
// 2 = Aufruf falsch, 3 = Gate rot (BLOCKED: kein echter Stand, Schrift fehlt).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { messeSeite, pruefeGate, dehneTexte } from './browser-messung.mjs'
import { PROFILE, loeseProfile, sehwinkelAnteil } from './profile.mjs'

const HIER = dirname(fileURLToPath(import.meta.url))

const HILFE = `Aufruf: npm run visual:metrics -- --ziel <url|datei.html> [Optionen]

  --ziel <url|datei>        Gebautes Preview (z. B. http://localhost:4173/...) oder Mockup-/HTML-Datei
  --profil <liste>          app (Standard) | monitor | handy | tablet | desktop | reflow | Profilname(n),
                            kommagetrennt. Profile: ${Object.keys(PROFILE).join(', ')}
  --themen <liste>          hell,dunkel (Standard beide)
  --sprachen <liste>        de,en (Standard beide; setzt Browser-Locale)
  --varianten <liste>       normal,langtext (Standard beide); textabstand = WCAG 1.4.12 zusaetzlich
  --grenzwerte <pfad>       Standard: scripts/visual-metrics/grenzwerte.json
  --abstand-m <m>           Monitor-Sehabstand (Standard aus grenzwerte.json: 10)
  --diagonale-zoll <z>      Monitor-Diagonale (Standard: 55)
  --primary-selektor <css>  Haupttasten (Standard: [data-primary], [data-variant="primary"])
  --team-selektor <css>     Teamnamen fuer Langtext (Standard: [data-teamname])
  --ohne-axe                axe-core auslassen
  --aus <ordner>            Ausgabeordner (Standard: test-results/visual-metrics)
  --bericht <datei.json>    fester Pfad fuer den JSON-Bericht
  --screenshots             Bildschirmfoto je Lauf mit HART-Befund
  --json                    Bericht auf stdout statt Befundliste
  --help

Exit: 0 gruen · 1 HART-Verstoss · 2 Aufruf falsch · 3 BLOCKED (Gate rot) · 4 Werkzeugfehler`

function parseArgs(argv) {
  const o = { profil: 'app', themen: 'hell,dunkel', sprachen: 'de,en', varianten: 'normal,langtext', axe: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const wert = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Wert fuer ${a} fehlt`)
      return v
    }
    switch (a) {
      case '--help': case '-h': o.hilfe = true; break
      case '--ziel': o.ziel = wert(); break
      case '--profil': o.profil = wert(); break
      case '--themen': o.themen = wert(); break
      case '--sprachen': o.sprachen = wert(); break
      case '--varianten': o.varianten = wert(); break
      case '--grenzwerte': o.grenzwerte = wert(); break
      case '--abstand-m': o.abstandM = Number(wert()); break
      case '--diagonale-zoll': o.diagonaleZoll = Number(wert()); break
      case '--primary-selektor': o.primary = wert(); break
      case '--team-selektor': o.team = wert(); break
      case '--ohne-axe': o.axe = false; break
      case '--aus': o.aus = wert(); break
      case '--bericht': o.bericht = wert(); break
      case '--screenshots': o.screenshots = true; break
      case '--json': o.json = true; break
      default:
        if (!a.startsWith('--') && !o.ziel) o.ziel = a
        else throw new Error(`Unbekannte Option ${a}`)
    }
  }
  return o
}

const liste = (s, erlaubt, name) => {
  const l = String(s).split(',').map((x) => x.trim()).filter(Boolean)
  for (const x of l) if (!erlaubt.includes(x)) throw new Error(`${name}: "${x}" nicht erlaubt (${erlaubt.join(', ')})`)
  return l
}

function warneBeiAbweichung(pfad) {
  // Der Skill haelt eine Kopie unter .claude/skills/visuelle-pruefung/ (lokal, nicht versioniert).
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: HIER, encoding: 'utf8' }).trim()
    const kandidaten = [join(process.cwd(), '.claude/skills/visuelle-pruefung/grenzwerte.json'), join(dirname(common), '.claude/skills/visuelle-pruefung/grenzwerte.json')]
    const eigen = readFileSync(pfad, 'utf8')
    for (const k of kandidaten) {
      if (existsSync(k) && readFileSync(k, 'utf8') !== eigen) {
        process.stderr.write(`WARNUNG: ${k} weicht von ${pfad} ab – Grenzwerte angleichen (nie lockern).\n`)
        return
      }
    }
  } catch { /* ohne git: keine Pruefung */ }
}

function grenzenFuer(gw, art, profil, opts) {
  const g = {}
  const typ = {}
  for (const e of gw.grenzwerte) {
    if (!e.geltung.includes(art) || e.id.startsWith('gate.') || e.id.startsWith('langtext.')) continue
    if (e.id === 'overscan.standard-px') continue
    let w = e.wert
    if (typeof w === 'string' && w.startsWith('sehwinkel.')) {
      const sw = { ...gw.sehwinkel, ...(opts.abstandM ? { abstandM: opts.abstandM } : {}), ...(opts.diagonaleZoll ? { diagonaleZoll: opts.diagonaleZoll } : {}) }
      w = sehwinkelAnteil(sw, sw.winkelBogenminuten[w.slice('sehwinkel.'.length)])
    }
    if (w === 'profil.randPx') w = 0
    g[e.id] = w
    // reflow-320 ist noch nicht im Record (Vorschlag): dort ist jeder Befund WARNUNG.
    typ[e.id] = art === 'reflow' ? 'WARNUNG' : (e.typJeArt?.[art] ?? e.typ)
  }
  const monitorSchrift = art === 'monitor'
    ? { stand: g['monitor.schrift.stand'], lesetext: g['monitor.schrift.lesetext'], neben: g['monitor.schrift.neben'] }
    : null
  const std = gw.grenzwerte.find((e) => e.id === 'overscan.standard-px')?.wert ?? 48
  const randPx = profil.rand === 'standard' ? std : 0
  return { g, typ, monitorSchrift, randPx }
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function axeBefunde(page) {
  let AxeBuilder
  try {
    AxeBuilder = (await import('@axe-core/playwright')).default
  } catch {
    return { verfuegbar: false, befunde: [] }
  }
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  const befunde = []
  for (const v of r.violations) {
    const schwer = v.impact === 'critical' || v.impact === 'serious'
    for (const n of v.nodes.slice(0, 5)) {
      befunde.push({ metrik: schwer ? 'axe.schwer' : 'axe.leicht', selektor: n.target.join(' '), ist: `${v.id} (${v.impact})`, grenze: '0 Verstoesse', text: v.help })
    }
  }
  for (const v of r.incomplete.slice(0, 10)) {
    befunde.push({ metrik: 'axe.leicht', selektor: v.nodes[0]?.target.join(' ') ?? '?', ist: `${v.id} (incomplete)`, grenze: 'Sichtkritik', text: v.help })
  }
  return { verfuegbar: true, befunde }
}

const TEXTABSTAND_CSS = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'

async function main() {
  let o
  try {
    o = parseArgs(process.argv.slice(2))
  } catch (e) {
    process.stderr.write(`${e.message}\n\n${HILFE}\n`)
    return 2
  }
  if (o.hilfe) { process.stdout.write(`${HILFE}\n`); return 0 }
  if (!o.ziel) { process.stderr.write(`--ziel fehlt\n\n${HILFE}\n`); return 2 }

  let profile, themen, sprachen, varianten
  try {
    profile = loeseProfile(o.profil)
    themen = liste(o.themen, ['hell', 'dunkel'], '--themen')
    sprachen = liste(o.sprachen, ['de', 'en'], '--sprachen')
    varianten = liste(o.varianten, ['normal', 'langtext', 'textabstand'], '--varianten')
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    return 2
  }

  const gwPfad = resolve(o.grenzwerte ?? join(HIER, 'grenzwerte.json'))
  const gw = JSON.parse(readFileSync(gwPfad, 'utf8'))
  warneBeiAbweichung(gwPfad)
  const teamname = gw.grenzwerte.find((e) => e.id === 'langtext.teamname').wert
  const dehnung = gw.grenzwerte.find((e) => e.id === 'langtext.dehnung').wert

  const istUrl = /^https?:\/\//i.test(o.ziel)
  let url, quelle
  if (istUrl) {
    url = o.ziel
    quelle = { art: 'url', url }
  } else {
    const pfad = resolve(o.ziel)
    if (!existsSync(pfad)) { process.stderr.write(`Datei fehlt: ${pfad}\n`); return 2 }
    url = pathToFileURL(pfad).href
    quelle = { art: 'datei', datei: pfad, sha256: createHash('sha256').update(readFileSync(pfad)).digest('hex') }
  }

  const aus = resolve(o.aus ?? 'test-results/visual-metrics')
  mkdirSync(aus, { recursive: true })
  const stempel = new Date().toISOString().replace(/[:.]/g, '-')
  const berichtPfad = resolve(o.bericht ?? join(aus, `bericht-${stempel}.json`))
  mkdirSync(dirname(berichtPfad), { recursive: true })

  const bericht = {
    werkzeug: 'scripts/visual-metrics/messen.mjs',
    zeit: new Date().toISOString(),
    ziel: o.ziel,
    quelle,
    grenzwerte: { datei: gwPfad, version: gw.version, sehwinkel: { abstandM: o.abstandM ?? gw.sehwinkel.abstandM, diagonaleZoll: o.diagonaleZoll ?? gw.sehwinkel.diagonaleZoll } },
    matrix: { profile, themen, sprachen, varianten },
    status: 'GRUEN',
    gate: { gruende: [] },
    axe: o.axe ? 'an' : 'aus',
    laeufe: [],
    zusammenfassung: { hart: 0, warnung: 0 },
  }

  const browser = await chromium.launch()
  try {
    outer: for (const name of profile) {
      const profil = PROFILE[name]
      const { g, typ, monitorSchrift, randPx } = grenzenFuer(gw, profil.art, profil, o)
      for (const thema of themen) {
        for (const sprache of sprachen) {
          for (const variante of varianten) {
            const ctx = await browser.newContext({
              viewport: { width: profil.breite, height: profil.hoehe },
              deviceScaleFactor: 1,
              colorScheme: thema === 'dunkel' ? 'dark' : 'light',
              locale: sprache === 'de' ? 'de-DE' : 'en-US',
              reducedMotion: 'reduce',
            })
            await ctx.addInitScript((px) => {
              const setze = () => {
                document.documentElement.style.setProperty('--vm-overscan', `${px}px`)
                document.documentElement.setAttribute('data-vm-overscan', String(px))
              }
              if (document.documentElement) setze()
              else document.addEventListener('DOMContentLoaded', setze)
            }, randPx)
            const page = await ctx.newPage()
            await page.goto(url, { waitUntil: 'networkidle' })
            await page.evaluate(() => document.fonts.ready.then(() => undefined))
            const gate = await page.evaluate(pruefeGate)
            if (gate.gruende.length) {
              bericht.status = 'BLOCKED'
              bericht.gate = { ...gate, profil: name }
              await ctx.close()
              break outer
            }
            bericht.gate.build = gate.build
            bericht.gate.lang = gate.lang
            if (variante === 'langtext') {
              await page.evaluate(dehneTexte, { dehnung, teamname, teamSelektor: o.team ?? '[data-teamname]' })
            }
            if (variante === 'textabstand') await page.addStyleTag({ content: TEXTABSTAND_CSS })
            await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))

            const m = await page.evaluate(messeSeite, {
              art: profil.art, g, randPx, monitorSchrift,
              primarySelektor: o.primary ?? '[data-primary], [data-variant="primary"]',
              maxJeMetrik: 25,
            })
            let befunde = m.befunde
            if (o.axe && variante === 'normal') {
              const ax = await axeBefunde(page)
              bericht.axe = ax.verfuegbar ? 'an' : 'nicht verfuegbar'
              befunde = befunde.concat(ax.befunde)
            }
            const axeTyp = (id) => gw.grenzwerte.find((e) => e.id === id)?.typ ?? 'WARNUNG'
            befunde = befunde.map((b) => {
              const t = profil.art === 'reflow' ? 'WARNUNG' : (typ[b.metrik] ?? axeTyp(b.metrik))
              return { typ: t, ...b, profil: name, thema, sprache, variante, schluessel: [b.metrik, name, thema, sprache, variante, b.selektor].join('|') }
            })
            const hart = befunde.filter((b) => b.typ === 'HART').length
            const lauf = { profil: name, art: profil.art, viewport: `${profil.breite}x${profil.hoehe}`, randPx, thema, sprache, variante, info: m.info, hart, warnung: befunde.length - hart, befunde }
            if (o.screenshots && hart > 0) {
              const bild = join(aus, `${stempel}-${name}-${thema}-${sprache}-${variante}.png`)
              await page.screenshot({ path: bild })
              lauf.screenshot = bild
            }
            bericht.laeufe.push(lauf)
            bericht.zusammenfassung.hart += hart
            bericht.zusammenfassung.warnung += befunde.length - hart
            await ctx.close()
          }
        }
      }
    }
  } finally {
    await browser.close()
  }
  if (bericht.status !== 'BLOCKED' && bericht.zusammenfassung.hart > 0) bericht.status = 'ROT'

  writeFileSync(berichtPfad, `${JSON.stringify(bericht, null, 2)}\n`)
  const zeilen = [`Visuelle Messung: ${bericht.status} · Ziel ${o.ziel}`, `Bericht: ${berichtPfad}`]
  if (bericht.status === 'BLOCKED') {
    zeilen.push(`GATE rot (${bericht.gate.profil}):`, ...bericht.gate.gruende.map((g) => `  - ${g}`))
  } else {
    zeilen.push(`HART ${bericht.zusammenfassung.hart} · WARNUNG ${bericht.zusammenfassung.warnung} · Laeufe ${bericht.laeufe.length}`)
    zeilen.push('Metrik | Typ | Profil/Thema/Sprache/Variante | Selektor | Ist | Grenze')
    for (const l of bericht.laeufe) {
      for (const b of l.befunde) {
        zeilen.push(`${b.metrik} | ${b.typ} | ${l.profil}/${l.thema}/${l.sprache}/${l.variante} | ${b.selektor} | ${b.ist} | ${b.grenze}${b.text ? ` | "${b.text}"` : ''}`)
      }
    }
  }
  writeFileSync(berichtPfad.replace(/\.json$/, '.txt'), `${zeilen.join('\n')}\n`)
  process.stdout.write(o.json ? `${JSON.stringify(bericht, null, 2)}\n` : `${zeilen.join('\n')}\n`)
  return bericht.status === 'BLOCKED' ? 3 : bericht.status === 'ROT' ? 1 : 0
}

main().then(
  (code) => { process.exitCode = code },
  (e) => { process.stderr.write(`Fehler: ${e?.stack ?? e}\n`); process.exitCode = 4 },
)
