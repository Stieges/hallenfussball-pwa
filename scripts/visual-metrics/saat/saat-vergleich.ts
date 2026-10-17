/**
 * Vergleich der eingefrorenen Saat mit einer frischen Erzeugung (R-SM-3). Liefert eine klare Meldung
 * mit dem ersten abweichenden Pfad; leer = gleich.
 */
export const NEU_ERZEUGEN = 'SAAT_NEU=1 npx vitest run scripts/visual-metrics/saat'

function erstesUnterschied(a: unknown, b: unknown, pfad: string): string | null {
  if (Object.is(a, b)) { return null }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { return `${pfad}: ${String(a.length)} statt ${String(b.length)} Einträge` }
    for (let i = 0; i < a.length; i++) {
      const d = erstesUnterschied(a[i], b[i], `${pfad}[${String(i)}]`)
      if (d !== null) { return d }
    }
    return null
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null && !Array.isArray(a) && !Array.isArray(b)) {
    const ra = a as Record<string, unknown>
    const rb = b as Record<string, unknown>
    for (const k of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
      if (!(k in ra)) { return `${pfad}.${k}: fehlt in der eingefrorenen Datei` }
      if (!(k in rb)) { return `${pfad}.${k}: gibt es in der frischen Erzeugung nicht mehr` }
      const d = erstesUnterschied(ra[k], rb[k], `${pfad}.${k}`)
      if (d !== null) { return d }
    }
    return null
  }
  return `${pfad}: ${JSON.stringify(a)} statt ${JSON.stringify(b)}`
}

/** Leer, wenn gleich; sonst die Meldung samt Weg, die Datei neu zu erzeugen. */
export function vergleicheSaat(eingefroren: unknown, frisch: unknown): string {
  const d = erstesUnterschied(eingefroren, frisch, 'saat')
  return d === null ? '' : `Die eingefrorene Saat ist veraltet (App-Format oder Erzeugung geändert) – erstes Abweichen bei ${d}. Neu erzeugen: ${NEU_ERZEUGEN}`
}
