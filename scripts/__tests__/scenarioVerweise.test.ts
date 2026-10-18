// TM-1 (Plattform-Record "Testabdeckung"): Verweis-Pflicht fuer "erwartet rot"-Tests.
// Kennungen: @TA-013 (Verweis fehlt -> gemeldet), @TA-014 (Ratsche), @TA-015 (unbekannter Verweis),
// @TA-017 (Untergrenze), @TA-018 (Selbst-Aufloesung). Werte stehen im Gherkin des Records.
// Verweis-Beispiele stehen hier nur in String-Literalen und der ZEILEN-Konstante, nie in Testtiteln:
// dieses Skript scannt auch die eigenen Testdateien.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { befundKennungen, git, mvpListe, sauberEnv, schreibe as schreibeIn, szenarioLauf } from './skriptHilfen'

let ordner: string
const schreibe = (name: string, inhalt: string) => schreibeIn(ordner, name, inhalt)
const lauf = (...args: string[]) => szenarioLauf(ordner, ...args)
const BEKANNT = ['C-COCKPIT-AUSGEFALLEN-BEREIT', 'C-COCKPIT-TABLET-OHNE-PROTOKOLL', 'C-KONTRAST-TEXTPAARE', 'DF-001', 'DF-002']
const ZEITLIMIT = 20_000

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'scenario-verweise-'))
  mvpListe(ordner, ['ZM-096', 'HE-001'])
  befundKennungen(ordner, BEKANNT)
})
afterEach(() => rmSync(ordner, { recursive: true, force: true }))

/** Die acht Beispielzeilen des Grundrisses @TA-013; zeile = Zeile der Markierung (null = nicht gemeldet). */
const ZEILEN: { name: string; quelle: string[]; zeile: number | null }[] = [
  { name: 'Testname ohne Verweis', quelle: ["it.fails('@SL-034 Grenze 3: das 3. Foul meldet einen Hinweis', () => {})"], zeile: 1 },
  { name: 'Testname mit Defekt-Verweis', quelle: ["it.fails('@SL-034 @DF-001 Grenze 3: das 3. Foul meldet einen Hinweis', () => {})"], zeile: null },
  { name: 'Testname mit Befund-Verweis', quelle: ["it.fails('@SL-117 C-COCKPIT-AUSGEFALLEN-BEREIT Spiel 15 steht bereit', () => {})"], zeile: null },
  {
    name: 'bedingtes test.fail mit Begruendung',
    quelle: ["test('@FU-080 Protokoll im Cockpit', async ({}, testInfo) => {", "  test.fail(testInfo.project.name === 'tablet-portrait', 'Befund C-COCKPIT-TABLET-OHNE-PROTOKOLL')", '})'],
    zeile: null,
  },
  {
    name: 'umgebender Block nennt den Befund',
    quelle: ["describe('Offen C-KONTRAST-TEXTPAARE: Text-Paare unter 4,5 : 1', () => {", "  it.fails('hell: Schrift auf Flaeche', () => {})", '})'],
    zeile: null,
  },
  { name: 'test.fail ohne Begruendung', quelle: ["test('@ZM-021 Ergebnis erscheint ohne Neuladen', () => {", '  test.fail()', '})'], zeile: 2 },
  { name: 'nur ein Kommentar darueber', quelle: ['// Befund C-COCKPIT-AUSGEFALLEN-BEREIT', "it.fails('@SL-117 Spiel 15 steht bereit', () => {})"], zeile: 2 },
  { name: 'Defekt-Nummer zu kurz', quelle: ["it.fails('@SL-034 @DF-01 Grenze 3 (Nummer zu kurz)', () => {})"], zeile: 1 },
]
const gemeldet = (stdout: string) => [...stdout.matchAll(/erwartet rot ohne Verweis: (\S+):(\d+)/g)].map((m) => `${m[1]}:${m[2]}`)

