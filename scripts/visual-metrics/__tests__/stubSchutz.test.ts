// Stub-Absicherung der visuellen Messung (A-17b, Nachblick #335 F-4): Ein Stub-Lauf erreicht nie ein echtes Supabase-Projekt.
// (1) Vite gibt gesetzten Umgebungsvariablen Vorrang vor `.env`: `VITE_SUPABASE_URL` aus der Shell darf den Stub-Build
//     nicht auf ein echtes Projekt lenken. (2) Der Stub bricht jede Anfrage an `*.supabase.co`/`*.supabase.in` ab.
// Braucht keinen Browser und kein echtes Vite (beides wird ersetzt); läuft im Unit-Job.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// @ts-expect-error -- ESM-Hilfsmodul ohne Typen
import { mitStubUmgebung, starteApp } from '../app-server.mjs'
// @ts-expect-error -- ESM-Hilfsmodul ohne Typen
import { STUB_URL, installiereStub, istEchtesSupabase } from '../stub.mjs'

const PROD_URL = 'https://abcdefghijklmnop.supabase.co'
const SCHLUESSEL = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const
let vorher: Record<string, string | undefined> = {}

beforeEach(() => {
  vorher = Object.fromEntries(SCHLUESSEL.map((k) => [k, process.env[k]]))
})
afterEach(() => {
  for (const k of SCHLUESSEL) {
    if (vorher[k] === undefined) delete process.env[k]
    else process.env[k] = vorher[k]
  }
})

describe('Stub-Build: Umgebung aus der Shell lenkt nicht auf ein echtes Projekt', () => {
  it('mitStubUmgebung setzt die Stub-Adresse für die Dauer des Builds und stellt danach wieder her', async () => {
    process.env.VITE_SUPABASE_URL = PROD_URL
    process.env.VITE_SUPABASE_ANON_KEY = 'echter-schluessel'
    let waehrend: Record<string, string | undefined> = {}
    await mitStubUmgebung(STUB_URL, () => {
      waehrend = { url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY }
    })
    expect(waehrend).toEqual({ url: STUB_URL, key: 'vm-stub-key' })
    expect(process.env.VITE_SUPABASE_URL).toBe(PROD_URL)
    expect(process.env.VITE_SUPABASE_ANON_KEY).toBe('echter-schluessel')
  })

  it('stellt auch nach einem Fehler wieder her; vorher nicht gesetzte Variablen bleiben ungesetzt', async () => {
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_ANON_KEY
    await expect(mitStubUmgebung(STUB_URL, () => { throw new Error('Build kaputt') })).rejects.toThrow('Build kaputt')
    expect(process.env.VITE_SUPABASE_URL).toBeUndefined()
    expect(process.env.VITE_SUPABASE_ANON_KEY).toBeUndefined()
  })

  it('Gegenbeispiel: ohne Stub bleibt die Umgebung unberührt', async () => {
    process.env.VITE_SUPABASE_URL = PROD_URL
    let waehrend: string | undefined
    await mitStubUmgebung(null, () => { waehrend = process.env.VITE_SUPABASE_URL })
    expect(waehrend).toBe(PROD_URL)
  })

  it('starteApp baut im Stub-Lauf mit der Stub-Adresse, auch wenn die Shell eine echte Adresse exportiert', async () => {
    process.env.VITE_SUPABASE_URL = PROD_URL
    process.env.VITE_SUPABASE_ANON_KEY = 'echter-schluessel'
    const cache = mkdtempSync(join(tmpdir(), 'vm-stubschutz-'))
    const gesehen: Array<string | undefined> = []
    const vite = {
      build: async (opt: { build: { outDir: string } }) => {
        gesehen.push(process.env.VITE_SUPABASE_URL)
        mkdirSync(opt.build.outDir, { recursive: true })
      },
      preview: async () => ({ httpServer: { close: (fertig: () => void) => fertig() } }),
    }
    try {
      const app = await starteApp({ neuBauen: true, stubUrl: STUB_URL, cache, vite })
      await app.stop()
    } finally {
      rmSync(cache, { recursive: true, force: true })
    }
    expect(gesehen).toEqual([STUB_URL])
    expect(process.env.VITE_SUPABASE_URL).toBe(PROD_URL)
  })
})

describe('Stub blockt echte Supabase-Projekte', () => {
  it.each([
    'https://abcdefghijklmnop.supabase.co/rest/v1/rpc/join_code_info',
    'https://abcdefghijklmnop.supabase.co/auth/v1/signup',
    'wss://abcdefghijklmnop.supabase.co/realtime/v1/websocket',
    'https://abcdefghijklmnop.SUPABASE.CO/x',
    'https://abcdefghijklmnop.supabase.in/rest/v1/x',
  ])('erkennt %s', (url) => {
    expect(istEchtesSupabase(new URL(url))).toBe(true)
  })

  it.each([
    `${STUB_URL}/rest/v1/rpc/join_code_info`,
    'http://127.0.0.1:4173/#/join/ABCDEFGH23',
    'https://supabase.com/docs',
    'https://evil-supabase.co.example/x',
  ])('Gegenbeispiel: %s ist kein echtes Projekt', (url) => {
    expect(istEchtesSupabase(new URL(url))).toBe(false)
  })

  it('installiereStub legt eine Abbruch-Route für echte Projekte an', async () => {
    type Handler = (route: { abort: (grund?: string) => Promise<void>; request: () => unknown }) => Promise<unknown> | unknown
    const routen: Array<{ muster: unknown; handler: Handler }> = []
    const ctx = {
      addInitScript: async () => undefined,
      route: async (muster: unknown, handler: Handler) => { routen.push({ muster, handler }) },
    }
    await installiereStub(ctx, { name: 'test/leer', zustand: {} })

    const echte = new URL('https://abcdefghijklmnop.supabase.co/rest/v1/rpc/join_code_info')
    const treffer = routen.filter((r) => typeof r.muster === 'function' && (r.muster as (u: URL) => boolean)(echte))
    expect(treffer).toHaveLength(1)
    const abgebrochen: Array<string | undefined> = []
    await treffer[0].handler({ abort: async (grund) => { abgebrochen.push(grund) }, request: () => ({ url: () => echte.href }) })
    expect(abgebrochen).toEqual(['blockedbyclient'])
  })
})
