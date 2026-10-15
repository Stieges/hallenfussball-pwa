/**
 * Druck-Tokens für den Aushang A4 hoch mit Zuschauer-QR (B-28 C7, @BM-006/@BM-007, @DR-010). Maße in mm, Schrift in pt.
 * Startwerte aus dem Druckentwurf v5 (`.notice`), bis zum Layout-Review.
 */
export const printNotice = {
  /** Turniername: volle Schrift, darunter schrittweise kleiner, nie gekürzt, höchstens zwei Zeilen (@BM-007). */
  titlePt: 40,
  titleMinPt: 18,
  titleStepPt: 2,
  titleMaxLines: 2,
  /** Zeilenabstand des Titels als Vielfaches der Schrift. */
  titleLineEm: 1.1,
  /** Abstand der Grafikzeile zum Titel und zwischen den Blöcken darunter. */
  blockGap: 4,
  /** QR (@BM-007): Kante des Symbols ohne Ruhezone, mindestens 120 mm, mit Reserve für die Rundung. */
  qrEdge: 121,
  /** Kurzadresse zum Abtippen: kleine Beschriftung und Adresse darunter. */
  addressLabelPt: 12,
  addressPt: 16,
  addressMinPt: 12,
  addressGap: 4,
  /** Aufruf (@DR-010) und Schritte der Anleitung. */
  callPt: 22,
  stepPt: 16,
  /** Zeilenabstand von Aufruf und Schritten als Vielfaches der Schrift. */
  lineEm: 1.25,
  /** Abstand zwischen Aufruf und Schritten, zwischen den Schritten. */
  callGap: 3,
  stepGap: 1,
} as const;
