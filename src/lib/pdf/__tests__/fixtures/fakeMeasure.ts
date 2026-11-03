/**
 * Feste Messfunktion der Modelltests (PDF-Paket § 4.0, Review G7): 2,0 mm je Zeichen normal, 2,2 mm fett, unabhängig von
 * der Schriftgröße. Damit sind Umbruch und Geometrie von Hand nachrechenbar; je Modul prüft genau ein Abgleichtest mit
 * `jspdfMeasure` und der echten Schrift.
 */
import { fixedWidthMeasure } from '../../model/measure';

export const FAKE_MM_PER_CHAR = { normal: 2.0, bold: 2.2 } as const;

export const FAKE_MEASURE = fixedWidthMeasure(FAKE_MM_PER_CHAR);
