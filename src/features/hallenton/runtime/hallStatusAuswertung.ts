/**
 * Auswertung des Lautsprecher-Stands am Server (H3b-3, Datenseite für H4): aus `{ state, ageMs, outputHint }` je Feld – aus
 * `hall_sound_status` (volle oder schmale Sicht) oder der Antwort auf das Lebenszeichen der Leitung – die Lage für Verwaltung,
 * Kopfzeile und Cockpit. Nur Alter, die der Server rechnet: die Uhr des Geräts zählt nie (@HT-042). Rein, ohne Zustand.
 *
 * - kein Eintrag → `keiner` (Feld ohne Lautsprecher bleibt neutral, @HT-016, @HT-038)
 * - nie gemeldet oder letztes Lebenszeichen älter als 10 s → `meldetSichNicht` mit „zuletzt“ (Serverzeit, @HT-011, @HT-040).
 *   10 s: der Lautsprecher meldet alle 5 s; wer alle 5 s liest, sieht einen Ausfall so nach höchstens 15 s (Ableitung).
 * - `ready` → `bereit`; sonst `nichtBereit` mit Grund. `custom_sound_failed` ist „nicht bereit – eigener Ton nicht geladen“,
 *   aber ohne Cockpit-Hinweis, weil die Halle „Hupe 1“ hört (@HT-039).
 * - `pruefen`: Hinweis „🔈? Prüfen“ (@HT-047), bis jemand „Gehört“ wählt (@HT-049).
 * Cockpit (@HT-040, @HT-050): `aus` mit Grund, sonst `ausgangGeaendert` bei Hinweis, sonst `bereit`; `unbekannt`, wenn die
 * eigene letzte Antwort älter als 15 s ist (das leitende Gerät hat selbst kein Netz – kein alter Stand als aktuell).
 */
import type { HallSpeakerState } from '../../../core/repositories/hallentonRpc';
import type { LeitungStand } from './leitungLebenszeichen';

export const MELDET_SICH_NICHT_AB_MS = 10_000;
/** Eine eigene Antwort gilt so lange als aktueller Stand (lokale, monotone Zeit). */
export const ANTWORT_GUELTIG_MS = 15_000;

export interface LautsprecherAmServer {
  state: HallSpeakerState | null;
  ageMs: number | null;
  outputHint: boolean;
}

export type LautsprecherLage =
  | { art: 'keiner' }
  | { art: 'meldetSichNicht'; zuletztServerMs: number | null }
  | { art: 'bereit'; pruefen: boolean }
  | { art: 'nichtBereit'; grund: Exclude<HallSpeakerState, 'ready'>; pruefen: boolean };

export function lautsprecherLage(lautsprecher: LautsprecherAmServer | null, serverNow: number): LautsprecherLage {
  if (lautsprecher === null) {
    return { art: 'keiner' };
  }
  const { state, ageMs, outputHint } = lautsprecher;
  if (state === null || ageMs === null || ageMs > MELDET_SICH_NICHT_AB_MS) {
    return { art: 'meldetSichNicht', zuletztServerMs: ageMs === null ? null : serverNow - ageMs };
  }
  return state === 'ready' ? { art: 'bereit', pruefen: outputHint } : { art: 'nichtBereit', grund: state, pruefen: outputHint };
}

export type CockpitGrund = Exclude<HallSpeakerState, 'ready' | 'custom_sound_failed'> | 'meldetSichNicht';

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
      if (lage.grund !== 'custom_sound_failed') {
        return { art: 'aus', grund: lage.grund, zuletztServerMs: null };
      }
      return lage.pruefen ? { art: 'ausgangGeaendert' } : { art: 'bereit' };
    case 'bereit':
      return lage.pruefen ? { art: 'ausgangGeaendert' } : { art: 'bereit' };
  }
}

/** Cockpit-Hinweis aus der letzten Antwort auf das Lebenszeichen der Leitung; ohne (kein Spiel, nicht leitend) neutral. */
export function cockpitHinweisAusLeitung(stand: LeitungStand | null, jetzt: number): CockpitHinweis {
  if (stand === null || stand.status === 'not_controller') {
    return { art: 'keiner' };
  }
  if (jetzt - stand.empfangenUm > ANTWORT_GUELTIG_MS) {
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
