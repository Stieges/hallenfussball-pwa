#!/usr/bin/env node
// Visuelle Messung (Skill visuelle-pruefung, Plattform; Auftrag Daniel 2026-10-16, Fixrunde nach Review).
// Misst die App (eigener Build von HEAD, freier Port) oder eine Mockup-Datei in einer Geraete-Matrix gegen
// grenzwerte.json. Ausgabe: JSON-Bericht + gebuendelte Befundliste.
// Exit 0 gruen · 1 HART-Verstoss · 2 Aufruf falsch · 3 BLOCKED (Gate rot) · 4 Werkzeugfehler.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { messeSeite, pruefeGate, dehneTexte } from './browser-messung.mjs'
import { PROFILE, loeseProfile, istVolleGruppe, sehwinkelAnteil } from './profile.mjs'
import { starteApp, gitStand } from './app-server.mjs'
import { pseudoRechtecke } from './pseudo.mjs'
import { buendle, textBericht } from './ausgabe.mjs'
import { leseSaat, installiereSaat } from './saat/lader.mjs'
import { fuehreAnsichtenAus } from './ansichten.mjs'
import { STUB_URL, installiereStub, leseStub } from './stub.mjs'

const HIER = dirname(fileURLToPath(import.meta.url))
const STANDARD_GW = join(HIER, 'grenzwerte.json')
const STANDARD_PRIMARY = '[data-primary], [data-variant="primary"]'
const STANDARD_TEAM = '[data-teamname]'

const HILFE = `Aufruf:
  npm run visual:metrics -- --app <pfad> --erwarte <css> [Optionen]      App (baut HEAD, freier Port)
  npm run visual:metrics -- --ziel <datei.html[?param]> [Optionen]        Mockup (Modus MOCKUP)
  npm run visual:metrics -- --ziel http://127.0.0.1:<port>/… --erwarte <css>   laufendes Preview mit vm-build.json

  --app <pfad>              App-Ansicht, z. B. /login; Build ohne .env, Stand = HEAD
  --ziel <url|datei>        Mockup-Datei (Geraet = Viewport, ohne Rahmen) oder lokales Preview
  --erwarte <css>           Pflicht fuer App: Element der erwarteten Ansicht (sonst BLOCKED)
  --saat <name>             feste Testdaten (scripts/visual-metrics/saat/<name>.json) vor dem ersten Laden in
                            IndexedDB/localStorage ablegen und die Einwilligung setzen (z. B. hallencup-messlauf)
  --stub <datei>/<zustand>  Server-Antworten per Netz-Stub (scripts/visual-metrics/stubs/<datei>.json): Build mit lokaler Scheinadresse,
                            alle Aufrufe daran beantwortet der Stub (nur fuer --app; kein Datenbank-Stand, keine Migration)
  --bilder <ordner>         je Lauf hell/de/normal ein Bild nach <ordner>/<name>-<profil>.png (Sichtvergleich gegen das Mockup)
  --ansichten <gruppe>      alle Pflicht-Ansichten aus ansichten.json nacheinander messen (Gruppe: pflicht);
                            weitere Optionen (--themen, --sprachen, --varianten, --ohne-axe, --screenshots, --aus) gelten fuer jede
                            Ansicht; --profil <p> ersetzt das Profil der App-Ansichten, --monitor-profil <p> das der Monitor-Folien;
                            --nur <id,id> misst nur diese Ansichten
  --klick <selektor>        Vorbedingung, mehrfach (z. B. Datenschutz-Abfrage: 'role=button[name=/notwendig/i]'); 'warte:<ms>' wartet statt zu klicken, 'scroll:oben' rollt alles an den Anfang
  --profil <liste>          app (Standard) | monitor | handy | tablet | desktop | reflow | Profilname(n)
                            Profile: ${Object.keys(PROFILE).join(', ')}
                            Monitor-Profile laufen immer paarweise (Rand 0 + Standard)
  --themen hell,dunkel  --sprachen de,en  --varianten normal,langtext[,textabstand]
  --ohne-axe                axe-core auslassen (dann TEILMATRIX)
  --grenzwerte <pfad> --abstand-m <m> --diagonale-zoll <z> --primary-selektor <css> --team-selektor <css>
                            Abweichungen: nur mit --begruendung "<text>", sonst BLOCKED
  --begruendung <text>      steht im Bericht; Lauf ist nie VOLLMATRIX
  --neu-bauen               App-Build erzwingen
  --aus <ordner> --bericht <datei.json> --screenshots --json
  --ausfuehrlich            Einzelzeilen und Vorfahren-Kette ausgeben
  --help

Status: GRUEN/ROT/BLOCKED · VOLLMATRIX/TEILMATRIX · APP/MOCKUP
Exit: 0 gruen · 1 HART-Verstoss · 2 Aufruf falsch · 3 BLOCKED (Gate rot) · 4 Werkzeugfehler`

