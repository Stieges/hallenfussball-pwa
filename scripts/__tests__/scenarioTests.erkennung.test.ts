// Werkzeugkette: Erkennung der Szenario-Kennungen in Testdateien (scripts/lib/testtexte.mjs)
// Plattform-Record "Testabdeckung": Stand je MVP-Szenario (@TA-026, @TA-027, @TA-028, @TA-029, @TA-030, @TA-031, @TA-032, @TA-033)
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
const liste = (ids: string[]) =>
  schreibe('tests/meta/mvp-kennungen.json', JSON.stringify({ soll: ids.length, records: { alle: ids } }))
const sauberEnv = (): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
  GIT_CEILING_DIRECTORIES: dirname(ordner),
})
const lauf = () => spawnSync('node', [SKRIPT, '--root', ordner], { encoding: 'utf8', env: sauberEnv() })
/** Zahl hinter "mit Test:" in der Ausgabe. */
const mitTest = (): number => Number(/mit Test: (\d+),/.exec(lauf().stdout)?.[1] ?? NaN)

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'kennungs-erkennung-'))
  schreibe('tests/meta/nachweis-generalprobe.json', JSON.stringify({ max: 15, kennungen: [] }))
})
afterEach(() => rmSync(ordner, { recursive: true, force: true }))

describe('Kennungs-Erkennung: Tests mit Typ-Parameter', () => {
  it('@TA-026 it.each<T>, test.each<T> und describe.each<T> zaehlen mit der Kennung im Titel', () => {
    liste(['ZM-001', 'ZM-002', 'ZM-003', 'ZM-004', 'ZM-005'])
    schreibe(
      'src/a.test.ts',
      [
        "it.each<[string, number]>([['a', 1]])('@ZM-001 Tupel %s', () => {})",
        "it.each<Role>(['x'])('@ZM-002 Alias %s', () => {})",
        "test.each<{ f: () => void; n: Array<string> }>([])('@ZM-003 Objekt mit Pfeil-Typ', () => {})",
        "describe.each<[string, (x: number) => Promise<void>]>([])('@ZM-004 Gruppe', () => {})",
        "it.each<[string]>(\n  [['a']],\n)(\n  '@ZM-005 mehrzeilig',\n  () => {},\n)",
      ].join('\n'),
    )
    expect(mitTest()).toBe(5)
  })

  it('@TA-026 Gegenbeispiel: Kennung nur im Kommentar vor oder in einem it.each<T> zaehlt nicht', () => {
    liste(['ZM-001', 'ZM-002'])
    schreibe(
      'src/b.test.ts',
      [
        "// it.each<[string]>([['a']])('@ZM-001 auskommentiert', () => {})",
        "/* test.each<Role>(['x'])('@ZM-002 auch auskommentiert', () => {}) */",
        "it.each<Role>(['x'])('ohne Kennung %s', () => { /* @ZM-001 */ })",
        "const nebenbei = 'it.each<Role>([])(\"@ZM-002 im String\")'",
      ].join('\n'),
    )
    expect(mitTest()).toBe(0)
  })

  it('@TA-026 Gegenbeispiel: ein Vergleich `it < 3` ist kein Test', () => {
    liste(['ZM-001'])
    schreibe('src/c.test.ts', "const it = 1\nconst klein = it < 3 && it > 0\nconst s = ('@ZM-001')\n")
    expect(mitTest()).toBe(0)
  })
})

describe('Kennungs-Erkennung: Regex-Literale mit Anfuehrungszeichen (Rauchtest-Form)', () => {
  it('@TA-027 ein Regex-Literal mit " vor dem Test verschluckt die Titel nicht', () => {
    liste(['RT-001', 'RT-002', 'RT-005'])
    schreibe(
      'tests/e2e/prod-smoke/x.spec.ts',
      [
        'async function skripte(html: string) {',
        '  return [...html.matchAll(/(?:src|href)="(\\/assets\\/[^"]+\\.js)"/g)].map((m) => m[1]);',
        '}',
        "test.describe('Rauchtest (@RT-005 uebersprungen)', () => {",
        "  test('@RT-001 @RT-002 Kurzlauf', async () => {})",
        '})',
      ].join('\n'),
    )
    expect(mitTest()).toBe(3)
  })

  it("@TA-027 auch ein Regex-Literal mit ' oder ` vor dem Test stoert nicht", () => {
    liste(['RT-001', 'RT-002'])
    schreibe(
      'src/d.test.ts',
      [
        "const a = /it's/.test(x)",
        "it('@RT-001 nach Apostroph-Regex', () => {})",
        'const b = x.replace(/`/g, "")',
        "it('@RT-002 nach Backtick-Regex', () => {})",
      ].join('\n'),
    )
    expect(mitTest()).toBe(2)
  })

  it('@TA-027 gleichzeitig: Division und JSX-Schliess-Tag werden nicht als Regex gelesen', () => {
    liste(['RT-001', 'RT-002'])
    schreibe(
      'src/e.test.tsx',
      [
        'const hälfte = summe / 2; const drittel = summe / 3',
        "it('@RT-001 nach Division', () => { render(<div>Hallo</div>) })",
        "it('@RT-002 nach Tag', () => {})",
      ].join('\n'),
    )
    expect(mitTest()).toBe(2)
  })

  it('@TA-027 Gegenbeispiel: ein Regex-Literal mit Anfuehrungszeichen macht aus dem Kommentar danach keinen Test', () => {
    liste(['RT-001'])
    schreibe(
      'src/f.test.ts',
      ['const r = /"x"/', "// it('@RT-001 auskommentiert', () => {})", "/* it('@RT-001 Block', () => {}) */"].join('\n'),
    )
    expect(mitTest()).toBe(0)
  })
})

describe('Kennungs-Erkennung: Kommentare zaehlen nie', () => {
  it('@TA-028 Kennungen in Zeilen-, Block- und Doc-Kommentaren, auch neben echten Tests, zaehlen nicht', () => {
    liste(['ZM-001', 'ZM-002', 'ZM-003'])
    schreibe(
      'src/g.test.ts',
      [
        '/**',
        " * it('@ZM-001 Doc-Kommentar')",
        ' */',
        "it('@ZM-003 echter Test', () => {",
        '  // @ZM-001 im Rumpf',
        '  /* @ZM-002 im Rumpf */',
        '})',
        "// it('@ZM-002 danach', () => {})",
      ].join('\n'),
    )
    expect(mitTest()).toBe(1)
  })
})