describe('@TA-013 erwartet rote Tests ohne Verweis werden gemeldet', () => {
  it.each(ZEILEN.map((z) => [z.name]))('@TA-013 Beispielzeile: %s', (name) => {
    const z = ZEILEN.find((e) => e.name === name)!
    schreibe('src/a.test.ts', z.quelle.join('\n') + '\n')
    const r = lauf()
    expect(r.status, r.stderr).toBe(0)
    expect(gemeldet(r.stdout)).toEqual(z.zeile === null ? [] : [`src/a.test.ts:${z.zeile}`])
  })

  it('@TA-013 Gegenbeispiel: derselbe Verweis nur im Kommentar wird gemeldet, im Titel nicht', () => {
    schreibe('src/k.test.ts', "// @DF-001\nit.fails('Fall', () => {})\n")
    expect(gemeldet(lauf().stdout)).toEqual(['src/k.test.ts:2'])
    schreibe('src/k.test.ts', "it.fails('@DF-001 Fall', () => {})\n")
    expect(gemeldet(lauf().stdout)).toEqual([])
  })

  it('@TA-013 Gegenbeispiel: vier Ziffern oder zwei Ziffern sind kein Defekt-Verweis, drei sind einer', () => {
    for (const falsch of ['@DF-0012', '@DF-01', 'DF-1']) {
      schreibe('src/z.test.ts', `it.fails('${falsch} Fall', () => {})\n`)
      expect(gemeldet(lauf().stdout), falsch).toEqual(['src/z.test.ts:1'])
    }
    schreibe('src/z.test.ts', "it.fails('@DF-001 Fall', () => {})\n")
    expect(gemeldet(lauf().stdout)).toEqual([])
  })

  it('@TA-013 Gegenbeispiel: bedingtes test.fail zaehlt als Markierung; mit Begruendung nicht gemeldet, ohne gemeldet', () => {
    schreibe('src/b.test.ts', "test('Fall', async () => {\n  test.fail(cond, 'Befund C-KONTRAST-TEXTPAARE')\n})\n")
    expect(gemeldet(lauf().stdout)).toEqual([])
    expect(lauf().stdout).toMatch(/Erwartet rot \(it\.fails, test\.fail\): 1,/)
    schreibe('src/b.test.ts', "test('Fall', async () => {\n  test.fail(cond)\n})\n")
    expect(gemeldet(lauf().stdout)).toEqual(['src/b.test.ts:2'])
  })

  it('@TA-013 Gegenbeispiel: C-Jugend, ABC-DEF und B-51b sind keine Verweise; testInfo.fail und it.fails.each zaehlen', () => {
    schreibe('src/v.test.ts', "it.fails('C-Jugend ABC-DEF B-51b Fall', () => {})\n")
    expect(gemeldet(lauf().stdout)).toEqual(['src/v.test.ts:1'])
    schreibe('src/w.test.ts', "test('Fall', async ({}, testInfo) => {\n  testInfo.fail()\n})\nit.fails.each([1, 2])('Tabelle %i', () => {})\n")
    const r = lauf()
    expect(r.stdout).toMatch(/Erwartet rot \(it\.fails, test\.fail\): 3, davon ohne Verweis auf Befund oder Defekt: 3/)
  })

  it('@TA-013 Template-Literal: nur der statische Text der Begruendung zaehlt', () => {
    schreibe('src/t.test.ts', 'test("Fall", () => {\n  test.fail(bedingung, `Besitzer: ${schritt.owner} C-KONTRAST-TEXTPAARE`)\n})\ntest("Zwei", () => {\n  test.fail(bedingung, `Besitzer: ${schritt.owner}`)\n})\n')
    expect(gemeldet(lauf().stdout)).toEqual(['src/t.test.ts:5'])
  })
})

