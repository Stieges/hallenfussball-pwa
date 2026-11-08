/**
 * Hallen-Lautsprecher, Kern-Logik (Paket Hallenton, H3-Kern): Schlüssel je Ende, Planer, Regel 3, Uhrsprung.
 * Rein, ohne React; den Einbau (Zeitgeber, Ton, Abfrage) macht H3b.
 */
export type {
  FeldStand,
  GeplanterTon,
  HallTonArt,
  HallTonWarnung,
  PlanEingabe,
  PlanErgebnis,
  TonGedaechtnis,
} from './types';
export { endeSchluessel, feldEndeOf, type EndeKennung, type FeldEnde } from './enden';
export {
  ANTWORT_MAX_ALTER_MS,
  ENGE_ABFRAGE_AB_MS,
  ENGE_ABFRAGE_TAKT_MS,
  LEERES_GEDAECHTNIS,
  NACHHOLEN_MAX_MS,
  ZUSAMMEN_MS,
  hallTonGespielt,
  planeHallToene,
} from './planer';
export { cockpitTonSchweigt } from './regeln';
export { UHRSPRUNG_SCHWELLE_MS, uhrsprungMs, type UhrProbe } from './uhrsprung';
