/**
 * Druck-Tokens für den Kopf von Seite 1 (B-28 C4): zwei Grafiken, Titelband, Zuschauer-QR. Ergänzt `print.ts`
 * (dort stehen die übrigen Kopfmaße). Alle Maße in mm bzw. pt.
 *
 * Geometrie (Entscheidung Daniel 15.10.): oben Grafik links · Titel mittig über die Restbreite · Grafik rechts,
 * darunter die Angabentabelle links und der QR rechts.
 */
export const printHeader = {
  /** Grafiken (@DR-023): höchstens 20 mm hoch; die Breite ist begrenzt, damit dem Titel Platz bleibt. */
  logoMaxHeight: 20,
  logoMaxWidth: 40,
  /** Abstand zwischen einer Grafik und dem Titel. */
  logoGap: 4,
  /** Größengrenze der Bilddaten einer Grafik in Byte (2 MB): größere Dateien gelten als unbrauchbar (@DR-024). */
  logoMaxBytes: 2_097_152,
  /** Titel: höchstens drei Zeilen (@BM-021). Passt er bei voller Schrift nicht, wird die Schrift in Schritten kleiner. */
  titleMaxLines: 3,
  titleMinPt: 18,
  titleStepPt: 2,
  /** Zuschauer-QR (@DR-003): Kante des Symbols (ohne Ruhezone), mindestens 30 mm, mit Reserve für die Rundung. */
  qrEdge: 31,
  /** Folgeseiten (@DR-003): mindestens 20 mm, mit Reserve für die Rundung. */
  qrEdgeShort: 21,
  /** Ruhezone um das Symbol in Modulen (Norm: 4). */
  qrQuietModules: 4,
  /** Beschriftung unter dem QR (@DR-010): Schriftgröße und Abstand zur Ruhezone. */
  qrCaptionPt: 8.5,
  qrCaptionGap: 1,
  qrCaptionAdvance: 3.6,
  /** Abstand der Angaben-/QR-Zeile unter dem Titelband (Grafiken). */
  bandGap: 2,
  /** Abstand zwischen Angabentabelle und QR-Spalte. */
  qrColumnGap: 6,
} as const;
