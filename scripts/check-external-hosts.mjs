#!/usr/bin/env node
// @RE-003: Das gebaute Paket (dist/) darf keine Schrift- oder Skript-Quelle auf fremden Servern nennen.
// Verboten: Schrift-Dienste und Skript-CDNs. Zwei Fundstellen in Fremdbibliotheken sind bekannt und tot (nicht aufgerufen):
//  - jspdf: `output('pdfobjectnewwindow')` (cdnjs …/pdfobject.min.js); die App nutzt es nicht,
//  - browser-image-compression: `libURL` (cdn.jsdelivr.net) – nur mit `useWebWorker: true`; die App setzt `false` (src/utils/logoProcessor.ts).
// Nicht geprüft: Adressen, die nur Namensräume oder Dokumentationslinks sind, und das Google-Profilbild (img-src in vercel.json, nur bei Google-Anmeldung).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const VERBOTEN = /https?:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|unpkg\.com|ajax\.googleapis\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)[^\s"'`)]*/g
const BEKANNT_TOT = [
  /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdfobject\//,
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/browser-image-compression@/,
]

/** Fremde Schrift-/Skript-Adressen im Text, ohne die bekannten toten Fundstellen. */
export function findeFremdeQuellen(text) {
  return (text.match(VERBOTEN) ?? []).filter((url) => !BEKANNT_TOT.some((ok) => ok.test(url)))
}

function dateien(ordner) {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.(js|css|html|webmanifest)$/.test(name) ? [pfad] : []
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const wurzel = process.argv[2] ?? 'dist'
  const treffer = dateien(wurzel).flatMap((pfad) => findeFremdeQuellen(readFileSync(pfad, 'utf8')).map((url) => `${pfad}: ${url}`))
  if (treffer.length > 0) {
    console.error(`@RE-003: fremde Schrift-/Skript-Quellen im Paket:\n${treffer.join('\n')}`)
    process.exit(1)
  }
  console.log('@RE-003: keine fremden Schrift-/Skript-Quellen im Paket.')
}
