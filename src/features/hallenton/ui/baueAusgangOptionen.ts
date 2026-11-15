/**
 * baueAusgangOptionen – die Wahlfelder der Liste „Ausgang“ (H4-11; @HT-053, @HT-054). Rein, ohne React: „Standard (Ausgang des Systems)“ zuerst
 * (ein Eintrag für die Wahl `null`, der `default`-Eintrag des Browsers entfällt), dann der gewählte Ausgang, auch wenn er fehlt („nicht
 * verbunden“, @HT-054), dann die übrigen in der Reihenfolge der Liste (virtuelle stehen am Ende, das hat `sortiereAusgaenge` schon getan).
 * Die Kennung eines Ausgangs bleibt in `id` (nur für den Klick); die Oberfläche gibt sie nie in ein Attribut. Die Schlüssel der Felder sind
 * Positionen, keine Namen.
 */
import type { AusgangEintrag, AusgangLage, GewaehlterAusgang } from '../../../core/hallenton';

export interface AusgangOption {
  /** Position in der Liste (neutrale Kennung für Schlüssel und Test-IDs). */
  index: number;
  /** Kennung für `waehle`; `null` = Standard. Nie in ein Attribut. */
  id: string | null;
  /** Name des Browsers; `null` bei „Standard“ (die Oberfläche setzt den Text). */
  name: string | null;
  gewaehlt: boolean;
  /** Der gewählte Ausgang ist nicht (mehr) angeschlossen. */
  fehlt: boolean;
  virtuell: boolean;
  bluetooth: boolean;
}

export function baueAusgangOptionen(liste: readonly AusgangEintrag[], gewaehlt: GewaehlterAusgang | null, zustand: AusgangLage): AusgangOption[] {
  const optionen: Omit<AusgangOption, 'index'>[] = [{ id: null, name: null, gewaehlt: gewaehlt === null, fehlt: false, virtuell: false, bluetooth: false }];
  const echte = liste.filter((e) => !e.standard);
  const gewaehltImmer = gewaehlt !== null && !echte.some((e) => e.id === gewaehlt.id);
  if (gewaehltImmer) {
    // Fehlt er in der gelesenen Liste (verloren), steht er trotzdem da – gewählt, „nicht verbunden“; unbestätigt: gewählt, ohne Urteil
    optionen.push({ id: gewaehlt.id, name: gewaehlt.name, gewaehlt: true, fehlt: zustand === 'lost', virtuell: false, bluetooth: false });
  }
  for (const e of echte) {
    optionen.push({ id: e.id, name: e.name, gewaehlt: gewaehlt?.id === e.id, fehlt: false, virtuell: e.virtuell, bluetooth: e.bluetooth });
  }
  return optionen.map((o, index) => ({ ...o, index }));
}
