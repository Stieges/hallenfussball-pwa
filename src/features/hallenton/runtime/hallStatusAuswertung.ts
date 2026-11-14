/**
 * Auswertung des Lautsprecher-Stands am Server (H3b-3, Datenseite für H4): aus `{ state, ageMs, outputHint }` je Feld – aus
 * `hall_sound_status` (volle oder schmale Sicht) oder der Antwort auf das Lebenszeichen der Leitung – die Lage für Verwaltung,
 * Kopfzeile und Cockpit. Nur Alter, die der Server rechnet: die Uhr des Geräts zählt nie (@HT-042). Rein, ohne Zustand.
 *
 * - kein Eintrag → `keiner` (Feld ohne Lautsprecher bleibt neutral, @HT-016, @HT-038)
 * - nie gemeldet oder letztes Lebenszeichen älter als 10 s → `meldetSichNicht` mit „zuletzt“ (Serverzeit, @HT-011, @HT-040).
 *   10 s: der Lautsprecher meldet alle 5 s; wer alle 5 s liest, sieht einen Ausfall so nach höchstens 15 s (Ableitung).
 * - `ready` → `bereit`; sonst `nichtBereit` mit Grund. `custom_sound_failed` ist BEREIT mit dem ruhigen Hinweis „Hupe 1 statt eigener
 *   Ton“ (`eigenerTonFehlt`): die Halle hört „Hupe 1“ (Record 07.11., @HT-028; vorher „nicht bereit – eigener Ton nicht geladen“).
 *   Ein Zustand, den dieser App-Stand nicht kennt
 *   (`zustandUnbekannt`, tolerant gelesen in `hallentonRpc.ts`): nicht bereit ohne Wortgrund – nicht „Status unbekannt“, das bleibt
 *   dem Netzausfall der Verwaltung vorbehalten (@HT-041).
 * - `pruefen`: Hinweis „🔈? Prüfen“ (@HT-047), bis jemand „Gehört“ wählt (@HT-049).
 * Cockpit (@HT-040, @HT-050): `aus` mit Grund, sonst `ausgangGeaendert` bei Hinweis, sonst `bereit`; `unbekannt`, wenn die
 * eigene letzte Antwort älter als 15 s ist (das leitende Gerät hat selbst kein Netz – kein alter Stand als aktuell).
 */
import type { HallSpeakerStateGelesen } from '../../../core/repositories/hallentonRpc';
import type { LeitungStand } from './leitungLebenszeichen';

export const MELDET_SICH_NICHT_AB_MS = 10_000;
/** Eine eigene Antwort gilt so lange als aktueller Stand (lokale, monotone Zeit). */
export const ANTWORT_GUELTIG_MS = 15_000;

export interface LautsprecherAmServer {
  state: HallSpeakerStateGelesen | null;
  ageMs: number | null;
  outputHint: boolean;
}

export type LautsprecherLage =
  | { art: 'keiner' }
  | { art: 'meldetSichNicht'; zuletztServerMs: number | null }
  | { art: 'bereit'; pruefen: boolean; eigenerTonFehlt?: true }
  | { art: 'nichtBereit'; grund: Exclude<HallSpeakerStateGelesen, 'ready' | 'custom_sound_failed'>; pruefen: boolean };

export function lautsprecherLage(lautsprecher: LautsprecherAmServer | null, serverNow: number): LautsprecherLage {
  if (lautsprecher === null) {
    return { art: 'keiner' };
  }
  const { state, ageMs, outputHint } = lautsprecher;
  if (state === null || ageMs === null || ageMs > MELDET_SICH_NICHT_AB_MS) {
    return { art: 'meldetSichNicht', zuletztServerMs: ageMs === null ? null : serverNow - ageMs };
  }
  if (state === 'ready') {
    return { art: 'bereit', pruefen: outputHint };
  }
  // @HT-028 (Record 07.11.): „eigener Ton nicht geladen“ ist bereit mit ruhigem Hinweis, die Halle hört „Hupe 1“
  return state === 'custom_sound_failed'
    ? { art: 'bereit', pruefen: outputHint, eigenerTonFehlt: true }
    : { art: 'nichtBereit', grund: state, pruefen: outputHint };
}

/** `zustandUnbekannt`: ein Zustand, den dieser App-Stand nicht kennt – nicht bereit, aber ohne Wortgrund (nur die Pille, @HT-039). */
export type CockpitGrund = Exclude<HallSpeakerStateGelesen, 'ready' | 'custom_sound_failed'> | 'meldetSichNicht';

/**
 * `aus` mit `grund: 'zustandUnbekannt'` = nur die Pille, kein Wortgrund; `art: 'unbekannt'` = das leitende Gerät hat selbst
 * kein Netz (@HT-041). Beides nie verwechseln.
 */
export type CockpitHinweis =
  | { art: 'keiner' }
  | { art: 'unbekannt' }
  | { art: 'aus'; grund: CockpitGrund; zuletztServerMs: number | null }
  | { art: 'ausgangGeaendert' }
  | { art: 'bereit' };

export function cockpitHinweisAus(lage: LautsprecherLage): CockpitHinweis {
  switch (lage.art) {
    case 'keiner':
      return { art: 'keiner' };
    case 'meldetSichNicht':
      return { art: 'aus', grund: 'meldetSichNicht', zuletztServerMs: lage.zuletztServerMs };
    case 'nichtBereit':
      return { art: 'aus', grund: lage.grund, zuletztServerMs: null };
    case 'bereit':
      return lage.pruefen ? { art: 'ausgangGeaendert' } : { art: 'bereit' };
  }
}

/** Cockpit-Hinweis aus der letzten Antwort auf das Lebenszeichen der Leitung; ohne (kein Spiel, nicht leitend) neutral. */
export function cockpitHinweisAusLeitung(stand: LeitungStand | null, jetzt: number, versuchGescheitert = false): CockpitHinweis {
  if (stand === null || stand.status === 'not_controller') {
    return { art: 'keiner' };
  }
  // Feld ohne eingerichteten Lautsprecher bleibt neutral – auch ohne Netz (@HT-016, @HT-038)
  if (stand.speaker === null) {
    return { art: 'keiner' };
  }
  // H4-12: der letzte Versuch scheiterte am Netz → sofort „kein Netz“, ohne die 15 s abzuwarten (@HT-034, @HT-035)
  if (versuchGescheitert || jetzt - stand.empfangenUm > ANTWORT_GUELTIG_MS) {
    return { art: 'unbekannt' };
  }
  return cockpitHinweisAus(lautsprecherLage(stand.speaker, stand.serverNow));
}

/** „Feld 1: Handy ohne Netz“ (@HT-035): nur, solange auf dem Feld ein Spiel angepfiffen ist; Alter vom Server. */
export function leitungOhneNetz(leitungAlterMs: number | null, angepfiffen: boolean): boolean {
  return angepfiffen && (leitungAlterMs === null || leitungAlterMs > MELDET_SICH_NICHT_AB_MS);
}

/** `field-N` → N; sonst `null`. */
export function feldNummer(feldId: string | null | undefined): number | null {
  const treffer = /^field-(\d+)$/.exec(feldId ?? '');
  return treffer ? Number(treffer[1]) : null;
}
