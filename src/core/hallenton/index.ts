/**
 * Hallen-Lautsprecher, Kern-Logik (Paket Hallenton, H3-Kern): Schlüssel je Ende, Planer, Regel 3, Uhrsprung.
 * Rein, ohne React; den Einbau (Zeitgeber, Ton, Abfrage) macht H3b. Torhymne (@HT-024): `torhymne.ts` (H3c).
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
export {
  LEERES_TOR_GEDAECHTNIS, TORHYMNE_MAX_MS, naechsteHymne, planeTorhymne, wirksameTore,
  type LaufendeHymne, type TorEingabe, type TorErgebnis, type TorGedaechtnis, type WirksamesTor,
} from './torhymne';
export {
  TORHYMNE_MAX_BYTES, TORHYMNE_MIME_TYPEN, pruefeTorhymne, type TorhymneDatei, type TorhymnePruefung,
} from './torhymnePruefung';
export { UHRSPRUNG_SCHWELLE_MS, uhrsprungMs, type UhrProbe } from './uhrsprung';
