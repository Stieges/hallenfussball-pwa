// Gemeinsame Hilfen der Skript-Tests (TM-1): Temp-Ordner, Dateien schreiben, Skripte spawnen, Temp-Git-Repo.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const SZENARIO_SKRIPT = resolve(__dirname, '..', 'scenario-tests.mjs')

export const schreibe = (ordner: string, name: string, inhalt: string) => {
  const pfad = join(ordner, name)
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, inhalt)
}

/** MVP-Liste mit den gegebenen Kennungen (soll = Anzahl). */
export const mvpListe = (ordner: string, ids: string[]) =>
  schreibe(ordner, 'tests/meta/mvp-kennungen.json', JSON.stringify({ soll: ids.length, records: { zuschauer: ids } }))

/** Lokale Befundliste (wie docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md) mit den gegebenen Kennungen (@TA-024). */
export const befundliste = (ordner: string, kennungen: string[]) =>
  schreibe(ordner, 'docs/anforderungen/BEFUNDE-HEUTIGER-CODE.md',
    ['| Kennung | Befund |', '|---|---|', ...kennungen.map((k) => `| ${k} | Beispiel |`)].join('\n') + '\n')

/** Ohne GIT_*-Variablen (pre-commit-Hook), GIT_CEILING_DIRECTORIES auf das Temp-Elternverzeichnis. */
export const sauberEnv = (ordner: string, basis: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(Object.entries(basis).filter(([k]) => !k.startsWith('GIT_') && k !== 'BEFUNDE_PFAD')),
  GIT_CEILING_DIRECTORIES: dirname(ordner),
})

export const szenarioLauf = (ordner: string, ...args: string[]) =>
  spawnSync('node', [SZENARIO_SKRIPT, '--root', ordner, ...args], { encoding: 'utf8', env: sauberEnv(ordner) })

export const git = (ordner: string, ...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd: ordner, encoding: 'utf8', env: sauberEnv(ordner) })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} fehlgeschlagen: ${r.stderr}`)
  return r
}
