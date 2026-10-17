// A-09: scenario-tests.mjs (Plattform-Record "Testabdeckung", @TA-006, @TA-007, @TA-008)
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SKRIPT = resolve(__dirname, '..', 'scenario-tests.mjs')

let ordner: string
const schreibe = (name: string, inhalt: string) => {
  const pfad = join(ordner, name)
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, inhalt)
}
const liste = (ids: string[], soll: number) =>
  schreibe('tests/meta/mvp-kennungen.json', JSON.stringify({ soll, records: { zuschauer: ids.slice(0, 1), helfer: ids.slice(1) } }))
const nachweis = (kennungen: string[]) =>
  schreibe('tests/meta/nachweis-generalprobe.json', JSON.stringify({ max: 15, kennungen }))
// Ohne GIT_*-Variablen: im pre-commit-Hook zeigen sie auf das echte Repo, die Test-Repos im Temp-Ordner wuerden dort committen.
// GIT_CEILING_DIRECTORIES auf das Temp-Elternverzeichnis: schlaegt `git init` fehl, sucht Git nicht in ein umgebendes Repo hinein.
const sauberEnv = (basis: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(Object.entries(basis).filter(([k]) => !k.startsWith('GIT_'))),
  GIT_CEILING_DIRECTORIES: dirname(ordner),
})
const lauf = (...args: string[]) => spawnSync('node', [SKRIPT, '--root', ordner, ...args], { encoding: 'utf8', env: sauberEnv() })

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'scenario-tests-'))
  nachweis([])
})
afterEach(() => rmSync(ordner, { recursive: true, force: true }))

describe('scenario-tests.mjs', () => {
  it('@TA-006 eine Liste mit einer Kennung weniger als soll scheitert mit der Abweichung', () => {
    liste(['ZM-096', 'HE-001'], 3)
    const r = lauf()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Liste hat 2 MVP-Kennungen, soll ist 3/)
  })

  it('@TA-006 eine Liste mit genau soll Eintraegen ist nicht rot (fehlende Tests sind im MVP nur Bericht)', () => {
    liste(['ZM-096', 'HE-001'], 2)
    const r = lauf()
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/ohne Test: 2/)
  })

  it('@TA-007 eine MVP-Kennung ohne Test wird gemeldet, mit Testnamen nicht mehr', () => {
    liste(['ZM-096', 'HE-001'], 2)
    const davor = lauf('--strict')
    expect(davor.status).toBe(1)
    expect(davor.stdout).toMatch(/zuschauer\s+1 von 1\s+ZM-096/)
    schreibe('src/a.test.ts', "it('ZM-096 zeigt den Stand', () => {})\n")
    const danach = lauf('--strict')
    expect(danach.stdout).not.toMatch(/ZM-096/)
    expect(danach.stdout).toMatch(/helfer\s+1 von 1\s+HE-001/)
  })

  it('@TA-007 eine Kennung nur im Kommentar oder in einem fremden String zaehlt nicht', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe(
      'src/b.test.ts',
      [
        '// ZM-096 steht nur im Kommentar',
        '/* HE-001 auch im Blockkommentar */',
        "const nebenbei = 'ZM-096 im normalen String'",
        "it('zaehlt ohne Kennung', () => { /* ZM-096 */ })",
      ].join('\n'),
    )
    const r = lauf()
    expect(r.stdout).toMatch(/mit Test: 0/)
    expect(r.stdout).toMatch(/ohne Test: 2/)
  })

  it('@TA-007 Kennungen in each-Tabellen, describe und test.step zaehlen; Teilnummern nicht', () => {
    liste(['ZM-096', 'HE-001', 'FU-081'], 3)
    schreibe(
      'src/c.test.ts',
      [
        "it.each([{ id: 'ZM-096' }])('Fall $id', () => {})",
        "describe('HE-001 Beitritt', () => {})",
        "await test.step('FU-08 ist nicht FU-081', async () => {})",
      ].join('\n'),
    )
    schreibe('tests/e2e/d.spec.ts', "test('x', async () => { await test.step('Schritt FU-081', async () => {}) })\n")
    const r = lauf()
    expect(r.stdout).toMatch(/mit Test: 3/)
  })

  it('@TA-008 mehr als 15 Nachweise aus der Generalprobe sind rot, genau 15 nicht', () => {
    const ids = Array.from({ length: 16 }, (_, i) => `ZM-${String(i + 1).padStart(3, '0')}`)
    liste(ids, 16)
    nachweis(ids)
    const r = lauf()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/16 > Grenze 15/)
    nachweis(ids.slice(0, 15))
    const ok = lauf()
    expect(ok.status).toBe(0)
    expect(ok.stdout).toMatch(/mit Nachweis Generalprobe: 15/)
  })

  it('@TA-008 ein Nachweis fuer eine Kennung ausserhalb der Liste ist rot', () => {
    liste(['ZM-096', 'HE-001'], 2)
    nachweis(['ZM-999'])
    expect(lauf().status).toBe(1)
  })

  it('@TA-007 ein auskommentierter Test mit Kennung zaehlt nicht', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/e.test.ts', "// it('ZM-096 war mal ein Test', () => {})\n/* test('HE-001 auch', () => {}) */\n")
    expect(lauf().stdout).toMatch(/mit Test: 0/)
  })

  it('@TA-007 `.test(...)` einer Regex und it(...) im String sind keine Tests', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe(
      'src/f.test.ts',
      ["expect(/x/.test('ZM-096 hier'))", 'const s = "it(\'HE-001 im String\')"', "it('echt ohne Kennung', () => {})"].join('\n'),
    )
    expect(lauf().stdout).toMatch(/mit Test: 0/)
    schreibe('src/g.test.ts', "test.describe('ZM-096 echt', () => {})\n")
    expect(lauf().stdout).toMatch(/mit Test: 1/)
  })

  it('@TA-007 --task findet den Bauplan ueber --plan und meldet nur dessen Kennungen', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('plan.md', '**A-99 Beispiel**\n- **Szenarien:** @ZM-096.\n\n**A-98 Anderes**\n- **Szenarien:** @HE-001.\n')
    const r = lauf('--task', 'A-99', '--plan', join(ordner, 'plan.md'))
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/MVP-Kennungen: 1 \(Aufgabe A-99\)/)
  })
})

