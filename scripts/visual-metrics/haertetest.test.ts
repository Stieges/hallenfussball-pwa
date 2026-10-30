// Haertetest des Messskripts scripts/visual-metrics/messen.mjs (Skill visuelle-pruefung, Plattform).
// Lauf: npm run test:visual-metrics (braucht Chromium; baut die App). Nicht im Unit-Job (Review B-17).
//
// Die drei Fehler vom 2026-10-16 und die Varianten aus dem Review liegen als Fixtures vor; jeder wird
// gefunden, jedes Gegenbeispiel ist gruen. Dazu: Gate (Build-Nachweis, Umleitung, erwartete Ansicht,
// Produktion, Mockup-Rahmen), Fehlalarm-Faelle (Langtext, Dialog, Verlauf, Emoji) und Schummel-Wege.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { basename, join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error -- ESM-Hilfsmodul ohne Typen
import { sehwinkelAnteil } from './profile.mjs'

const ORDNER = __dirname
const FIX = (name: string) => join(ORDNER, 'fixtures', name)
const AUS = resolve(ORDNER, '..', '..', 'test-results', 'visual-metrics-haertetest')
const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ORDNER, encoding: 'utf8' }).trim()

interface Befund { metrik: string; typ: string; selektor: string }
interface Lauf { profil: string; hart: number; befunde: Befund[] }
interface Gruppe { typ: string; metrik: string; profile: string[]; anzahl: number }
interface Bericht {
  status: string; modus: string; vollmatrix: boolean; abweichungen: string[]
  gate: { gruende: string[]; warnungen: string[] }
  matrix: { profile: string[]; ergaenzt: string[] }
  quelle: { build?: { sha: string } }
  ausnahmen: { attr: string }[]
  laeufe: Lauf[]; gebuendelt: Gruppe[]
  zusammenfassung: { hart: number; zaehler: Record<string, number> }
}

let nr = 0
// Asynchron (spawn statt spawnSync): der HTTP-Server dieses Tests muss waehrend der Messung antworten koennen.
function messe(...args: string[]): Promise<{ code: number | null; b: Bericht; out: string }> {
  const bericht = join(AUS, `b${String(++nr)}.json`)
  return new Promise((ok, fehler) => {
    const p = spawn('node', [join(ORDNER, 'messen.mjs'), '--aus', AUS, '--bericht', bericht, ...args])
    let out = ''
    p.stdout.on('data', (d: Buffer) => { out += d.toString() })
    p.stderr.on('data', (d: Buffer) => { out += d.toString() })
    p.on('close', (code) => {
      try {
        ok({ code, b: JSON.parse(readFileSync(bericht, 'utf8')) as Bericht, out })
      } catch {
        fehler(new Error(`kein Bericht (Exit ${String(code)}): ${out}`))
      }
    })
  })
}
const SCHNELL = ['--themen', 'hell', '--sprachen', 'de', '--ohne-axe']
const hart = (b: Bericht) => new Set(b.laeufe.flatMap((l) => l.befunde.filter((x) => x.typ === 'HART').map((x) => x.metrik)))
const warn = (b: Bericht) => new Set(b.laeufe.flatMap((l) => l.befunde.filter((x) => x.typ === 'WARNUNG').map((x) => x.metrik)))
const gruende = (b: Bericht) => b.gate.gruende.join(' | ')
// Bei Fehlschlag steht die gebuendelte Befundliste im Log (CI-Befund 2026-10-16: nur "expected 1 to be 0" sichtbar).
const gruen = (r: { code: number | null; out: string }) => { expect(r.code, r.out).toBe(0) }

// Kleiner HTTP-Server fuer Gate-Faelle: liefert Fixtures, optional vm-build.json und eine Umleitung.
let server: Server
let basis = ''
let stempel: object | null = null
beforeAll(async () => {
  mkdirSync(AUS, { recursive: true })
  server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x')
    if (u.pathname === '/vm-build.json') {
      if (!stempel) { res.writeHead(404).end(); return }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(stempel))
      return
    }
    if (u.pathname === '/alt') { res.writeHead(302, { location: '/attrappe-ohne-meta.html' }).end(); return }
    // Nur Dateien direkt im Fixture-Ordner ausliefern (kein Pfad aus der Anfrage ausserhalb davon).
    const datei = resolve(ORDNER, 'fixtures', basename(decodeURIComponent(u.pathname)))
    let inhalt: Buffer
    try {
      inhalt = readFileSync(datei)
    } catch {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': datei.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' }).end(inhalt)
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => { ok() }))
  basis = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
})
afterAll(async () => {
  await new Promise<void>((ok) => server.close(() => { ok() }))
  rmSync(AUS, { recursive: true, force: true })
})

