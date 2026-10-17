// A-09: coverage-report.mjs (Plattform-Record "Testabdeckung", @TA-001 bis @TA-005, @TA-009)
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SKRIPT = resolve(__dirname, '..', 'coverage-report.mjs')

type Werte = { total: number; covered: number; pct: number }
const werte = (covered: number, total: number): Werte => ({ total, covered, pct: total === 0 ? 100 : (covered / total) * 100 })
const datei = (covered: number, total: number) => ({
  lines: werte(covered, total),
  statements: werte(covered, total),
  functions: werte(covered, total),
  branches: werte(covered, total),
})
const floors = (kern: number) => ({
  bereiche: {
    kern: { pfade: ['src/core/'], floors: { statements: kern, branches: kern, functions: kern, lines: kern } },
    zuschauer: { pfade: ['src/features/public-view/'], floors: { statements: 0, branches: 0, functions: 0, lines: 0 } },
  },
})

let ordner: string
const schreibe = (name: string, inhalt: unknown) => {
  const pfad = join(ordner, name)
  mkdirSync(join(pfad, '..'), { recursive: true })
  writeFileSync(pfad, JSON.stringify(inhalt))
  return pfad
}
const lauf = (...args: string[]) =>
  spawnSync('node', [SKRIPT, '--root', ordner, '--ohne-ratchet', ...args], { encoding: 'utf8' })

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), 'cov-report-'))
})
afterEach(() => rmSync(ordner, { recursive: true, force: true }))