describe('scenario-tests.mjs: reguläre Tests (TA-CI)', () => {
  it('@TA-007 ein regulärer Test zählt als mit Test', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/a.test.ts', "it('ZM-096 zeigt den Stand', () => {})\nit.only('HE-001 x', () => {})\n")
    expect(lauf().stdout).toMatch(/mit Test: 2, teilweise: 0/)
  })

  it('@TA-010 it.fails, test.fail, it.todo, skip, xit und describe.skip/xdescribe zählen nicht, ein regulärer Test daneben schon', () => {
    liste(['ZM-096', 'HE-001', 'FU-081', 'AN-010', 'BM-001', 'ME-063', 'ZM-097', 'ZM-098'], 8)
    schreibe(
      'src/b.test.ts',
      [
        "it.fails('ZM-096 erwartet rot', () => {})",
        "test.fail('HE-001 erwartet rot', () => {})",
        "it.todo('FU-081 offen')",
        "it.skip('AN-010 uebersprungen', () => {})",
        "describe.skip('Gruppe', () => { it('BM-001 im uebersprungenen describe', () => {}) })",
        "xdescribe('Gruppe x', () => { it('ZM-097 im xdescribe', () => {}) })",
        "xit('ZM-098 uebersprungen', () => {})",
        "it('ME-063 regulaer', () => {})",
      ].join('\n'),
    )
    const r = lauf()
    expect(r.stdout).toMatch(/mit Test: 1, teilweise: 0, mit Nachweis Generalprobe: 0, ohne Test: 7/)
    schreibe('src/c.test.ts', "it('ZM-096 jetzt auch regulaer', () => {})\n")
    expect(lauf().stdout).toMatch(/mit Test: 2,/)
  })

  it('@TA-010 Markierung im Rumpf: unbedingt (test.fail(true), fixme(), skip()) zählt nicht, bedingt bleibt regulär', () => {
    liste(['FU-089', 'FU-090', 'FU-091', 'FU-092', 'FU-093'], 5)
    schreibe(
      'tests/e2e/x.spec.ts',
      [
        "test('@FU-089 erwartet rot', async ({ browser }) => {",
        "  test.fail(true, 'Befund C-XYZ')",
        '})',
        "test('@FU-090 offen', async () => {",
        '  test.fixme()',
        '})',
        "test('@FU-091 uebersprungen', async (ctx) => {",
        '  ctx.skip()',
        '})',
        "test('@FU-092 nur auf dem Desktop', async ({ isMobile }) => {",
        "  test.skip(isMobile, 'nur Desktop')",
        '})',
        "test.skip('@FU-093 Schritt im uebersprungenen Test', async () => {",
        "  await test.step('Schritt FU-093', async () => {})",
        '})',
      ].join('\n'),
    )
    expect(lauf().stdout).toMatch(/mit Test: 1, teilweise: 0, mit Nachweis Generalprobe: 0, ohne Test: 4/)
  })

  it('@TA-010 test.describe.skip/fixme überspringt Tests und Schritte darin', () => {
    liste(['FU-089', 'FU-090', 'FU-091'], 3)
    schreibe(
      'tests/e2e/y.spec.ts',
      [
        "test.describe.skip('Gruppe', () => { test('@FU-089 drin', async () => {}) })",
        "test.describe.fixme('Gruppe', () => { test('@FU-090 drin', async () => { await test.step('FU-090', async () => {}) }) })",
        "test.describe('Gruppe', () => { test('@FU-091 drin', async () => {}) })",
      ].join('\n'),
    )
    expect(lauf().stdout).toMatch(/mit Test: 1,/)
  })

  it('@TA-010 Gegenbeispiel Bereichsgrenze: Regex-Literal/Apostroph im Rumpf lässt die Markierung des Nachbarn nicht rückwärts wirken', () => {
    liste(['FU-002', 'FU-056', 'FU-089'], 3)
    schreibe(
      'tests/e2e/z.spec.ts',
      [
        "test('@FU-002 regulaer mit Regex', async () => {",
        "  expect(text).toMatch(/a\\/b{2}/); const s = \"don't {\"",
        '})',
        "test('@FU-056 regulaer', async () => {",
        '  const s = `x ${1}`',
        '})',
        "test('@FU-089 erwartet rot', async () => {",
        '  test.fail(true, "Befund")',
        '})',
      ].join('\n'),
    )
    expect(lauf().stdout).toMatch(/mit Test: 2,/)
  })

  it('@TA-010 :teil zählt als teilweise, nicht als mit Test; ein voller Test daneben macht daraus mit Test; :teilweise ist keine Markierung', () => {
    liste(['ZM-096', 'HE-001', 'FU-081'], 3)
    schreibe('src/d.test.ts', "it('ZM-096:teil nur der Hauptpfad', () => {})\nit('HE-001 voll', () => {})\nit('FU-081:teilweise ist ein voller Test', () => {})\n")
    expect(lauf().stdout).toMatch(/mit Test: 2, teilweise: 1, mit Nachweis Generalprobe: 0, ohne Test: 0/)
    expect(lauf('--strict').status).toBe(1)
    schreibe('src/e.test.ts', "it('ZM-096 der Rest', () => {})\n")
    expect(lauf('--strict').status).toBe(0)
  })
})