describe('@TA-014 die Zahl der erwartet roten Tests ohne Verweis darf nicht steigen', () => {
  const fall = (n: number) => `it.fails('Fall ${String(n).padStart(2, '0')}', () => {})`
  const alle = Array.from({ length: 21 }, (_, i) => i + 1)
  /** Hauptzweig: 21 erwartet rote Tests ohne Verweis in src/alt.test.ts. */
  const hauptMit21 = () => {
    schreibe('src/alt.test.ts', alle.map(fall).join('\n') + '\n')
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 0, kennungen: [] }))
    git(ordner, 'init', '-q', '-b', 'main')
    git(ordner, 'add', '-A')
    git(ordner, 'commit', '-q', '-m', 'main')
  }

  it('@TA-014 ein weiterer Test ohne Verweis: rot, der neue Test wird mit Datei und Namen genannt', () => {
    hauptMit21()
    expect(lauf('--base', 'HEAD').status).toBe(0)
    schreibe('src/alt.test.ts', alle.map(fall).join('\n') + "\nit.fails('Neuer Fall', () => {})\n")
    const r = lauf('--base', 'HEAD')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/22 > Hauptzweig 21/)
    expect(r.stderr).toMatch(/src\/alt\.test\.ts:22 "Neuer Fall"/)
  }, ZEITLIMIT)

  it('@TA-014 Gegenbeispiel: derselbe zusaetzliche Test mit Defekt-Verweis im Namen ist gruen', () => {
    hauptMit21()
    schreibe('src/alt.test.ts', alle.map(fall).join('\n') + "\nit.fails('@DF-002 Neuer Fall', () => {})\n")
    const r = lauf('--base', 'HEAD')
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/davon ohne Verweis auf Befund oder Defekt: 21 \(Hauptzweig 21\)/)
  }, ZEITLIMIT)

  it('@TA-014 erhaelt einer der 21 einen Verweis, ist die Pruefung gruen und meldet 20', () => {
    hauptMit21()
    schreibe('src/alt.test.ts', alle.map((n) => (n === 5 ? "it.fails('@DF-001 Fall 05', () => {})" : fall(n))).join('\n') + '\n')
    const r = lauf('--base', 'HEAD')
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/davon ohne Verweis auf Befund oder Defekt: 20 \(Hauptzweig 21\)/)
    expect(r.stdout).toMatch(/HINWEIS: Erwartet rot ohne Verweis gesunken: 20 < 21/)
  }, ZEITLIMIT)

  it('@TA-014 Gegenbeispiel: ein Test ohne Verweis in eine andere Datei verschoben: gruen, weil die Zahl gleich bleibt', () => {
    hauptMit21()
    schreibe('src/alt.test.ts', alle.slice(0, 20).map(fall).join('\n') + '\n')
    schreibe('src/neu.test.ts', fall(21) + '\n')
    const r = lauf('--base', 'HEAD')
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/davon ohne Verweis auf Befund oder Defekt: 21 \(Hauptzweig 21\)/)
  }, ZEITLIMIT)

  it('@TA-014 die Job-Summary nennt die Zahl ohne Verweis und die des Hauptzweigs', () => {
    hauptMit21()
    const summary = join(ordner, 'summary.md')
    lauf('--base', 'HEAD', '--summary', summary)
    expect(readFileSync(summary, 'utf8')).toMatch(/Erwartet rot ohne Verweis: 21 \(Hauptzweig 21\) von 21 Markierungen/)
  }, ZEITLIMIT)
})

describe('@TA-015 ein Verweis auf eine unbekannte Kennung laesst die Pruefung scheitern', () => {
  const rot = (quelle: string, erwartet: RegExp) => {
    schreibe('src/u.test.ts', quelle)
    const r = lauf()
    expect(r.status, quelle).toBe(1)
    expect(r.stderr, quelle).toMatch(erwartet)
  }

  it('@TA-015 ein unbekannter Defekt-Verweis nennt Kennung, Datei und Zeile', () => {
    rot("it('Eins', () => {})\nit('@DF-007 Fall', () => {})\n", /Unbekannter Verweis DF-007 in src\/u\.test\.ts:2/)
  })

  it('@TA-015 der vertippte Befund-Verweis scheitert ebenfalls, auch in einem regulaeren Test', () => {
    rot("it('C-COCKPIT-TABLETT-OHNE-PROTOKOLL Fall', () => {})\n", /Unbekannter Verweis C-COCKPIT-TABLETT-OHNE-PROTOKOLL in src\/u\.test\.ts:1/)
  })

  it('@TA-015 auch ein markierter Test mit unbekanntem Verweis in der Begruendung scheitert', () => {
    rot("test('Fall', () => {\n  test.fail(c, 'Befund C-GIBT-ES-NICHT')\n})\n", /Unbekannter Verweis C-GIBT-ES-NICHT in src\/u\.test\.ts:2/)
  })

  it('@TA-015 Gegenbeispiel: ein bekannter Verweis ist gruen; fehlt die Liste, scheitert schon der erste Verweis', () => {
    schreibe('src/u.test.ts', "it('@DF-001 Fall', () => {})\n")
    expect(lauf().status).toBe(0)
    rmSync(join(ordner, 'tests/meta/befund-kennungen.json'))
    const r = lauf()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Verweis DF-001 in src\/u\.test\.ts:1.*befund-kennungen\.json fehlt/)
    schreibe('src/u.test.ts', "it('Fall ohne jeden Verweis', () => {})\n")
    expect(lauf().status).toBe(0)
  })
})

