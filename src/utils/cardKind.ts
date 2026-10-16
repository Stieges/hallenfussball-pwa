/**
 * cardKindOf (C3b-2 F3b1 Fixrunde, Ruling PC30): Gelb-Rot ist Untertyp von Rot -- Ereignistyp
 * bleibt RED_CARD, `payload.cardType: 'YELLOW_RED'` unterscheidet. Jeder Leser, der den Untertyp
 * nicht kennt, faellt korrekt auf "Rot" zurueck statt in einen Default.
 *
 * Framework-frei (kein React). EINZIGE Stelle, die `payload.cardType === 'YELLOW_RED'` prueft --
 * alle Leser, die zwischen Gelb/Gelb-Rot/Rot unterscheiden muessen, nutzen diese Funktion statt
 * eigener verstreuter Abfragen (`calculateFairPlay`, `useFoulCounts`; PDF-Export konsumiert
 * `calculateFairPlay`s Ergebnis und damit `cardKindOf` indirekt).
 */

export type CardKind = 'YELLOW' | 'YELLOW_RED' | 'RED';

export interface CardKindEvent {
  type: string;
  payload?: {
    cardType?: string;
  };
}

export function cardKindOf(event: CardKindEvent): CardKind | null {
  if (event.type === 'YELLOW_CARD') {
    return 'YELLOW';
  }
  if (event.type === 'RED_CARD') {
    return event.payload?.cardType === 'YELLOW_RED' ? 'YELLOW_RED' : 'RED';
  }
  return null;
}
