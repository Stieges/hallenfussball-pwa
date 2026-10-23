// App-Ziel mit Build-Nachweis (Review B-01/B-02/B-20): baut den Stand von HEAD ohne jede .env-Datei
// (leeres envDir, also ohne Supabase-Verbindung) und startet `vite preview` auf einem freien Port.
// Im Build liegt vm-build.json mit Commit, Arbeitsbaum-Zustand und einer Lauf-Kennung (nonce);
// das Gate vergleicht sie mit HEAD.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = dirname(fileURLToPath(import.meta.url))

export function repoWurzel() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: HIER, encoding: 'utf8' }).trim()
}

export function gitStand(wurzel = repoWurzel()) {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: wurzel, encoding: 'utf8' }).trim()
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', 'src', 'public', 'index.html', 'vite.config.ts', 'package.json'], { cwd: wurzel, encoding: 'utf8' }).trim()
  return { sha, kurz: sha.slice(0, 8), veraendert: status.length > 0, aenderungen: status ? status.split('\n').length : 0 }
}

export function freierPort() {
  return new Promise((ok, fehler) => {
    const s = createServer()
    s.unref()
    s.on('error', fehler)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })
}

const STUB_SCHLUESSEL = 'vm-stub-key'

/**
 * Stub-Lauf (Nachblick #335 F-4): Vite gibt bereits gesetzten Umgebungsvariablen Vorrang vor `.env`-Dateien. Ist
 * `VITE_SUPABASE_URL` in der Shell oder in CI exportiert, baute der Stub-Lauf sonst gegen diese Adresse und der Stub fing
 * nichts ab. Darum für die Dauer von `fn` (Build) die Stub-Werte setzen und danach den alten Stand wiederherstellen.
 * Ohne Stub bleibt die Umgebung unberührt.
 */
export async function mitStubUmgebung(stubUrl, fn) {
  if (!stubUrl) return fn()
  const werte = { VITE_SUPABASE_URL: stubUrl, VITE_SUPABASE_ANON_KEY: STUB_SCHLUESSEL }
  const alt = Object.fromEntries(Object.keys(werte).map((k) => [k, process.env[k]]))
  Object.assign(process.env, werte)
  try {
    return await fn()
  } finally {
    for (const [k, v] of Object.entries(alt)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

// `cache` und `vite` nur für Tests (stubSchutz.test.ts): eigener Cache-Ordner, Vite durch Attrappe ersetzt.
export async function starteApp({ neuBauen = false, log = () => {}, stubUrl = null, cache: cacheOrdner = null, vite = null } = {}) {
  const wurzel = repoWurzel()
  const stand = gitStand(wurzel)
  const cache = cacheOrdner ?? join(wurzel, 'node_modules', '.cache', 'visual-metrics')
  // Mit Stub (A-17b): Scheinadresse für Supabase (lokal, nie ein Produktionsprojekt); sonst leeres envDir wie bisher.
  const envLeer = join(cache, stubUrl ? 'env-stub' : 'env-leer')
  mkdirSync(envLeer, { recursive: true })
  if (stubUrl) writeFileSync(join(envLeer, '.env'), `VITE_SUPABASE_URL=${stubUrl}\nVITE_SUPABASE_ANON_KEY=${STUB_SCHLUESSEL}\n`)
  const outDir = join(cache, `${stand.veraendert ? `build-${stand.kurz}-veraendert` : `build-${stand.kurz}`}${stubUrl ? '-stub' : ''}`)
  const stempelPfad = join(outDir, 'vm-build.json')
  const { build, preview } = vite ?? (await import(join(wurzel, 'node_modules', 'vite', 'dist', 'node', 'index.js')))

  // Ohne existsSync-Vorpruefung lesen (kein Pruefen-dann-Nutzen-Wettlauf, CodeQL js/file-system-race):
  // fehlt oder ist der Stempel kaputt, wird neu gebaut.
  let vorhanden = false
  try {
    vorhanden = JSON.parse(readFileSync(stempelPfad, 'utf8')).sha === stand.sha
  } catch {
    vorhanden = false
  }
  if (neuBauen || stand.veraendert || !vorhanden) {
    log(`Baue App-Stand ${stand.kurz}${stand.veraendert ? ' (Arbeitsbaum veraendert)' : ''} …`)
    const alt = process.env.VERCEL_GIT_COMMIT_SHA
    process.env.VERCEL_GIT_COMMIT_SHA = stand.sha // BUILD_HASH = Commit (vite.config.ts resolveBuildHash)
    try {
      await mitStubUmgebung(stubUrl, () =>
        build({ root: wurzel, configFile: join(wurzel, 'vite.config.ts'), envDir: envLeer, mode: 'production', logLevel: 'error', build: { outDir, emptyOutDir: true } }),
      )
    } finally {
      if (alt === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA
      else process.env.VERCEL_GIT_COMMIT_SHA = alt
    }
  }
  const nonce = randomBytes(12).toString('hex')
  writeFileSync(stempelPfad, `${JSON.stringify({ sha: stand.sha, veraendert: stand.veraendert, aenderungen: stand.aenderungen, nonce, gebaut: new Date().toISOString() }, null, 2)}\n`)

  const port = await freierPort()
  const server = await preview({ root: wurzel, configFile: join(wurzel, 'vite.config.ts'), envDir: envLeer, logLevel: 'error', build: { outDir }, preview: { port, strictPort: true, host: '127.0.0.1', open: false } })
  return {
    basisUrl: `http://127.0.0.1:${port}`,
    stand,
    nonce,
    outDir,
    stop: () => new Promise((ok) => server.httpServer.close(() => ok())),
  }
}
