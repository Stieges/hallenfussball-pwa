/**
 * Druck-Tokens für den Aushang A4 hoch mit Zuschauer-QR (B-28 C7/C8, @BM-006/@BM-007, @DR-010). Maße in mm, Schrift in pt.
 * Startwerte aus dem Druckentwurf v5 (`.notice`), bis zum Layout-Review. Reihenfolge seit 16.10. (G54): Grafiken, Titel,
 * Aufruf, QR, Schritte, „Oder im Browser eintippen:“ mit Adresse.
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
  /** Adresse zum Abtippen (@DR-010, G55): kleine Beschriftung, darunter die Adresse in mindestens 20 pt (2 m Leseabstand), nie kleiner. */
  addressLabelPt: 12,
  addressPt: 20,
  /** Aufruf (@DR-010) und Schritte der Anleitung. */
  callPt: 22,
  stepPt: 16,
  /** Zeilenabstand von Aufruf und Schritten als Vielfaches der Schrift. */
  lineEm: 1.25,
  /** Abstand zwischen Titel und Aufruf (G54: der Aufruf steht direkt unter dem Titel) und zwischen den Schritten. */
  callGap: 3,
  stepGap: 1,
  /** Abstand zwischen den Schritten und „Oder im Browser eintippen:“. */
  stepsToAddress: 4,
} as const;
