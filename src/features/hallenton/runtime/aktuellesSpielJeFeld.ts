/**
 * Aktuelles Spiel je Feld für den Hallen-Lautsprecher (H3b-1, Grundlage für @HT-005/@HT-006/@HT-016).
 * Reihenfolge wie das Cockpit (`useFieldMatchSelection`), aber ohne Router, ohne Auswahl und ohne „geladen“:
 * 1. angepfiffen (laufend oder angehalten), das erste in der Spielfolge
 * 2. gehaltener Endstand, falls die Quelle ihn kennt (`gehaltenJeFeld`)
 * 3. erstes Spiel ohne Ergebnis (ein Torwert fehlt, und es ist nicht beendet)
 * Spielfolge wie `matchesOfFieldInPlayOrder` (Anstoßzeit, Slot, Spielnummer). Ohne Spiel `null`.
 */
import { matchesOfFieldInPlayOrder } from '../../tournament-management/utils/fieldMatchOrder';

export type FeldSpielStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export interface FeldSpiel {
  id: string;
  field: number;
  slot?: number;
  matchNumber: number;
  startTime?: Date;
  scoreA?: number;
  scoreB?: number;
  /** Status des Spiels laut Spielplan; fehlt = noch nicht angepfiffen. */
  status?: FeldSpielStatus;
}

/** Kennung eines Felds wie `LiveMatchMeta.fieldId`. */
export type FeldKennung = `field-${number}`;

export function feldKennung(feld: number): FeldKennung {
  return `field-${feld}`;
}

export interface AktuellesSpielOptionen {
  anzahlFelder: number;
  /** Feld → Spiel, dessen Endstand die Quelle gerade hält (Cockpit nach dem Abpfiff). */
  gehaltenJeFeld?: ReadonlyMap<string, string>;
}

const angepfiffen = (spiel: FeldSpiel): boolean => spiel.status === 'RUNNING' || spiel.status === 'PAUSED';
const ohneErgebnis = (spiel: FeldSpiel): boolean =>
  spiel.status !== 'FINISHED' && (spiel.scoreA === undefined || spiel.scoreB === undefined);

/** Je Feld 1 … `anzahlFelder` das aktuelle Spiel; Felder ohne passendes Spiel ergeben `null`. */
export function aktuellesSpielJeFeld<T extends FeldSpiel>(spiele: readonly T[], optionen: AktuellesSpielOptionen): Map<FeldKennung, T | null> {
  const ergebnis = new Map<FeldKennung, T | null>();
  for (let feld = 1; feld <= optionen.anzahlFelder; feld += 1) {
    const kennung = feldKennung(feld);
    const imFeld = matchesOfFieldInPlayOrder(spiele, feld);
    const gehaltenId = optionen.gehaltenJeFeld?.get(kennung);
    const aktuell = imFeld.find(angepfiffen)
      ?? (gehaltenId !== undefined ? imFeld.find((s) => s.id === gehaltenId) : undefined)
      ?? imFeld.find(ohneErgebnis);
    ergebnis.set(kennung, aktuell ?? null);
  }
  return ergebnis;
}