function parseArgs(argv) {
  const o = { profil: 'app', themen: 'hell,dunkel', sprachen: 'de,en', varianten: 'normal,langtext', axe: true, klick: [] }
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
      case '--app': o.app = wert(); break
      case '--erwarte': o.erwarte = wert(); break
      case '--klick': o.klick.push(wert()); break
      case '--saat': o.saat = wert(); break
      case '--stub': o.stub = wert(); break
      case '--bilder': o.bilder = wert(); break
      case '--ansichten': o.ansichten = wert(); break
      case '--nur': o.nur = wert(); break
      case '--monitor-profil': o.monitorProfil = wert(); break
      case '--profil': o.profil = wert(); break
      case '--themen': o.themen = wert(); break
      case '--sprachen': o.sprachen = wert(); break
      case '--varianten': o.varianten = wert(); break
      case '--grenzwerte': o.grenzwerte = wert(); break
      case '--abstand-m': o.abstandM = Number(wert()); break
      case '--diagonale-zoll': o.diagonaleZoll = Number(wert()); break
      case '--primary-selektor': o.primary = wert(); break
      case '--team-selektor': o.team = wert(); break
      case '--begruendung': o.begruendung = wert(); break
      case '--ohne-axe': o.axe = false; break
      case '--neu-bauen': o.neuBauen = true; break
      case '--aus': o.aus = wert(); break
      case '--bericht': o.bericht = wert(); break
      case '--screenshots': o.screenshots = true; break
      case '--json': o.json = true; break
      case '--ausfuehrlich': o.ausfuehrlich = true; break
      default: throw new Error(`Unbekannte Option ${a}`)
    }
  }
  return o
}

const liste = (s, erlaubt, name) => {
  const l = String(s).split(',').map((x) => x.trim()).filter(Boolean)
  for (const x of l) if (!erlaubt.includes(x)) throw new Error(`${name}: "${x}" nicht erlaubt (${erlaubt.join(', ')})`)
  return l
}

function skillKopieAbweichend(eigen) {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: HIER, encoding: 'utf8' }).trim()
    for (const k of [join(process.cwd(), '.claude/skills/visuelle-pruefung/grenzwerte.json'), join(dirname(common), '.claude/skills/visuelle-pruefung/grenzwerte.json')]) {
      if (existsSync(k) && readFileSync(k, 'utf8') !== eigen) return k
    }
  } catch { /* ohne git keine Pruefung */ }
  return null
}

