// Pruefmatrix der visuellen Pruefung (Skill visuelle-pruefung, Auftrag Daniel 2026-10-16).
// rand: 'null' = TV-Rand 0, 'standard' = Standard-Rand aus grenzwerte.json (overscan.standard).
// Monitor-Profile gibt es nur paarweise (Rand 0 + Standard); loeseProfile ergaenzt den Partner.

export const PROFILE = {
  'handy-360': { art: 'handy', breite: 360, hoehe: 640 },
  'handy-390': { art: 'handy', breite: 390, hoehe: 844 },
  'tablet-hoch': { art: 'tablet', breite: 768, hoehe: 1024 },
  'tablet-quer': { art: 'tablet', breite: 1024, hoehe: 768 },
  'desktop-1440': { art: 'desktop', breite: 1440, hoehe: 900 },
  'monitor-1080-rand0': { art: 'monitor', breite: 1920, hoehe: 1080, rand: 'null' },
  'monitor-1080-standard': { art: 'monitor', breite: 1920, hoehe: 1080, rand: 'standard' },
  'monitor-720-rand0': { art: 'monitor', breite: 1280, hoehe: 720, rand: 'null' },
  'monitor-720-standard': { art: 'monitor', breite: 1280, hoehe: 720, rand: 'standard' },
  // TV-Sticks melden oft 960x540 CSS-px bei Pixeldichte 2 (Review B-19); am Geraet klaeren.
  'monitor-540-rand0': { art: 'monitor', breite: 960, hoehe: 540, dpr: 2, rand: 'null' },
  'monitor-540-standard': { art: 'monitor', breite: 960, hoehe: 540, dpr: 2, rand: 'standard' },
  'reflow-320': { art: 'reflow', breite: 320, hoehe: 640 },
}

export const GRUPPEN = {
  app: ['handy-360', 'handy-390', 'tablet-hoch', 'tablet-quer', 'desktop-1440'],
  handy: ['handy-360', 'handy-390'],
  tablet: ['tablet-hoch', 'tablet-quer'],
  desktop: ['desktop-1440'],
  monitor: ['monitor-1080-rand0', 'monitor-1080-standard', 'monitor-720-rand0', 'monitor-720-standard', 'monitor-540-rand0', 'monitor-540-standard'],
  reflow: ['reflow-320'],
}

// Volle Matrix je Zielart: nur dann darf der Bericht VOLLMATRIX tragen.
export const VOLLE_GRUPPEN = ['app', 'monitor']

const partner = (name) =>
  name.endsWith('-rand0') ? name.replace(/-rand0$/, '-standard') : name.endsWith('-standard') ? name.replace(/-standard$/, '-rand0') : null

export function loeseProfile(eingabe) {
  const namen = []
  for (const teil of String(eingabe).split(',').map((s) => s.trim()).filter(Boolean)) {
    if (GRUPPEN[teil]) namen.push(...GRUPPEN[teil])
    else if (PROFILE[teil]) namen.push(teil)
    else throw new Error(`Unbekanntes Profil "${teil}". Erlaubt: ${[...Object.keys(GRUPPEN), ...Object.keys(PROFILE)].join(', ')}`)
  }
  const ergaenzt = []
  for (const n of [...namen]) {
    const p = partner(n)
    if (p && !namen.includes(p)) { namen.push(p); ergaenzt.push(p) }
  }
  return { namen: [...new Set(namen)], ergaenzt }
}

export function istVolleGruppe(namen) {
  return VOLLE_GRUPPEN.some((g) => GRUPPEN[g].length === namen.length && GRUPPEN[g].every((n) => namen.includes(n)))
}

// Sehwinkel -> Anteil der Bildhoehe (Schriftgroesse / Bildhoehe).
export function sehwinkelAnteil({ abstandM, diagonaleZoll, versalAnteil }, winkelMin) {
  const bildhoeheM = (diagonaleZoll * 0.0254 * 9) / Math.sqrt(16 * 16 + 9 * 9)
  return (abstandM * Math.tan(((winkelMin / 60) * Math.PI) / 180)) / (bildhoeheM * versalAnteil)
}