describe('@TA-017 die Untergrenze steht auf dem gemessenen Stand', () => {
  const ids = Array.from({ length: 321 }, (_, i) => `ZM-${String(i + 1).padStart(3, '0')}`)
  const mitTests = (n: number) => schreibe('src/alle.test.ts', ids.slice(0, n).map((id) => `it('${id} Fall', () => {})`).join('\n') + '\n')
  const untergrenze = (n: number) => schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: n, kennungen: [] }))
  beforeEach(() => mvpListe(ordner, ids))

  it('@TA-017 --floor-schreiben schreibt den gemessenen Stand 321', () => {
    mitTests(321)
    untergrenze(210)
    expect(lauf('--floor-schreiben').status).toBe(0)
    expect(JSON.parse(readFileSync(join(ordner, 'tests/meta/szenario-floor.json'), 'utf8')).mitTest).toBe(321)
  })

  it('@TA-017 nur 320 Kennungen mit Test bei Untergrenze 321: rot', () => {
    mitTests(320)
    untergrenze(321)
    const r = lauf()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/320 Kennungen mit regulaerem Test < Untergrenze 321/)
  })

  it('@TA-017 eine Untergrenze von 322 bei gemessenen 321 laesst die Pruefung scheitern; Gegenbeispiel: 321 ist gruen', () => {
    mitTests(321)
    untergrenze(322)
    const rot = lauf()
    expect(rot.status).toBe(1)
    expect(rot.stderr).toMatch(/321 Kennungen mit regulaerem Test < Untergrenze 322/)
    untergrenze(321)
    expect(lauf().status).toBe(0)
  })
})

describe('@TA-018 wird ein Defekt behoben, faellt die Markierung weg und der Verweis bleibt', () => {
  const VITEST = resolve(__dirname, '..', '..', 'node_modules', 'vitest', 'vitest.mjs')
  const NAME = '@SL-034 @DF-001 Grenze 3: das 3. Foul meldet einen Hinweis'

  it('@TA-018 stehen gelassene Markierung: Lauf rot "Expect test to fail"; ohne Markierung gruen; Szenario-Pruefung zaehlt dann regulaer', () => {
    const lauf1 = join(ordner, 'lauf')
    mkdirSync(lauf1, { recursive: true })
    writeFileSync(join(lauf1, 'vitest.config.mjs'), "export default { test: { include: ['*.test.ts'] } }\n")
    writeFileSync(join(lauf1, 'markiert.test.ts'), `import { it } from 'vitest'\nit.fails('${NAME}', () => {})\n`)
    writeFileSync(join(lauf1, 'behoben.test.ts'), `import { it } from 'vitest'\nit('${NAME}', () => {})\n`)
    const start = Date.now()
    const env = Object.fromEntries(Object.entries(sauberEnv(ordner)).filter(([k]) => !k.startsWith('VITEST')))
    const r = spawnSync('node', [VITEST, 'run', '--root', lauf1, '--config', join(lauf1, 'vitest.config.mjs'), '--reporter=json', `--outputFile=${join(lauf1, 'ergebnis.json')}`], { encoding: 'utf8', env })
    const dauer = Date.now() - start
    console.info(`@TA-018 Vitest-Spawn: ${dauer} ms`)
    expect(r.status).not.toBe(0)
    const json = JSON.parse(readFileSync(join(lauf1, 'ergebnis.json'), 'utf8'))
    const datei = (n: string) => json.testResults.find((t: { name: string }) => t.name.endsWith(n))
    expect(datei('markiert.test.ts').status).toBe('failed')
    expect(datei('markiert.test.ts').assertionResults[0].failureMessages.join('\n')).toMatch(/Expect test to fail/)
    expect(datei('behoben.test.ts').status).toBe('passed')

    // Szenario-Pruefung: markiert zaehlt nicht, die behobene Fassung zaehlt regulaer; der Verweis bleibt im Namen
    mvpListe(ordner, ['SL-034'])
    schreibe('lauf/vorher/a.test.ts', `it.fails('${NAME}', () => {})\n`)
    const vorher = szenarioLauf(ordner, '--scan', 'lauf/vorher')
    expect(vorher.stdout).toMatch(/mit Test: 0,/)
    schreibe('lauf/nachher/a.test.ts', `it('${NAME}', () => {})\n`)
    const nachher = szenarioLauf(ordner, '--scan', 'lauf/nachher')
    expect(nachher.status, nachher.stderr).toBe(0)
    expect(nachher.stdout).toMatch(/mit Test: 1,/)
    expect(nachher.stdout).toMatch(/davon ohne Verweis auf Befund oder Defekt: 0/)
  }, 60_000)
})