describe('coverage-report.mjs', () => {
  it('@TA-001 eine Datei ohne Test zaehlt mit 0 % und senkt den Bereichswert', () => {
    const summary = {
      total: datei(0, 0),
      [join(ordner, 'src/features/public-view/Geladen.tsx')]: datei(10, 10),
      [join(ordner, 'src/features/public-view/Ungeladen.tsx')]: datei(0, 10),
    }
    const s = schreibe('coverage/coverage-summary.json', summary)
    const f = schreibe('coverage-floors.json', floors(0))
    const r = lauf('--summary', s, '--floors', f, 'zuschauer')
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/zuschauer\s+2\s+50\.00/)
  })

  it('@TA-002 Untergrenze 75 %: gemessene 74 % lassen die Pruefung scheitern, 75 % bestehen', () => {
    const f = schreibe('coverage-floors.json', floors(75))
    const mess = (covered: number) =>
      schreibe('coverage/coverage-summary.json', { total: datei(0, 0), [join(ordner, 'src/core/a.ts')]: datei(covered, 100) })
    expect(lauf('--summary', mess(74), '--floors', f, 'kern').status).toBe(1)
    expect(lauf('--summary', mess(75), '--floors', f, 'kern').status).toBe(0)
  })

  it('@TA-002 @TA-004 eine gegenueber dem Hauptzweig gesenkte Untergrenze laesst die Pruefung scheitern', () => {
    const s = schreibe('coverage/coverage-summary.json', { total: datei(0, 0), [join(ordner, 'src/core/a.ts')]: datei(90, 100) })
    const haupt = schreibe('haupt-floors.json', floors(75))
    const gesenkt = schreibe('coverage-floors.json', floors(74))
    const r = spawnSync('node', [SKRIPT, '--root', ordner, '--summary', s, '--floors', gesenkt, '--base-floors', haupt], { encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/kern\.lines: Untergrenze 74 < Hauptzweig 75/)
    const gleich = schreibe('coverage-floors.json', floors(75))
    const ok = spawnSync('node', [SKRIPT, '--root', ordner, '--summary', s, '--floors', gleich, '--base-floors', haupt], { encoding: 'utf8' })
    expect(ok.status).toBe(0)
    const hoeher = schreibe('coverage-floors.json', floors(78))
    expect(spawnSync('node', [SKRIPT, '--root', ordner, '--summary', s, '--floors', hoeher, '--base-floors', haupt], { encoding: 'utf8' }).status).toBe(0)
  })

  it.each([
    { fall: 'geaenderte Datei von 70 auf 68 %', vorher: 70, nachher: 68, neu: false, rot: true, meldung: /Verschlechterung/ },
    { fall: 'geaenderte Datei von 70 auf 70 %', vorher: 70, nachher: 70, neu: false, rot: false, meldung: /./ },
    { fall: 'neue Datei mit 75 %', vorher: undefined, nachher: 75, neu: true, rot: true, meldung: /neue Datei mit 75 % < 80 %/ },
    { fall: 'neue Datei mit 85 %', vorher: undefined, nachher: 85, neu: true, rot: false, meldung: /./ },
  ])('@TA-005 $fall', ({ vorher, nachher, neu, rot, meldung }) => {
    const pfad = join(ordner, 'src/core/x.ts')
    const s = schreibe('coverage/coverage-summary.json', { total: datei(0, 0), [pfad]: datei(nachher, 100) })
    const v = schreibe('vorher.json', { total: datei(0, 0), ...(vorher === undefined ? {} : { [pfad]: datei(vorher, 100) }) })
    const f = schreibe('coverage-floors.json', floors(0))
    const r = lauf('--summary', s, '--floors', f, '--vorher', v, ...(neu ? ['--neu', 'src/core/x.ts'] : ['--files', 'src/core/x.ts']))
    expect(r.status).toBe(rot ? 1 : 0)
    if (rot) expect(r.stderr).toMatch(meldung)
  })

  it('@TA-009 bleibt der Bereichswert gleich, bleibt die Untergrenze unberuehrt und die Pruefung gruen', () => {
    // Eine geloeschte Datei samt Tests verschwindet aus Summary UND Vorher-Summary; der Bericht
    // verlangt dazu nichts - Untergrenzen werden nur von Hand am Gruppenende angehoben.
    const s = schreibe('coverage/coverage-summary.json', { total: datei(0, 0), [join(ordner, 'src/core/a.ts')]: datei(80, 100) })
    const f = schreibe('coverage-floors.json', floors(75))
    expect(lauf('--summary', s, '--floors', f).status).toBe(0)
  })

  it('@TA-001 Bereichswert ist covered/total, nicht der Mittelwert der Prozente (10/10 und 0/90 ergeben 10 %)', () => {
    const s = schreibe('coverage/coverage-summary.json', {
      total: datei(0, 0),
      [join(ordner, 'src/features/public-view/Klein.tsx')]: datei(10, 10),
      [join(ordner, 'src/features/public-view/Gross.tsx')]: datei(0, 90),
    })
    const f = schreibe('coverage-floors.json', floors(0))
    const r = lauf('--summary', s, '--floors', f, 'zuschauer')
    expect(r.stdout).toMatch(/zuschauer\s+2\s+10\.00/)
  })

  it('@TA-002 eine unbekannte Base-Ref laesst den Ratchet scheitern (fail-closed)', () => {
    const s = schreibe('coverage/coverage-summary.json', { total: datei(0, 0), [join(ordner, 'src/core/a.ts')]: datei(90, 100) })
    const f = schreibe('coverage-floors.json', floors(75))
    const r = spawnSync('node', [SKRIPT, '--root', ordner, '--summary', s, '--floors', f, '--base', 'origin/mian'], { encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Base-Ref "origin\/mian" existiert nicht/)
  })

  it('@TA-004 existiert die Ref, kennt die Datei aber noch nicht (erster Merge), geht es mit Hinweis durch', () => {
    // GIT_*-Variablen (z. B. aus dem Pre-Commit-Hook) duerfen nicht auf das echte Repo zeigen.
    // GIT_CEILING_DIRECTORIES: schlaegt `git init` fehl, sucht Git nicht in ein umgebendes Repo hinein.
    const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))), GIT_CEILING_DIRECTORIES: dirname(ordner) }
    const git = (...a: string[]) => {
      const g = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, encoding: 'utf8', env })
      if (g.status !== 0) throw new Error(`git ${a.join(' ')} fehlgeschlagen: ${g.stderr}`)
    }
    git('init', '-q')
    writeFileSync(join(ordner, 'x.txt'), 'x')
    git('add', 'x.txt')
    git('commit', '-q', '-m', 'x')
    const s = schreibe('coverage/coverage-summary.json', { total: datei(0, 0), [join(ordner, 'src/core/a.ts')]: datei(90, 100) })
    const f = schreibe('coverage-floors.json', floors(75))
    const r = spawnSync('node', [SKRIPT, '--root', ordner, '--summary', s, '--floors', f, '--base', 'HEAD'], { encoding: 'utf8', env })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/erster Merge/)
  })

  it('@TA-004 verengte Bereichspfade gegenueber dem Hauptzweig sind rot, erweiterte erlaubt', () => {
    const s = schreibe('coverage/coverage-summary.json', {
      total: datei(0, 0),
      [join(ordner, 'src/core/match/a.ts')]: datei(95, 100),
      [join(ordner, 'src/core/storage/b.ts')]: datei(10, 100),
    })
    const haupt = schreibe('haupt-floors.json', floors(0))
    const lauf2 = (pfade: string[]) => {
      const neu = floors(0)
      neu.bereiche.kern.pfade = pfade
      const f = schreibe('coverage-floors.json', neu)
      return spawnSync('node', [SKRIPT, '--root', ordner, '--summary', s, '--floors', f, '--base-floors', haupt], { encoding: 'utf8' })
    }
    const eng = lauf2(['src/core/match/'])
    expect(eng.status).toBe(1)
    expect(eng.stderr).toMatch(/Pfad "src\/core\/" des Hauptzweigs ist nicht mehr im Bereich/)
    expect(lauf2(['src/core/', 'src/extra/']).status).toBe(0)
  })
})