describe('Fehler 1 "Turnierver-/waltung" und Varianten', () => {
  it('Titel mit hyphens:auto: Wortbruch und text.hyphens sind HART (Exit 1)', async () => {
    const r = await messe('--ziel', FIX('titel-silbentrennung.html'), '--profil', 'handy-360', ...SCHNELL)
    expect(r.code).toBe(1)
    expect([...hart(r.b)]).toEqual(expect.arrayContaining(['titel.wortbruch', 'text.hyphens']))
  })
  it.each([
    ['titel-span-hyphens.html', 'text.hyphens'],
    ['teamname-zelle.html', 'text.hyphens'],
    ['titel-shy.html', 'titel.wortbruch'],
    ['titel-zwei-spans.html', 'titel.wortbruch'],
  ])('Variante %s wird gefunden (%s)', async (datei, metrik) => {
    const r = await messe('--ziel', FIX(datei), '--profil', 'handy-360', ...SCHNELL)
    expect(r.code).toBe(1)
    expect(hart(r.b).has(metrik)).toBe(true)
  })
  it('Gegenbeispiel: korrigierter Titel ist in der vollen App-Matrix gruen und VOLLMATRIX', async () => {
    const r = await messe('--ziel', FIX('titel-silbentrennung-korrigiert.html'), '--profil', 'app')
    gruen(r)
    expect(r.b.status).toBe('GRUEN')
    expect(r.b.vollmatrix).toBe(true)
    expect(r.b.modus).toBe('MOCKUP')
    expect(r.b.laeufe).toHaveLength(5 * 2 * 2 * 2)
  })
  it.each(['titel-span-hyphens-korrigiert.html', 'teamname-zelle-korrigiert.html'])('Gegenbeispiel %s ist gruen', async (datei) => {
    const r = await messe('--ziel', FIX(datei), '--profil', 'handy', ...SCHNELL)
    gruen(r)
  })
})

describe('Fehler 2 abgeschnittener Monitor-Kopf und Varianten', () => {
  it('nur mit Standard-Rand rot, mit Rand 0 unsichtbar; alle drei Aufloesungen inkl. 960x540', async () => {
    const r = await messe('--ziel', FIX('monitor-kopf.html'), '--profil', 'monitor', '--varianten', 'normal', '--ohne-axe')
    expect(r.code).toBe(1)
    expect(r.b.laeufe.filter((l) => l.profil.endsWith('rand0')).every((l) => l.hart === 0)).toBe(true)
    const std = r.b.laeufe.filter((l) => l.profil.endsWith('standard'))
    expect(new Set(std.map((l) => l.profil))).toEqual(new Set(['monitor-1080-standard', 'monitor-720-standard', 'monitor-540-standard']))
    expect(std.every((l) => l.befunde.some((b) => b.typ === 'HART' && b.metrik === 'overscan.app-rand'))).toBe(true)
  })
  it.each(['monitor-fuss-abgeschnitten.html', 'rand-hintergrundbild.html', 'rand-pseudo.html'])('Variante %s wird gefunden', async (datei) => {
    const r = await messe('--ziel', FIX(datei), '--profil', 'monitor-1080-standard', '--varianten', 'normal', ...SCHNELL)
    expect(r.code).toBe(1)
    expect(hart(r.b).has('overscan.app-rand')).toBe(true)
  })
  it.each(['monitor-kopf-korrigiert.html', 'rand-hintergrundbild-korrigiert.html', 'rand-pseudo-korrigiert.html'])(
    'Gegenbeispiel %s ist mit Rand 0 und Standard-Rand gruen (Variante normal)', async (datei) => {
      const r = await messe('--ziel', FIX(datei), '--profil', 'monitor', '--varianten', 'normal')
      gruen(r)
      expect(r.b.laeufe).toHaveLength(6 * 2 * 2)
    })
})

