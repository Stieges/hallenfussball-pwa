/**
 * Rechenkonstanten der Akzentfarbe (@DR-041, Rechenweg der Notiz „Turnierfarbe“ vom 30.10.2026, Schritte 1–8).
 * Reine Zahlen der Berechnung, keine Gestaltungswerte: Farbe, Kontrast und Grauwert des Drucks stehen in
 * `printAccent` (`design-tokens/print.ts`).
 */
export const accentRules = {
  /** Pixel unter dieser Deckkraft (Schatten, weiche Kanten) zählen nicht (Schritt 2). */
  minAlpha: 0.9,
  /** Pixel unter dieser Deckkraft zählen auch nicht zur sichtbaren Fläche (ganz durchsichtig). */
  visibleAlpha: 0.05,
  /** HSV-Sättigung darunter: Weiß, Grau, Schwarz (Schritt 2). */
  minSaturation: 0.25,
  /** HSV-Helligkeit darunter: Schwarz mit Farbstich (Schritt 2). */
  minValue: 0.2,
  /** Breite einer Farbtonklasse in Grad, 18 Klassen (Schritt 3). */
  classDegrees: 20,
  /** Eine Klasse zählt erst ab diesem Anteil der sichtbaren Pixel (Schritt 4). */
  minShare: 0.02,
  /** Kürzere Seite darunter: keine Berechnung, App-Grün (@DR-041 Beispiel „unter 64 Bildpunkten“). */
  minSidePx: 64,
  /** Gelbtöne: Farbton von … bis (ohne Obergrenze) in Grad; Gelbregel (@DR-041, Daniel 30.10.). */
  yellowFromDeg: 40,
  yellowToDeg: 80,
  /** Ein Gelbton gewinnt nur, wenn keine andere Klasse mindestens diesen Anteil seiner Wertung erreicht. */
  yellowRivalShare: 0.8,
  /** Abdunkeln: HSL-Helligkeit sinkt in Schritten von 0,5 Prozentpunkten (Schritt 7). */
  darkenStepPercent: 0.5,
  /** Zebra-Ton: Farbanteil der Mischung mit Weiß, Start und Schrittweite (Schritt 8). */
  zebraStartShare: 0.1,
  zebraStepShare: 0.005,
  /** Gewichte des Grauwerts (0,299 R + 0,587 G + 0,114 B). */
  grayWeights: { r: 0.299, g: 0.587, b: 0.114 },
} as const;
