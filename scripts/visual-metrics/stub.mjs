// Netz-Stub für die Messung (A-17b, Review #335 M-4): App-Ansichten, die Server-Antworten brauchen (Helfer-Beitritt), werden
// ohne Datenbank und ohne Migration gemessen. Der Build bekommt eine Scheinadresse (lokal, kein Produktionsprojekt); alle
// Aufrufe an diese Adresse beantwortet `installiereStub` aus einer Stub-Datei `stubs/<datei>.json`, Zustand `<zustand>`.
//   --stub helfer-join/e1     Datei stubs/helfer-join.json, Zustand "e1"
// Zustand: { rpc: { <funktion>: { json } | { fehler: { code, message } } | { abbruch: true } },
//            einwilligung: true (Datenschutz-Abfrage vorab beantwortet), signup: "ok" | "429" (optional, Standard "ok"), konto: { id, name } (optional: angemeldetes Konto im Speicher) }
// Kein Code in src/ (Testumgebung ≠ Produktivcode). Nie gegen Produktion: die Adresse ist fest 127.0.0.1.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = dirname(fileURLToPath(import.meta.url))
export const STUB_URL = 'http://127.0.0.1:54399'
export const STUB_STORAGE_KEY = 'sb-127-auth-token' // auth-js: sb-<erster Teil des Hostnamens>-auth-token

export function leseStub(angabe) {
  const m = /^([a-z0-9-]+)\/([A-Za-z0-9_-]+)$/.exec(angabe)
  if (!m) throw new Error(`--stub "${angabe}" ungueltig (Form: <datei>/<zustand>)`)
  const pfad = join(HIER, 'stubs', `${m[1]}.json`)
  if (!existsSync(pfad)) throw new Error(`Stub-Datei fehlt: ${pfad}`)
  const zustand = JSON.parse(readFileSync(pfad, 'utf8'))[m[2]]
  if (!zustand) throw new Error(`Stub "${m[1]}" kennt den Zustand "${m[2]}" nicht`)
  return { name: angabe, zustand }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
}

function sitzung(id, anonym, name) {
  const jetzt = Math.floor(Date.now() / 1000)
  const user = { id, aud: 'authenticated', role: 'authenticated', is_anonymous: anonym, email: anonym ? '' : 'greta@test.local', app_metadata: {}, user_metadata: anonym ? {} : { name }, created_at: new Date().toISOString() }
  return { access_token: 'vm-stub-token', token_type: 'bearer', expires_in: 3600, expires_at: jetzt + 3600, refresh_token: 'vm-stub-refresh', user }
}

/** Vor dem ersten Skript: ggf. ein angemeldetes Konto in den Speicher legen; alle Aufrufe an STUB_URL beantworten. */
export async function installiereStub(ctx, stub) {
  const z = stub.zustand
  if (z.konto) {
    const wert = JSON.stringify(sitzung(z.konto.id, false, z.konto.name))
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch { /* gesperrt */ } }, [STUB_STORAGE_KEY, wert])
  }
  if (z.einwilligung) {
    // Zustände mit Dialog über der Seite (Rückfrage): die Datenschutz-Abfrage vorab beantworten, sonst deckt sie den Dialog zu
    const wert = JSON.stringify({ errorTracking: true, sessionReplay: false, timestamp: Date.now(), version: 1 })
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch { /* gesperrt */ } }, ['app:consent', wert])
  }
  await ctx.route(`${STUB_URL}/**`, async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const pfad = new URL(req.url()).pathname
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(pfad)
    if (rpc) {
      const antwort = z.rpc?.[rpc[1]]
      if (!antwort) return json(404, { code: 'PGRST202', message: `Stub kennt ${rpc[1]} nicht` })
      if (antwort.abbruch) return route.abort('failed')
      if (antwort.fehler) return json(400, antwort.fehler)
      return json(200, antwort.json)
    }
    if (pfad === '/auth/v1/signup') {
      if (z.signup === '429') return json(429, { code: 429, error_code: 'over_request_rate_limit', msg: 'rate limit' })
      return json(200, sitzung('00000000-0000-4000-8000-0000000000aa', true, ''))
    }
    // Angemeldetes Konto: die App prueft den Nutzer beim Start (`getUser`) und frischt ggf. auf
    if (z.konto && pfad === '/auth/v1/user') return json(200, sitzung(z.konto.id, false, z.konto.name).user)
    if (z.konto && pfad === '/auth/v1/token') return json(200, sitzung(z.konto.id, false, z.konto.name))
    // Profile, Einstellungen, Sitzung auffrischen usw.: leer, damit nichts hängt
    if (pfad.startsWith('/rest/v1/')) return json(200, [])
    return json(404, { msg: 'vm-stub: nicht vorgesehen' })
  })
}