function grenzenFuer(gw, profil, opts, modus) {
  const art = profil.art
  const g = {}
  const typ = {}
  const sw = { ...gw.sehwinkel, ...(opts.abstandM ? { abstandM: opts.abstandM } : {}), ...(opts.diagonaleZoll ? { diagonaleZoll: opts.diagonaleZoll } : {}) }
  for (const e of gw.grenzwerte) {
    if (!e.geltung.includes(art) || e.id.startsWith('gate.') || e.id.startsWith('langtext.') || e.id === 'overscan.standard') continue
    let w = e.wert
    if (typeof w === 'string' && w.startsWith('sehwinkel.')) w = sehwinkelAnteil(sw, sw.winkelBogenminuten[w.slice('sehwinkel.'.length)])
    if (w === 'profil.randPx') w = 0
    g[e.id] = w
    // reflow-320 ist noch nicht im Record: dort ist jeder Befund WARNUNG.
    typ[e.id] = art === 'reflow' ? 'WARNUNG' : (e.typJeArt?.[art] ?? e.typ)
  }
  const monitorSchrift = art === 'monitor' ? { stand: g['monitor.schrift.stand'], lesetext: g['monitor.schrift.lesetext'], nah: g['monitor.schrift.nah'] } : null
  const std = gw.grenzwerte.find((e) => e.id === 'overscan.standard')?.wert ?? 48
  // Die App liest den Profil-Rand nicht (Paket Rand-URL-Parameter offen): dort nur "im Fenster" pruefen.
  const randPx = modus === 'APP' ? 0 : profil.rand === 'standard' ? std : 0
  const ebuPruefen = art === 'monitor' && (modus === 'APP' || profil.rand === 'standard')
  return { g, typ, monitorSchrift, randPx, injektionPx: profil.rand === 'standard' ? std : 0, ebuPruefen }
}

// Ausnahmeliste einer Regel (grenzwerte.json, Feld ausnahmeliste): Eintrag { befund, begruendung, selektor?, verdecktVon?, app? } (mindestens selektor oder verdecktVon).
// Greift nur, wenn Metrik, Element (Teilstring des Selektors), ggf. verdeckendes Element und ggf. Ansicht passen.
function bekannteAusnahme(gw, b, ziel) {
  const regel = gw.grenzwerte.find((e) => e.id === b.metrik)
  for (const a of regel?.ausnahmeliste ?? []) {
    if (a.selektor && !String(b.selektor).includes(a.selektor)) continue
    if (a.verdecktVon && !String(b.verdecktVon ?? '').includes(a.verdecktVon)) continue
    if (a.app && !String(ziel).includes(a.app)) continue
    return a
  }
  return null
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
    for (const n of v.nodes) befunde.push({ metrik: schwer ? 'axe.schwer' : 'axe.leicht', selektor: n.target.join(' '), ist: `${v.id} (${v.impact})`, grenze: '0 Verstoesse', text: v.help })
  }
  for (const v of r.incomplete) befunde.push({ metrik: 'axe.leicht', selektor: v.nodes[0]?.target.join(' ') ?? '?', ist: `${v.id} (incomplete)`, grenze: 'Sichtkritik', text: v.help })
  return { verfuegbar: true, befunde }
}

const TEXTABSTAND_CSS = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'
const LOKAL = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])
const PROD_DB = /\b[a-z0-9]{20}\.supabase\.co\b/
const normUrl = (u) => {
  const x = new URL(u)
  return `${x.origin}${x.pathname.replace(/\/+$/, '') || '/'}${x.search}`
}

