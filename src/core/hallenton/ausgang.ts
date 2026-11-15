/**
 * Audio-Ausgang des Hallen-Lautsprechers, reine Hilfen (H4-6, @HT-053, @HT-054, @HT-055): Sortierung der Liste, „virtuell“ ans
 * Ende, Bluetooth-Hinweis und die Bewertung der gewählten Wahl. Ohne Browser; das Lesen der Liste, das Speichern der Wahl und
 * `setSinkId` stehen in `features/hallenton/runtime/ausgang/`.
 *
 * Bewertung (`bewerteAusgang`, Plan H4, G2):
 * - keine Wahl = „Standard“ (Ausgang des Systems): nie verloren, nie unbestätigt.
 * - Wahl gespeichert, aber die Kennungen der Ausgänge sind nicht lesbar (Mikrofon nicht erlaubt, z. B. „Nur dieses Mal“ nach
 *   dem Neuladen, oder leere Kennungen): `unconfirmed` – nie still „Standard“, nie fälschlich `lost`.
 * - Kennungen lesbar und der gewählte Ausgang fehlt: `lost` (Dock abgezogen) – nie ein stiller Wechsel auf einen anderen.
 * - gewählter Ausgang vorhanden, aber `setSinkId` mit der Kennung scheitert: `unconfirmed`.
 */

/** Kennung des Systemstandards in der Liste des Browsers. */
export const STANDARD_AUSGANG_ID = 'default';

/** Ein Ausgang, wie ihn `enumerateDevices` liefert (nur `audiooutput`). */
export interface AusgangRoh {
  /** Leer, solange der Browser keine Kennungen herausgibt (Mikrofon nicht erlaubt). */
  id: string;
  /** Leer ohne Mikrofon-Freigabe. */
  name: string;
  gruppe: string;
}

export interface AusgangEintrag extends AusgangRoh {
  /** Der Systemstandard (`default`) – in der Oberfläche „Standard (Ausgang des Systems)“. */
  standard: boolean;
  /** Konferenz-Programme und Ähnliches (Name enthält „(Virtual)“): stehen am Ende der Liste (@HT-053). */
  virtuell: boolean;
  /** Bluetooth: Verzögerung unzuverlässig, Hinweis „Kabel statt Bluetooth“ (V-AUSGANG Teil 2). */
  bluetooth: boolean;
}

/** Die Wahl dieses Geräts (lokal, nie am Server): Kennung, Name, Gruppen-ID. */
export interface GewaehlterAusgang {
  id: string;
  name: string;
  gruppe: string;
}

export type AusgangLage = 'standard' | 'ok' | 'lost' | 'unconfirmed';

/** `null`: der Browser kann die Erlaubnis nicht abfragen (Rückschluss dann nur aus den Kennungen). */
export type MikrofonErlaubnis = 'granted' | 'denied' | 'prompt' | null;

export function istVirtuell(name: string): boolean {
  return /\(virtual\)/i.test(name);
}

export function istBluetooth(name: string): boolean {
  return /bluetooth/i.test(name);
}

/** Nur Ausgänge mit Kennung; „Standard“ zuerst, virtuelle am Ende, sonst die Reihenfolge des Browsers. */
export function sortiereAusgaenge(roh: readonly AusgangRoh[]): AusgangEintrag[] {
  const eintraege = roh
    .filter((a) => a.id !== '')
    .map((a): AusgangEintrag => ({
      ...a, standard: a.id === STANDARD_AUSGANG_ID, virtuell: istVirtuell(a.name), bluetooth: istBluetooth(a.name),
    }));
  const rang = (e: AusgangEintrag): number => (e.standard ? 0 : e.virtuell ? 2 : 1);
  return eintraege
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rang(a.e) - rang(b.e) || a.i - b.i)
    .map(({ e }) => e);
}

export interface AusgangBewertung {
  wahl: GewaehlterAusgang | null;
  /** Alle Ausgänge mit Kennung (leer, wenn der Browser keine herausgibt). */
  eintraege: readonly AusgangRoh[];
  erlaubnis: MikrofonErlaubnis;
  /** `setSinkId` mit der gewählten Kennung ist gescheitert. */
  senkeScheitert: boolean;
  /**
   * In dieser Sitzung wurde die gewählte Kennung erfolgreich gesetzt (`setSinkId`): dann gilt der Ausgang, bis er nachweislich fehlt
   * (Kennungen lesbar und er nicht dabei) – ein Wegfall der Mikrofon-Freigabe mitten im Betrieb macht ihn nicht unbestätigt (@HT-054
   * Zeile 5). Nach dem Neuladen ist das `false` (@HT-055).
   */
  inSitzungGesetzt?: boolean;
  /**
   * Der Wechsel auf „Standard“ (`setSinkId('')`) ist gescheitert oder in die Zeitgrenze gelaufen (H4-11): die Ausgabe steht vielleicht noch auf dem alten Ausgang,
   * also `unconfirmed` – derselbe Weg wie sonst: „Ausgang bestätigen“ (ein Tipp versucht es erneut), nie ein Ton über einen unklaren Ausgang.
   */
  standardScheitert?: boolean;
}

export function bewerteAusgang({ wahl, eintraege, erlaubnis, senkeScheitert, inSitzungGesetzt = false, standardScheitert = false }: AusgangBewertung): AusgangLage {
  if (wahl === null || wahl.id === STANDARD_AUSGANG_ID) {
    return standardScheitert ? 'unconfirmed' : 'standard';
  }
  if (inSitzungGesetzt && !senkeScheitert) {
    const sichtbar = eintraege.filter((e) => e.id !== '');
    return sichtbar.length > 0 && !sichtbar.some((e) => e.id === wahl.id) ? 'lost' : 'ok'; // nicht lesbar ≠ verschwunden
  }
  if (erlaubnis !== null && erlaubnis !== 'granted') {
    return 'unconfirmed';
  }
  const lesbar = eintraege.filter((e) => e.id !== '');
  if (lesbar.length === 0) {
    return 'unconfirmed';
  }
  if (!lesbar.some((e) => e.id === wahl.id)) {
    return 'lost';
  }
  return senkeScheitert ? 'unconfirmed' : 'ok';
}