describe('scenario-tests.mjs: Ratchet gegen den gemessenen Stand (TA-CI)', () => {
  // Jeder Git-Aufruf: cwd im Temp-Ordner, ohne geerbte GIT_*; ein Fehler bricht den Test ab (kein stilles Weiterlaufen).
  const git = (...args: string[]) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd: ordner, encoding: 'utf8', env: sauberEnv() })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} fehlgeschlagen: ${r.stderr}`)
    return r
  }
  const ids = Array.from({ length: 200 }, (_, i) => `ZM-${String(i + 1).padStart(3, '0')}`)
  const testsFuer = (liste_: string[]) => liste_.map((id) => `it('${id} Fall', () => {})`).join('\n') + '\n'
  /** Hauptzweig: 199 Kennungen (alle außer der 200.) mit regulärem Test, inkl. ZM-096; danach auf den Arbeitsstand wechseln. */
  const hauptMit199 = () => {
    liste(ids, 200)
    schreibe('src/alle.test.ts', testsFuer(ids.slice(0, 199)))
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 199, kennungen: [] }))
    git('init', '-q', '-b', 'main')
    git('add', '-A')
    git('commit', '-q', '-m', 'main')
  }
  const ohneZm096 = ids.slice(0, 199).filter((i) => i !== 'ZM-096')

  it('@TA-010 @ZM-096 nur noch in it.fails/it.todo/it.skip: rot, ZM-096 wird als neu verloren genannt (main 199)', () => {
    hauptMit199()
    for (const markierung of ['it.fails', 'it.todo', 'it.skip']) {
      schreibe('src/alle.test.ts', testsFuer(ohneZm096) + `${markierung}('ZM-096 jetzt markiert', () => {})\n`)
      const r = lauf('--base', 'HEAD')
      expect(r.status, markierung).toBe(1)
      expect(r.stderr).toMatch(/198 Kennungen mit regulaerem Test < Hauptzweig 199/)
      expect(r.stdout).toMatch(/neu verloren\): ZM-096/)
    }
  })

  it('@TA-010 mit „@ZM-096:teil“ zählt die Kennung als teilweise, nicht als getestet (weiter rot)', () => {
    hauptMit199()
    schreibe('src/alle.test.ts', testsFuer(ohneZm096) + "it('@ZM-096:teil nur der Hauptpfad', () => {})\n")
    const summary = join(ordner, 'summary.md')
    const r = lauf('--base', 'HEAD', '--summary', summary)
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(/mit Test: 198, teilweise: 1,/)
    expect(r.stdout).toMatch(/neu verloren\): ZM-096/)
    expect(readFileSync(summary, 'utf8')).toMatch(/Neu ohne regulaeren Test: `ZM-096`/)
  })

  it('@TA-010 steigt die Zahl auf 200, ist die Prüfung grün; gleich bleibende Zahl ebenfalls', () => {
    hauptMit199()
    expect(lauf('--base', 'HEAD').status).toBe(0)
    schreibe('src/alle.test.ts', testsFuer(ids))
    const r = lauf('--base', 'HEAD')
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/mit Test: 200,/)
  })

  it('@TA-010 der Stand von main wird gemessen, nicht aus der Datei gelesen: eine veraltete Untergrenze lässt keinen Verlust durch', () => {
    hauptMit199()
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 150, kennungen: [] }))
    git('add', '-A')
    git('commit', '-q', '-m', 'floor alt')
    schreibe('src/alle.test.ts', testsFuer(ohneZm096))
    const r = lauf('--base', 'HEAD')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/< Hauptzweig 199 \(gemessen/)
  })

  it('@TA-010 die Untergrenze in der Datei darf nicht unter die Datei auf main sinken; defekte Datei auf main ist rot', () => {
    hauptMit199()
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 199, kennungen: [] }))
    git('add', '-A')
    git('commit', '-q', '--allow-empty', '-m', 'floor')
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 150, kennungen: [] }))
    const gesenkt = lauf('--base', 'HEAD')
    expect(gesenkt.status).toBe(1)
    expect(gesenkt.stderr).toMatch(/Untergrenze 150 < Untergrenze 199 auf HEAD \(Senken verboten\)/)
    schreibe('tests/meta/szenario-floor.json', '{ kaputt')
    git('add', '-A')
    git('commit', '-q', '-m', 'kaputt')
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 199, kennungen: [] }))
    const defekt = lauf('--base', 'HEAD')
    expect(defekt.status).toBe(1)
    expect(defekt.stderr).toMatch(/kein gueltiges JSON/)
  })

  it('@TA-010 unbekannte Ref ist rot (fail-closed); --floor-schreiben schreibt die Untergrenze; Zahl unter der eigenen Untergrenze ist rot', () => {
    liste(['ZM-096', 'HE-001'], 2)
    schreibe('src/a.test.ts', "it('ZM-096 x', () => {})\n")
    expect(lauf('--floor-schreiben').status).toBe(0)
    expect(JSON.parse(readFileSync(join(ordner, 'tests/meta/szenario-floor.json'), 'utf8')).mitTest).toBe(1)
    const r = lauf('--base', 'gibt-es-nicht')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Base-Ref "gibt-es-nicht" existiert nicht/)
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 3, kennungen: [] }))
    const darunter = lauf()
    expect(darunter.status).toBe(1)
    expect(darunter.stderr).toMatch(/< Untergrenze 3 in der Datei/)
  })

  it('@TA-010 die Job-Summary nennt höchstens 30 verlorene Kennungen und zählt den Rest', () => {
    liste(ids, 200)
    schreibe('src/alle.test.ts', testsFuer(ids))
    schreibe('tests/meta/szenario-floor.json', JSON.stringify({ mitTest: 0, kennungen: [] }))
    git('init', '-q', '-b', 'main')
    git('add', '-A')
    git('commit', '-q', '-m', 'main')
    schreibe('src/alle.test.ts', "it('ZM-001 bleibt', () => {})\n")
    const summary = join(ordner, 'summary.md')
    lauf('--base', 'HEAD', '--summary', summary)
    const md = readFileSync(summary, 'utf8')
    expect(md).toMatch(/und 169 weitere/)
    expect(md.match(/`ZM-\d{3}`/g)?.length).toBe(30)
  })

  it('@TA-010 Gegenbeispiel: mit gesetztem GIT_DIR/GIT_INDEX_FILE (pre-commit-Hook) bleibt ein fremdes Repo unveraendert', () => {
    const fremd = mkdtempSync(join(tmpdir(), 'fremdes-repo-'))
    try {
      const fremdGit = (...a: string[]) => {
        const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: fremd, encoding: 'utf8', env: { ...sauberEnv(), GIT_CEILING_DIRECTORIES: dirname(fremd) } })
        expect(r.status, a.join(' ')).toBe(0)
        return r.stdout.trim()
      }
      fremdGit('init', '-q', '-b', 'main')
      writeFileSync(join(fremd, 'x.txt'), 'x')
      fremdGit('add', 'x.txt')
      fremdGit('commit', '-q', '-m', 'x')
      const zustand = () => [
        fremdGit('rev-parse', 'HEAD'),
        fremdGit('config', 'core.bare'),
        readFileSync(join(fremd, '.git/index')).toString('hex'),
        readFileSync(join(fremd, '.git/config'), 'utf8'),
      ]
      const vorher = zustand()
      const hook = { ...process.env, GIT_DIR: join(fremd, '.git'), GIT_INDEX_FILE: join(fremd, '.git/index'), GIT_WORK_TREE: fremd }
      // wie der Test-Helfer: Aufrufe mit sauberEnv(hook) duerfen das fremde Repo nicht beruehren
      const imTemp = (...a: string[]) =>
        spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, encoding: 'utf8', env: sauberEnv(hook) })
      expect(imTemp('init', '-q', '-b', 'main').status).toBe(0)
      schreibe('src/neu.test.ts', "it('ZM-096 x', () => {})\n")
      expect(imTemp('add', '-A').status).toBe(0)
      expect(imTemp('commit', '-q', '-m', 'im temp').status).toBe(0)
      expect(zustand()).toEqual(vorher)
      expect(existsSync(join(ordner, '.git'))).toBe(true)
    } finally {
      rmSync(fremd, { recursive: true, force: true })
    }
  })
})

describe('mvp-kennungen-erzeugen.mjs', () => {
  it('@TA-006 die Erzeugung aus einer Beispiel-JSON ergibt dieselbe Liste samt soll', () => {
    const quelle = join(ordner, 'anf.json')
    writeFileSync(
      quelle,
      JSON.stringify({ klasse: 'mvp', soll: 3, kennungen: ['HE-001', 'HE-004', 'ZM-096'], je_record: { helfer: 2, zuschauer: 1, leer: 0 }, zahlen: {} }),
    )
    const ziel = join(ordner, 'out.json')
    const r = spawnSync('node', [resolve(__dirname, '..', 'mvp-kennungen-erzeugen.mjs'), '--anf-json', quelle, '--out', ziel], { encoding: 'utf8' })
    expect(r.status).toBe(0)
    const erg = JSON.parse(readFileSync(ziel, 'utf8'))
    expect(erg.soll).toBe(3)
    expect(erg.records).toEqual({ helfer: ['HE-001', 'HE-004'], zuschauer: ['ZM-096'] })
  })

  it('@TA-006 weicht soll von der Kennungszahl ab, bricht die Erzeugung ab', () => {
    const quelle = join(ordner, 'anf.json')
    writeFileSync(quelle, JSON.stringify({ klasse: 'mvp', soll: 4, kennungen: ['HE-001'], je_record: { helfer: 1 } }))
    const r = spawnSync('node', [resolve(__dirname, '..', 'mvp-kennungen-erzeugen.mjs'), '--anf-json', quelle, '--out', join(ordner, 'o.json')], { encoding: 'utf8' })
    expect(r.status).not.toBe(0)
  })
})