async function main() {
  let o
  try {
    o = parseArgs(process.argv.slice(2))
  } catch (e) {
    process.stderr.write(`${e.message}\n\n${HILFE}\n`)
    return 2
  }
  if (o.hilfe) { process.stdout.write(`${HILFE}\n`); return 0 }
  if (o.ansichten) return fuehreAnsichtenAus(o, process.argv.slice(2), HIER)
  if (!o.ziel === !o.app) { process.stderr.write(`Genau eines von --ziel oder --app angeben.\n\n${HILFE}\n`); return 2 }
  const istHttp = !!o.ziel && /^https?:\/\//i.test(o.ziel)
  const modus = o.app || istHttp ? 'APP' : 'MOCKUP'
  if (modus === 'APP' && !o.erwarte) { process.stderr.write('--erwarte <css> ist fuer App-Ziele Pflicht (belegt die erwartete Ansicht).\n'); return 2 }

  let saat = null
  if (o.saat) {
    if (!o.app) { process.stderr.write('--saat gilt nur fuer --app (die App liest die Daten aus ihrem Speicher).\n'); return 2 }
    try {
      saat = leseSaat(o.saat)
    } catch (e) {
      process.stderr.write(`${e.message}\n`)
      return 2
    }
  }
  let stub = null
  if (o.stub) {
    if (!o.app) { process.stderr.write('--stub gilt nur fuer --app.\n'); return 2 }
    try {
      stub = leseStub(o.stub)
    } catch (e) {
      process.stderr.write(`${e.message}\n`)
      return 2
    }
  }
  let profilAuswahl, themen, sprachen, varianten
  try {
    profilAuswahl = loeseProfile(o.profil)
    themen = liste(o.themen, ['hell', 'dunkel'], '--themen')
    sprachen = liste(o.sprachen, ['de', 'en'], '--sprachen')
    varianten = liste(o.varianten, ['normal', 'langtext', 'textabstand'], '--varianten')
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    return 2
  }
  const profile = profilAuswahl.namen

  const gwPfad = resolve(o.grenzwerte ?? STANDARD_GW)
  const gwText = readFileSync(gwPfad, 'utf8')
  const gw = JSON.parse(gwText)
  const abweichungen = []
  if (gwText !== readFileSync(STANDARD_GW, 'utf8')) abweichungen.push(`eigene Grenzwerte ${gwPfad}`)
  if (o.abstandM && o.abstandM !== gw.sehwinkel.abstandM) abweichungen.push(`Abstand ${o.abstandM} m statt ${gw.sehwinkel.abstandM} m`)
  if (o.diagonaleZoll && o.diagonaleZoll !== gw.sehwinkel.diagonaleZoll) abweichungen.push(`Diagonale ${o.diagonaleZoll} Zoll statt ${gw.sehwinkel.diagonaleZoll}`)
  if (o.primary && o.primary !== STANDARD_PRIMARY) abweichungen.push(`Haupttasten-Selektor ${o.primary}`)
  if (o.team && o.team !== STANDARD_TEAM) abweichungen.push(`Teamnamen-Selektor ${o.team}`)
  const kopieAbw = skillKopieAbweichend(readFileSync(STANDARD_GW, 'utf8'))
  if (kopieAbw) process.stderr.write(`WARNUNG: ${kopieAbw} weicht von ${STANDARD_GW} ab – angleichen (nie lockern).\n`)
  const teamname = gw.grenzwerte.find((e) => e.id === 'langtext.teamname').wert
  const dehnung = gw.grenzwerte.find((e) => e.id === 'langtext.dehnung').wert

  const aus = resolve(o.aus ?? 'test-results/visual-metrics')
  mkdirSync(aus, { recursive: true })
  const stempel = new Date().toISOString().replace(/[:.]/g, '-')
  const berichtPfad = resolve(o.bericht ?? join(aus, `bericht-${stempel}.json`))
  mkdirSync(dirname(berichtPfad), { recursive: true })

  const vollmatrix = istVolleGruppe(profile) && themen.length === 2 && sprachen.length === 2 &&
    varianten.includes('normal') && varianten.includes('langtext') && o.axe && abweichungen.length === 0
  const bericht = {
    werkzeug: 'scripts/visual-metrics/messen.mjs',
    zeit: new Date().toISOString(),
    ziel: o.app ? `app:${o.app}` : o.ziel,
    modus,
    berichtPfad,
    quelle: {},
    grenzwerte: { datei: gwPfad, version: gw.version, sehwinkel: { abstandM: o.abstandM ?? gw.sehwinkel.abstandM, diagonaleZoll: o.diagonaleZoll ?? gw.sehwinkel.diagonaleZoll } },
    matrix: { profile, ergaenzt: profilAuswahl.ergaenzt, themen, sprachen, varianten, axe: o.axe, erwarte: o.erwarte ?? null, klick: o.klick, saat: o.saat ?? null },
    vollmatrix,
    abweichungen,
    begruendung: o.begruendung ?? null,
    status: 'GRUEN',
    gate: { gruende: [], warnungen: [] },
    markierungen: { primaer: 0, teamname: 0, monitor: 0, titel: 0 },
    ausnahmen: [],
    laeufe: [],
    gebuendelt: [],
    zusammenfassung: { hart: 0, warnung: 0, hartBefunde: 0, warnBefunde: 0, zaehler: {} },
  }
  const schreibe = () => {
    // VOLLMATRIX nur, wenn die ganze Matrix tatsaechlich gelaufen ist.
    if (bericht.status === 'BLOCKED' || bericht.laeufe.length !== profile.length * themen.length * sprachen.length * varianten.length) bericht.vollmatrix = false
    bericht.gebuendelt = buendle(bericht.laeufe)
    bericht.zusammenfassung.hartBefunde = bericht.gebuendelt.filter((g) => g.typ === 'HART').length
    bericht.zusammenfassung.warnBefunde = bericht.gebuendelt.length - bericht.zusammenfassung.hartBefunde
    writeFileSync(berichtPfad, `${JSON.stringify(bericht, null, 2)}\n`)
    const text = textBericht(bericht, { ausfuehrlich: o.ausfuehrlich })
    writeFileSync(berichtPfad.replace(/\.json$/, '.txt'), `${text}\n`)
    process.stdout.write(o.json ? `${JSON.stringify(bericht, null, 2)}\n` : `${text}\n`)
  }
  const blockiere = (gruende, profil) => {
    bericht.status = 'BLOCKED'
    bericht.gate.gruende.push(...gruende)
    if (profil) bericht.gate.profil = profil
  }

  if (abweichungen.length && !o.begruendung) {
    blockiere([`Abweichung von den Standardwerten ohne --begruendung: ${abweichungen.join('; ')}`])
    schreibe()
    return 3
  }

  // ---------- Ziel aufloesen und Build-Nachweis (App) ----------
  let url, app = null
  const head = gitStand()
  bericht.quelle.head = head.sha
  if (modus === 'MOCKUP') {
    const [pfadTeil, ...rest] = o.ziel.split('?')
    const pfad = resolve(pfadTeil)
    if (!existsSync(pfad)) { process.stderr.write(`Datei fehlt: ${pfad}\n`); return 2 }
    url = pathToFileURL(pfad).href + (rest.length ? `?${rest.join('?')}` : '')
    bericht.quelle = { ...bericht.quelle, art: 'datei', datei: pfad, sha256: createHash('sha256').update(readFileSync(pfad)).digest('hex') }
  } else {
    if (o.app) {
      app = await starteApp({ neuBauen: o.neuBauen, stubUrl: stub ? STUB_URL : null, log: (t) => process.stderr.write(`${t}\n`) })
      url = new URL(o.app, app.basisUrl).href
    } else {
      url = o.ziel
    }
    const host = new URL(url).hostname
    bericht.quelle = { ...bericht.quelle, art: o.app ? 'app-build' : 'url', url }
    if (!LOKAL.has(host)) {
      blockiere([`Ziel ${host} ist nicht lokal: keine Produktion und keine fremden Server messen (B-20)`])
    } else {
      try {
        const res = await fetch(new URL('/vm-build.json', url), { signal: AbortSignal.timeout(10000) })
        const st = res.ok ? await res.json() : null
        if (!st) blockiere(['Kein Build-Nachweis (vm-build.json fehlt): App mit --app messen, nicht gegen einen fremden oder alten Server'])
        else {
          bericht.quelle.build = { sha: st.sha, veraendert: st.veraendert, aenderungen: st.aenderungen, gebaut: st.gebaut }
          if (st.sha !== head.sha) blockiere([`Build-Stand ${String(st.sha).slice(0, 8)} ist nicht HEAD ${head.kurz}`])
          if (app && st.nonce !== app.nonce) blockiere(['Build-Nachweis gehoert nicht zu diesem Lauf (fremder Server auf dem Port)'])
          if (st.veraendert) bericht.gate.warnungen.push(`Arbeitsbaum veraendert (${st.aenderungen} Dateien): Build enthaelt nicht committete Aenderungen`)
        }
      } catch (e) {
        blockiere([`Build-Nachweis nicht abrufbar: ${e.message}`])
      }
    }
    bericht.gate.warnungen.push('App liest den TV-Rand nicht aus dem Profil (Paket Rand-URL-Parameter offen): Monitor-Profile Rand 0 und Standard messen dasselbe; geprueft wird "im Fenster" + EBU 5 % als WARNUNG')
  }
  if (bericht.status === 'BLOCKED') {
    if (app) await app.stop()
    schreibe()
    return 3
  }

  const browser = await chromium.launch()
  try {
    outer: for (const name of profile) {
      const profil = PROFILE[name]
      const { g, typ, monitorSchrift, randPx, injektionPx, ebuPruefen } = grenzenFuer(gw, profil, o, modus)
      for (const thema of themen) {
        for (const sprache of sprachen) {
          for (const variante of varianten) {
            const ctx = await browser.newContext({
              viewport: { width: profil.breite, height: profil.hoehe },
              deviceScaleFactor: profil.dpr ?? 1,
              colorScheme: thema === 'dunkel' ? 'dark' : 'light',
              locale: sprache === 'de' ? 'de-DE' : 'en-US',
              reducedMotion: 'reduce',
              serviceWorkers: 'block',
            })
            if (saat) await installiereSaat(ctx, saat)
            if (stub) await installiereStub(ctx, stub)
            await ctx.addInitScript((px) => {
              const setze = () => {
                for (const v of ['--vm-overscan', '--vm-overscan-x', '--vm-overscan-y']) document.documentElement.style.setProperty(v, `${px}px`)
                document.documentElement.setAttribute('data-vm-overscan', String(px))
              }
              if (document.documentElement) setze()
              else document.addEventListener('DOMContentLoaded', setze)
            }, injektionPx)
            const page = await ctx.newPage()
            const skripte = []
            if (modus === 'APP') {
              page.on('response', (r) => {
                if (r.request().resourceType() === 'script') skripte.push(r.text().catch(() => ''))
              })
            }
            const gr = []
            await page.goto(url, { waitUntil: 'networkidle' })
            for (const k of o.klick) {
              // 'warte:<ms>' wartet, statt zu klicken (z. B. die Sperre des Nummern-Bausteins von 300 ms, @SL-021)
              const warte = /^warte:(\d+)$/.exec(k)
              if (warte) { await page.waitForTimeout(Number(warte[1])); continue }
              // 'fill:<selektor>=<text>' tippt Text in ein Feld (z. B. den Namen des Helfers), dann weiter
              const fuell = /^fill:(.+?)=(.*)$/.exec(k)
              if (fuell) {
                try { await page.locator(fuell[1]).first().fill(fuell[2], { timeout: 5000 }) } catch { gr.push(`Vorbedingung nicht erfuellbar: Eingabe in ${fuell[1]}`) }
                continue
              }
              // 'scroll:oben' stellt den Messzustand ohne Klick-Scroll her (Fenster und alle Rollbereiche an den Anfang)
              if (k === 'scroll:oben') {
                await page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0 })
                await page.waitForTimeout(100)
                continue
              }
              try {
                await page.locator(k).first().click({ timeout: 5000 })
                await page.waitForLoadState('networkidle')
              } catch {
                gr.push(`Vorbedingung nicht erfuellbar: Klick auf ${k}`)
              }
            }
            if (modus === 'APP' && normUrl(page.url()) !== normUrl(url)) gr.push(`Umleitung: ${normUrl(url)} endet auf ${normUrl(page.url())} – gemessen wuerde die falsche Ansicht`)
            if (o.erwarte) {
              try {
                await page.locator(o.erwarte).first().waitFor({ state: 'visible', timeout: 10000 })
              } catch {
                gr.push(`Erwartete Ansicht fehlt: ${o.erwarte} nicht sichtbar`)
              }
            }
            await page.evaluate(() => document.fonts.ready.then(() => undefined))
            const gate = await page.evaluate(pruefeGate, { modus })
            gr.push(...gate.gruende)
            for (const w of gate.warnungen) if (!bericht.gate.warnungen.includes(w)) bericht.gate.warnungen.push(w)
            if (modus === 'APP') {
              for (const t of await Promise.all(skripte)) {
                if (PROD_DB.test(t)) { gr.push('Bundle enthaelt eine Supabase-Projekt-URL: Produktion wird nicht gemessen (B-20)'); break }
                const m = t.match(/buildHash:`([^`]+)`/)
                if (m && m[1] !== head.kurz) { gr.push(`Bundle-Hash ${m[1]} ist nicht HEAD ${head.kurz}`); break }
              }
            }
            if (gr.length) {
              blockiere([...new Set(gr)], `${name}/${thema}/${sprache}/${variante}`)
              await ctx.close()
              break outer
            }
            bericht.gate.lang = gate.lang
            if (variante === 'langtext') await page.evaluate(dehneTexte, { dehnung, teamname, teamSelektor: o.team ?? STANDARD_TEAM })
            if (variante === 'textabstand') await page.addStyleTag({ content: TEXTABSTAND_CSS })
            await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
            const extraInhalte = profil.art === 'monitor' ? await pseudoRechtecke(page) : []

            const m = await page.evaluate(messeSeite, {
              art: profil.art, g, randPx, monitorSchrift, ebuPruefen, extraInhalte,
              primarySelektor: o.primary ?? STANDARD_PRIMARY,
              ausfuehrlich: !!o.ausfuehrlich,
            })
            if (m.info.texttraeger === 0) {
              blockiere(['Ansicht leer: kein sichtbarer Text gemessen (falsche Ansicht, nicht geladen oder alles verborgen)'], `${name}/${thema}/${sprache}/${variante}`)
              await ctx.close()
              break outer
            }
            let befunde = m.befunde
            if (o.axe && variante === 'normal') befunde = befunde.concat((await axeBefunde(page)).befunde)
            const axeTyp = (id) => gw.grenzwerte.find((e) => e.id === id)?.typ ?? 'WARNUNG'
            befunde = befunde.map((b) => {
              const t = profil.art === 'reflow' ? 'WARNUNG' : (typ[b.metrik] ?? axeTyp(b.metrik))
              return { typ: t, ...b }
            })
            // Bekannte Verstoesse auf main (ausnahmeliste mit Befund-Kennung): WARNUNG mit Kennung statt HART.
            befunde = befunde.map((b) => {
              const a = b.typ === 'HART' ? bekannteAusnahme(gw, b, o.app ?? o.ziel ?? '') : null
              return a ? { ...b, typ: 'WARNUNG', ausnahme: a.befund, ist: `${b.ist} [bekannt: ${a.befund}]` } : b
            })
            const hart = befunde.filter((b) => b.typ === 'HART').length
            const lauf = { profil: name, art: profil.art, viewport: `${profil.breite}x${profil.hoehe}@${profil.dpr ?? 1}`, randPx, thema, sprache, variante, info: m.info, markierungen: m.markierungen, zaehler: m.zaehler, hart, warnung: befunde.length - hart, befunde }
            for (const k of Object.keys(bericht.markierungen)) bericht.markierungen[k] = Math.max(bericht.markierungen[k], m.markierungen[k])
            for (const a of m.ausnahmen) if (!bericht.ausnahmen.some((x) => x.attr === a.attr && x.selektor === a.selektor)) bericht.ausnahmen.push(a)
            for (const [k, v] of Object.entries(m.zaehler)) bericht.zusammenfassung.zaehler[k] = (bericht.zusammenfassung.zaehler[k] ?? 0) + v
            if (o.bilder && thema === 'hell' && sprache === 'de' && variante === 'normal') {
              mkdirSync(o.bilder, { recursive: true })
              await page.screenshot({ path: join(o.bilder, `${(stub?.name ?? 'seite').replace('/', '-')}-${name}.png`), fullPage: true })
            }
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
    if (app) await app.stop()
  }
  if (bericht.status !== 'BLOCKED' && bericht.zusammenfassung.hart > 0) bericht.status = 'ROT'
  schreibe()
  return bericht.status === 'BLOCKED' ? 3 : bericht.status === 'ROT' ? 1 : 0
}

main().then(
  (code) => { process.exitCode = code },
  (e) => { process.stderr.write(`Fehler: ${e?.stack ?? e}\n`); process.exitCode = 4 },
)
