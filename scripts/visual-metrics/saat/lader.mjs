// Lader der Saat (Paket SM, @TA-011, R-SM-1): liest eine eingefrorene Saat-Datei und legt sie per addInitScript
// VOR dem ersten Skript der App in IndexedDB und localStorage ab. Kein Code in src/ (Testumgebung ≠ Produktivcode).
//
// Reihenfolge: Der Init-Skript-Aufruf oeffnet die Datenbank als ERSTES und schreibt in derselben Transaktion bzw.
// einer vor der App-Abfrage angelegten Schreib-Transaktion. IndexedDB ordnet Transaktionen nach ihrer Anlage;
// die spaetere Lese-Abfrage der App wartet. Zeit-Marken ("@jetzt-320s") werden beim Laden aufgeloest, damit ein
// laufendes Spiel mit plausibler Spieluhr erscheint.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = dirname(fileURLToPath(import.meta.url))
export const SAAT_ORDNER = HIER

/** Namen sind Dateinamen im Ordner `saat/`: nur Kleinbuchstaben, Ziffern, Bindestrich. */
export function leseSaat(name) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Saat-Name "${name}" ungueltig (nur a-z, 0-9, -)`)
  const pfad = join(HIER, `${name}.json`)
  if (!existsSync(pfad)) throw new Error(`Saat "${name}" fehlt: ${pfad}`)
  const saat = JSON.parse(readFileSync(pfad, 'utf8'))
  if (saat.formatVersion !== 1) throw new Error(`Saat "${name}": Format ${saat.formatVersion} unbekannt`)
  return saat
}

/** Laeuft im Browser, vor jedem Skript der Seite. Muss ohne Schliessvariablen auskommen (wird serialisiert). */
function ladeImBrowser(saat) {
  if (window.top !== window) return
  const jetzt = Date.now()
  // Zeit-Marken: "@jetzt-320s" -> ISO-Text, "@jetzt-ms-320000" -> Epoch-ms (Zahl, fuer Engine-Ereignisse).
  const loese = (wert) => {
    if (typeof wert === 'string') {
      const iso = /^@jetzt([+-]\d+)s$/.exec(wert)
      if (iso) return new Date(jetzt + Number(iso[1]) * 1000).toISOString()
      const ms = /^@jetzt-ms([+-]\d+)$/.exec(wert)
      return ms ? jetzt + Number(ms[1]) : wert
    }
    if (Array.isArray(wert)) return wert.map(loese)
    if (wert && typeof wert === 'object') return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, loese(v)]))
    return wert
  }
  try {
    for (const [k, v] of Object.entries(saat.localStorage)) {
      if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(loese(v)))
    }
  } catch { /* localStorage gesperrt: die Messung meldet dann die leere Ansicht */ }
  for (const { name, version, store, eintraege } of saat.datenbanken) {
    const anfrage = indexedDB.open(name, version)
    anfrage.onupgradeneeded = () => {
      if (!anfrage.result.objectStoreNames.contains(store)) anfrage.result.createObjectStore(store, { keyPath: 'key' })
    }
    anfrage.onsuccess = () => {
      const db = anfrage.result
      const tx = db.transaction(store, 'readwrite')
      for (const [key, value] of Object.entries(eintraege)) tx.objectStore(store).put({ key, value: loese(value) })
      tx.oncomplete = () => db.close()
      tx.onerror = () => db.close()
    }
  }
}

/** Haengt die Saat an einen Playwright-Kontext (vor dem ersten `goto`). */
export async function installiereSaat(ctx, saat) {
  await ctx.addInitScript(ladeImBrowser, saat)
}