describe('Fehler 3 Attrappe statt echter Stand: Gate', () => {
  it('Attrappe mit Meta-Tag: BLOCKED', async () => {
    const r = await messe('--ziel', FIX('monitor-attrappe.html'), '--profil', 'monitor-1080-rand0', '--varianten', 'normal', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/Attrappe/)
  })
  it('Attrappe ohne Meta-Tag als Datei: nur Modus MOCKUP, nie App-Beleg', async () => {
    const r = await messe('--ziel', FIX('attrappe-ohne-meta.html'), '--profil', 'monitor-1080-rand0', '--varianten', 'normal', ...SCHNELL)
    expect(r.b.modus).toBe('MOCKUP')
    expect(r.out).toMatch(/Mockup-Modus – belegt nicht den Stand der App/)
  })
  it('Attrappe ohne Meta-Tag per HTTP (fremder Server): BLOCKED ohne Build-Nachweis', async () => {
    stempel = null
    const r = await messe('--ziel', `${basis}/attrappe-ohne-meta.html`, '--erwarte', 'main', '--profil', 'monitor-1080-rand0', '--varianten', 'normal', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/Kein Build-Nachweis/)
  })
  it('alter Build (vm-build.json mit anderem Commit): BLOCKED', async () => {
    stempel = { sha: '0'.repeat(40), veraendert: false }
    const r = await messe('--ziel', `${basis}/attrappe-ohne-meta.html`, '--erwarte', 'main', '--profil', 'monitor-1080-rand0', '--varianten', 'normal', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/ist nicht HEAD/)
  })
  it('Umleitung auf eine andere Ansicht: BLOCKED', async () => {
    stempel = { sha: HEAD, veraendert: false }
    const r = await messe('--ziel', `${basis}/alt`, '--erwarte', 'main', '--profil', 'monitor-1080-rand0', '--varianten', 'normal', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/Umleitung/)
  })
  it('nicht lokales Ziel (Produktion): BLOCKED ohne Netzzugriff', async () => {
    const r = await messe('--ziel', 'https://example.invalid/display/1/2', '--erwarte', 'main', '--profil', 'monitor-1080-rand0', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/nicht lokal/)
  })
  it('Vite-Dev-Server: BLOCKED', async () => {
    const r = await messe('--ziel', FIX('dev-server.html'), '--profil', 'monitor-720-standard', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/Vite-Dev-Server/)
  })
  it('leere Ansicht (nichts sichtbar gerendert): BLOCKED', async () => {
    const r = await messe('--ziel', FIX('leer.html'), '--profil', 'handy-360', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/Ansicht leer/)
  })
  it('App ohne --erwarte ist ein Aufruffehler (Exit 2)', async () => {
    const r = spawnSync('node', [join(ORDNER, 'messen.mjs'), '--app', '/'], { encoding: 'utf8' })
    expect(r.status).toBe(2)
  })
  it('echte App, Monitor ohne Turnier (weiche Umleitung auf das Dashboard): erwartete Ansicht fehlt, BLOCKED', async () => {
    const r = await messe('--app', '/display/x/y', '--erwarte', '[data-testid="monitor-slide"]', '--profil', 'monitor-1080-rand0', '--varianten', 'normal', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/Erwartete Ansicht fehlt/)
  })
  it('echte App mit Build-Nachweis: Gate gruen, Stand = HEAD, Modus APP', async () => {
    const r = await messe('--app', '/', '--erwarte', '[data-testid="dashboard-import-trigger"]', '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(r.b.status).not.toBe('BLOCKED')
    expect(r.b.modus).toBe('APP')
    expect(r.b.quelle.build?.sha).toBe(HEAD)
  })
})

describe('VM-DISPLAY-CONTENTS (SM): Huellelement mit display:contents', () => {
  it('Inhalt in einem display:contents-Huellelement wird gemessen, nicht als "Ansicht leer" geblockt', async () => {
    const r = await messe('--ziel', FIX('display-contents.html'), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(gruende(r.b)).not.toMatch(/Ansicht leer/)
    expect(r.b.status).not.toBe('BLOCKED')
    expect(r.b.laeufe).toHaveLength(1)
  })
  it('Gegenbeispiel: display:contents macht nichts sichtbar, was verborgen ist (BLOCKED "Ansicht leer")', async () => {
    const r = await messe('--ziel', FIX('display-contents-versteckt.html'), '--profil', 'handy-360', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/Ansicht leer/)
  })
})

describe('Saat fuer die App-Messung (SM, @TA-011)', () => {
  const LISTE = '[data-testid="tournament-card-hallencup-messlauf"]'
  it('mit --saat zeigt die Startseite das Turnier "Hallencup Messlauf": nicht BLOCKED, Saat im Bericht', async () => {
    const r = await messe('--app', '/#/', '--erwarte', LISTE, '--saat', 'hallencup-messlauf', '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(r.b.status, r.out).not.toBe('BLOCKED')
    expect(r.b.matrix).toMatchObject({ saat: 'hallencup-messlauf' })
    expect(r.b.laeufe).toHaveLength(1)
  })
  it('ohne --saat bleibt das Verhalten: dieselbe Ansicht ist nicht erreichbar, BLOCKED "Erwartete Ansicht fehlt"', async () => {
    const r = await messe('--app', '/#/', '--erwarte', LISTE, '--klick', 'role=button[name=/notwendig|necessary/i]', '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(r.code).toBe(3)
    expect(gruende(r.b)).toMatch(/Erwartete Ansicht fehlt/)
  })
  it('Turnier-Cockpit mit laufendem Spiel (Engine-Kopie der Saat) und Monitor-Folie sind messbar', async () => {
    const cockpit = await messe('--app', '/#/tournament/hallencup-messlauf/live?matchId=00000003-0000-4000-8000-000000000016', '--erwarte', '[data-testid="scoreboard"]', '--saat', 'hallencup-messlauf', '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(cockpit.b.status, cockpit.out).not.toBe('BLOCKED')
    const monitor = await messe('--app', '/#/display/hallencup-messlauf/mon-live', '--erwarte', '[data-testid="monitor-slide"]', '--saat', 'hallencup-messlauf', '--profil', 'monitor-1080-rand0', '--varianten', 'normal', ...SCHNELL)
    expect(monitor.b.status, monitor.out).not.toBe('BLOCKED')
  })
  it('--saat gilt nur fuer App-Ziele (Mockup: Exit 2); unbekannte Saat: Exit 2', () => {
    const mock = spawnSync('node', [join(ORDNER, 'messen.mjs'), '--ziel', FIX('leer.html'), '--saat', 'hallencup-messlauf'], { encoding: 'utf8' })
    expect(mock.status).toBe(2)
    const falsch = spawnSync('node', [join(ORDNER, 'messen.mjs'), '--app', '/', '--erwarte', 'main', '--saat', 'gibt-es-nicht'], { encoding: 'utf8' })
    expect(falsch.status).toBe(2)
    expect(falsch.stderr).toMatch(/Saat "gibt-es-nicht" fehlt/)
  })
})

describe('@TA-012 Verdeckte Bedienelemente', () => {
  const verdeckt = (b: Bericht) => b.laeufe.flatMap((l) => l.befunde.filter((x) => x.metrik === 'verdeckt.bedienelement'))
  it('Beispiel 1 Spielplan vor dem Fix (360): Tor-Eingabe Gast von Spiel 16 vom "Teilen"-Balken verdeckt, HART; die Zeilen davor sind beim Scrollen frei', async () => {
    const r = await messe('--ziel', FIX('verdeckt-leiste.html'), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(r.code, r.out).toBe(1)
    const v = verdeckt(r.b)
    expect(v.map((x) => `${x.typ} ${x.selektor}`)).toEqual(['HART [data-testid="tor-gast-16"]'])
    expect(JSON.stringify(v)).toContain('teilen')
  })
  it('Beispiel 2 Cockpit, Variante ohne Weiterscrollen (360): Gelb- und Rot-Knopf vom Sound-Hinweis dauerhaft verdeckt, HART (mit Weiterscrollen: Warnung, siehe Fixrunde 1)', async () => {
    const r = await messe('--ziel', FIX('verdeckt-hinweis.html'), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(r.code, r.out).toBe(1)
    const v = verdeckt(r.b)
    expect(v.map((x) => x.selektor).sort()).toEqual(['[data-testid="karte-gelb"]', '[data-testid="karte-rot"]'])
    expect(v.every((x) => x.typ === 'HART' && JSON.stringify(x).includes('sound-hinweis'))).toBe(true)
  })
  it.each(['verdeckt-leiste-korrigiert.html', 'verdeckt-hinweis-korrigiert.html', 'verdeckt-dialog.html'])(
    'Beispiel 3 / Gegenbeispiel %s: keine Meldung (frei, Eltern-Label, Rollbereich, offener Dialog)', async (datei) => {
      const r = await messe('--ziel', FIX(datei), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
      gruen(r)
      expect(verdeckt(r.b)).toHaveLength(0)
      expect(r.b.zusammenfassung.zaehler['verdeckt.bedienelement'] ?? 0).toBe(0)
    })
  const schwebend = (b: Bericht) => b.laeufe.flatMap((l) => l.befunde.filter((x) => x.metrik === 'verdeckt.schwebend'))
  it('Fixrunde 1: schwebende Leiste ueber Zeilen, die beim Weiterscrollen frei werden: WARNUNG verdeckt.schwebend, kein HART', async () => {
    const r = await messe('--ziel', FIX('verdeckt-schwebend.html'), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    gruen(r)
    expect(verdeckt(r.b)).toHaveLength(0)
    const w = schwebend(r.b)
    expect(w.length).toBeGreaterThan(0)
    expect(w.every((x) => x.typ === 'WARNUNG' && JSON.stringify(x).includes('teilen'))).toBe(true)
  })
  it('Fixrunde 1 Beispiel 2: Gelb-/Rot-Knopf vom schwebenden Sound-Hinweis, erst durch Weiterscrollen frei: WARNUNG', async () => {
    const r = await messe('--ziel', FIX('verdeckt-hinweis-lang.html'), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    gruen(r)
    expect(verdeckt(r.b)).toHaveLength(0)
    expect(schwebend(r.b).map((x) => x.selektor).sort()).toEqual(['[data-testid="karte-gelb"]', '[data-testid="karte-rot"]'])
    expect(schwebend(r.b).every((x) => x.typ === 'WARNUNG' && JSON.stringify(x).includes('sound-hinweis'))).toBe(true)
  })
  it.each(['verdeckt-leiste-im-fluss.html', 'verdeckt-nav.html'])('Fixrunde 1 Gegenbeispiel %s: keine Meldung (Leiste im Fluss, feste Navigation)', async (datei) => {
    const r = await messe('--ziel', FIX(datei), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    gruen(r)
    expect(verdeckt(r.b)).toHaveLength(0)
    expect(schwebend(r.b)).toHaveLength(0)
  })
  it('Fixrunde 2 A2: feste Navigation ohne Abstand unten: HART nur fuer das unterste Element (tor-gast-16), keine Warnung fuer die uebrigen Zeilen', async () => {
    const r = await messe('--ziel', FIX('verdeckt-nav-unten.html'), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(r.code, r.out).toBe(1)
    expect(verdeckt(r.b).map((x) => `${x.typ} ${x.selektor}`)).toEqual(['HART [data-testid="tor-gast-16"]'])
    expect(schwebend(r.b)).toHaveLength(0)
  })
  it('Fixrunde 1 echter Stand: Spielplan meldet als Schwebendes nur Warnungen der Leiste Teilen/Als PDF (@OB-074: Leiste steht am Handy fest am Fensterrand); das Cockpit hat kein HART, jede Verdeckungs-Meldung ist bekannt oder eine Warnung (kein bestimmter Fehler erwartet)', async () => {
    const plan = await messe('--app', '/#/tournament/hallencup-messlauf/schedule', '--erwarte', '[data-testid="schedule-view-table"]', '--saat', 'hallencup-messlauf', '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(plan.b.status, plan.out).not.toBe('BLOCKED')
    // @OB-074: „Teilen“/„Als PDF“ stehen am Handy fest über der Liste. Beim Scrollen liegt die Leiste zeitweise über Zeilen-Bedienelementen,
    // die durch Weiterscrollen frei werden; das ist nach @TA-012 („schwebende Leiste über einem Element, das erst durch Weiterscrollen
    // frei wird = Warnung“) eine Warnung, nie HART. Erlaubt ist ausschließlich die Leiste als Verdecker (kein anderer Schwebender, kein HART:
    // ein Element, das in keiner Scroll-Stellung frei wird, z. B. die letzte Zeile, bliebe HART).
    expect(verdeckt(plan.b).filter((x) => x.typ === 'HART')).toHaveLength(0)
    for (const x of schwebend(plan.b)) {
      const verdecker = (x as { verdecktVon?: string }).verdecktVon ?? ''
      expect(x.typ === 'WARNUNG' && /schedule-action-buttons|schedule-action-pdf|"Teilen"|"Als PDF"/.test(verdecker), JSON.stringify(x)).toBe(true)
    }
    const c = await messe('--app', '/#/tournament/hallencup-messlauf/live?matchId=00000003-0000-4000-8000-000000000016', '--erwarte', '[data-testid="scoreboard"]', '--saat', 'hallencup-messlauf', '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(c.b.status, c.out).not.toBe('BLOCKED')
    // @TA-012 verlangt nicht, dass die App einen bestimmten Fehler hat: kein HART; jede Meldung traegt eine Befund-Kennung
    // der Ausnahmeliste oder ist eine Warnung verdeckt.schwebend. Der positive Fall (Warnung entsteht) liegt in den Fixtures
    // verdeckt-hinweis-lang.html und verdeckt-schwebend.html.
    const alle = c.b.laeufe.flatMap((l) => l.befunde.filter((x) => x.metrik.startsWith('verdeckt.')))
    expect(alle.filter((x) => x.typ === 'HART')).toHaveLength(0)
    for (const x of alle) {
      expect(x.metrik === 'verdeckt.schwebend' ? x.typ === 'WARNUNG' : /\[bekannt: C-[A-Z0-9-]+\]/.test(JSON.stringify(x)), JSON.stringify(x)).toBe(true)
    }
  })
  it('Ausnahmeliste: jeder Eintrag nennt Befund-Kennung, Begruendung und mindestens Element oder Verdecker', () => {
    const gw = JSON.parse(readFileSync(join(ORDNER, 'grenzwerte.json'), 'utf8')) as { grenzwerte: { id: string; typ: string; ausnahmeliste?: { befund: string; selektor?: string; verdecktVon?: string; begruendung: string }[] }[] }
    const regel = gw.grenzwerte.find((e) => e.id === 'verdeckt.bedienelement')
    expect(regel?.typ).toBe('HART')
    expect(regel?.ausnahmeliste?.length).toBeGreaterThan(0)
    for (const a of regel?.ausnahmeliste ?? []) {
      expect(a.befund).toMatch(/^C-[A-Z0-9-]+$/)
      expect((a.selektor ?? '').length + (a.verdecktVon ?? '').length).toBeGreaterThan(3)
      expect(a.begruendung.length).toBeGreaterThan(10)
    }
  })
  it('Ausnahmeliste greift: Fuss-Links unter der Tab-Leiste sind WARNUNG mit Befund-Kennung, nicht HART; das Cockpit hat keinen Sound-Hinweis mehr, der etwas verdeckt (C-COCKPIT-SOUNDHINWEIS-VERDECKT behoben, Aufgabe 2.4)', async () => {
    const start = await messe('--app', '/#/archiv', '--erwarte', '[data-testid="footer-impressum-link"]', '--saat', 'hallencup-messlauf', '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(start.b.status, start.out).not.toBe('BLOCKED')
    const a = verdeckt(start.b)
    expect(a.length).toBeGreaterThan(0)
    expect(a.every((x) => x.typ === 'WARNUNG' && JSON.stringify(x).includes('C-FUSS-LINKS-UNTER-LEISTE'))).toBe(true)
    const cockpit = await messe('--app', '/#/tournament/hallencup-messlauf/live?matchId=00000003-0000-4000-8000-000000000016', '--erwarte', '[data-testid="scoreboard"]', '--saat', 'hallencup-messlauf', '--profil', 'desktop-1440', '--varianten', 'normal', ...SCHNELL)
    expect(cockpit.b.status, cockpit.out).not.toBe('BLOCKED')
    const c = verdeckt(cockpit.b)
    // Der Hinweis ist ein Abzeichen der Tafel statt eines schwebenden Banners: nichts im Cockpit verdeckt ihn betreffend etwas
    expect(c.filter((x) => x.typ === 'HART')).toHaveLength(0)
    expect(c.some((x) => JSON.stringify(x).includes('C-COCKPIT-SOUNDHINWEIS-VERDECKT') || JSON.stringify(x).includes('Sound für Spielende'))).toBe(false)
  })
})

describe('Fehlalarme aus dem Review sind weg', () => {
  it('B-04 normaler Absatz bleibt in der Langtext-Variante gruen', async () => {
    const r = await messe('--ziel', FIX('langtext-absatz.html'), '--profil', 'handy-360', '--varianten', 'normal,langtext', ...SCHNELL)
    gruen(r)
  })
  it('B-05 offener Dialog: nur seine Schicht wird gemessen, keine Ueberlappung mit dem Seitentext', async () => {
    const r = await messe('--ziel', FIX('dialog-ueber-text.html'), '--profil', 'app', '--varianten', 'normal')
    gruen(r)
    expect(r.b.zusammenfassung.zaehler['ueberlappung.text'] ?? 0).toBe(0)
  })
  it('B-14 Mockup im Geraete-Rahmen: BLOCKED (verkleinert bzw. Rahmen); ohne Rahmen gruen', async () => {
    const klein = await messe('--ziel', FIX('mockup-rahmen.html'), '--profil', 'handy-360', ...SCHNELL)
    expect(klein.code).toBe(3)
    expect(gruende(klein.b)).toMatch(/verkleinert/)
    const tablet = await messe('--ziel', FIX('mockup-rahmen.html'), '--profil', 'tablet-hoch', ...SCHNELL)
    expect(gruende(tablet.b)).toMatch(/Geraete-Rahmen/)
    const ohne = await messe('--ziel', `${FIX('mockup-rahmen.html')}?rahmen=0`, '--profil', 'app', '--varianten', 'normal', '--ohne-axe')
    gruen(ohne)
  })
  it('B-15 Verlauf: schlechteste Farbe zaehlt (HART); dunkler Verlauf und Emoji sind gruen', async () => {
    expect(hart((await messe('--ziel', FIX('kontrast-verlauf.html'), '--profil', 'handy-360', ...SCHNELL)).b).has('kontrast.text')).toBe(true)
    gruen(await messe('--ziel', FIX('kontrast-verlauf-korrigiert.html'), '--profil', 'handy-360', ...SCHNELL))
    gruen(await messe('--ziel', FIX('kontrast-emoji.html'), '--profil', 'handy-360', ...SCHNELL))
  })
  it('B-08 SVG und absolut positionierter Text ueber dem Namen: HART; Symbol daneben gruen', async () => {
    expect(hart((await messe('--ziel', FIX('ueberlappung-svg.html'), '--profil', 'handy-360', ...SCHNELL)).b).has('ueberlappung.text')).toBe(true)
    expect(hart((await messe('--ziel', FIX('ueberlappung-absolut.html'), '--profil', 'handy-360', ...SCHNELL)).b).has('ueberlappung.text')).toBe(true)
    gruen(await messe('--ziel', FIX('ueberlappung-svg-korrigiert.html'), '--profil', 'handy-360', ...SCHNELL))
  })
})

describe('Gegen Schummeln', () => {
  it('Monitor-Profil allein (Rand 0) wird um den Standard-Rand ergaenzt', async () => {
    const r = await messe('--ziel', FIX('monitor-kopf.html'), '--profil', 'monitor-1080-rand0', '--varianten', 'normal', ...SCHNELL)
    expect(r.b.matrix.profile).toContain('monitor-1080-standard')
    expect(r.b.matrix.ergaenzt).toEqual(['monitor-1080-standard'])
    expect(r.code).toBe(1)
  })
  it('Teilmatrix ist nie VOLLMATRIX', async () => {
    const r = await messe('--ziel', FIX('titel-silbentrennung-korrigiert.html'), '--profil', 'handy-360', ...SCHNELL)
    gruen(r)
    expect(r.b.vollmatrix).toBe(false)
  })
  it('eigene Grenzwerte ohne Begruendung: BLOCKED; mit Begruendung im Bericht und nie VOLLMATRIX', async () => {
    const kopie = join(AUS, 'eigene-grenzwerte.json')
    const gw = JSON.parse(readFileSync(join(ORDNER, 'grenzwerte.json'), 'utf8')) as { grenzwerte: { id: string; wert: unknown }[] }
    const touch = gw.grenzwerte.find((e) => e.id === 'touch.min')
    if (touch) touch.wert = 20
    writeFileSync(kopie, JSON.stringify(gw))
    const ohne = await messe('--ziel', FIX('viele-befunde.html'), '--profil', 'app', '--grenzwerte', kopie)
    expect(ohne.code).toBe(3)
    expect(gruende(ohne.b)).toMatch(/ohne --begruendung/)
    const mit = await messe('--ziel', FIX('viele-befunde.html'), '--profil', 'app', '--grenzwerte', kopie, '--begruendung', 'Haertetest')
    expect(mit.b.abweichungen.length).toBe(1)
    expect(mit.b.vollmatrix).toBe(false)
  })
  it('Sehwinkel-Abstand ohne Begruendung: BLOCKED; mit Begruendung meldet 20 m die Monitor-Schrift (WARNUNG bis Token-Paket)', async () => {
    const args = ['--ziel', FIX('monitor-kopf-korrigiert.html'), '--profil', 'monitor-1080-standard', '--varianten', 'normal', ...SCHNELL, '--abstand-m', '20']
    expect((await messe(...args)).code).toBe(3)
    const mit = await messe(...args, '--begruendung', 'Generalprobe: Halle tiefer')
    expect(warn(mit.b).has('monitor.schrift.lesetext')).toBe(true)
  })
  it('Ausnahme-Attribute stehen im Bericht; fehlende Haupttasten-Markierung ist sichtbar', async () => {
    const a = await messe('--ziel', FIX('ausnahme.html'), '--profil', 'handy-360', ...SCHNELL)
    expect(a.b.ausnahmen).toHaveLength(1)
    expect(warn(a.b).has('ausnahme.attribut')).toBe(true)
    expect(warn((await messe('--ziel', FIX('haupttaste-ohne-markierung.html'), '--profil', 'handy-360', ...SCHNELL)).b).has('markierung.primaer')).toBe(true)
    const m = await messe('--ziel', FIX('haupttaste-unter-falz.html'), '--profil', 'handy-360', ...SCHNELL)
    expect([...hart(m.b)]).toEqual(expect.arrayContaining(['primaer.sichtbar', 'touch.primaer']))
  })
  it('@OB-061 Taste mit zwei Zeilen im Dialog-Fuss: WARNUNG (kein HART); Gegenbeispiel einzeilig ohne Warnung', async () => {
    const zwei = await messe('--ziel', FIX('dialogfuss-zweizeilig.html'), '--profil', 'handy-360', ...SCHNELL)
    expect(warn(zwei.b).has('dialogfuss.taste-zeilen')).toBe(true)
    expect(hart(zwei.b).size).toBe(0)
    const ein = await messe('--ziel', FIX('dialogfuss-einzeilig.html'), '--profil', 'handy-360', ...SCHNELL)
    expect(warn(ein.b).has('dialogfuss.taste-zeilen')).toBe(false)
  })
  it('@SL-178 Cockpit-Ziffern: zu kleine Ziffern (40 px Schrift) sind WARNUNG cockpit.ziffern in Handy und Laptop; Gegenbeispiel 120 px ohne', async () => {
    for (const profil of ['handy-390', 'laptop-1280x620']) {
      const klein = await messe('--ziel', FIX('cockpit-ziffern-zu-klein.html'), '--profil', profil, ...SCHNELL)
      expect(warn(klein.b).has('cockpit.ziffern'), profil).toBe(true)
      expect(hart(klein.b).has('cockpit.ziffern'), profil).toBe(false)
      const ok = await messe('--ziel', FIX('cockpit-ziffern-ok.html'), '--profil', profil, ...SCHNELL)
      expect(warn(ok.b).has('cockpit.ziffern'), profil).toBe(false)
    }
  })
  it('B-16 kein stilles Abschneiden: 40 zu kleine Tasten = 40 gebuendelte Befunde', async () => {
    const r = await messe('--ziel', FIX('viele-befunde.html'), '--profil', 'handy-360', '--varianten', 'normal', ...SCHNELL)
    expect(r.b.zusammenfassung.zaehler['touch.min']).toBe(40)
    expect(r.b.gebuendelt.filter((g) => g.metrik === 'touch.min')).toHaveLength(40)
  })
  it('B-13 Ausgabe gebuendelt: ein Befund je Element mit Profil-Liste', async () => {
    const r = await messe('--ziel', FIX('titel-silbentrennung.html'), '--profil', 'handy', '--varianten', 'normal', '--ohne-axe')
    const g = r.b.gebuendelt.find((x) => x.metrik === 'text.hyphens')
    expect(g?.profile).toEqual(['handy-360', 'handy-390'])
    expect(g?.anzahl).toBe(8)
  })
})

describe('Sehwinkel-Formel (Entscheidung Daniel 2026-10-16: 55 Zoll aus 10 m)', () => {
  const basisSw = { abstandM: 10, diagonaleZoll: 55, versalAnteil: 0.72 }
  it.each([
    [20, 0.118, 128],
    [16, 0.0944, 102],
    [12, 0.0708, 77],
  ])('%i Bogenminuten ergeben %f der Bildhoehe (%i px bei 1080)', async (winkel, anteil, px) => {
    const a = sehwinkelAnteil(basisSw, winkel) as number
    expect(a).toBeCloseTo(anteil, 3)
    expect(Math.ceil(a * 1080)).toBe(px)
  })
})
