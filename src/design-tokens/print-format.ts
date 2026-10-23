/**
 * Druck-Tokens: Papierformate und Maßstab (B-28 C7, Fable B10d). A4 ist das einzige angebotene Format; A3 und A2 sind
 * vorbereitet (@BM-001: MVP+), damit der Maßstab an **einer** Stelle (`pageGeometry`) wirkt und kein Dokument ihn
 * nachbaut. A3 braucht für 6 mm Großbuchstaben einen Maßstab von etwa 1,9 statt 1,41 (Fable G11): die Werte sind Startwerte.
 */
export const printFormat = {
  a4: { portrait: { width: 210, height: 297 }, landscape: { width: 297, height: 210 }, scale: 1 },
  a3: { portrait: { width: 297, height: 420 }, landscape: { width: 420, height: 297 }, scale: 1.9 },
  a2: { portrait: { width: 420, height: 594 }, landscape: { width: 594, height: 420 }, scale: 2.7 },
} as const;
