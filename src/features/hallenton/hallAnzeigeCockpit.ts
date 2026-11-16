/**
 * hallAnzeigeCockpit (H4-18, @HT-059): die Anzeige für den Kopf des Cockpits. Eine Störung des gezeigten Felds, die der Kasten unter der Tafel
 * (@HT-039) TATSÄCHLICH zeigt, steht nicht zusätzlich als Pille im Kopf – nur dann; ohne Kasten bleibt die Pille. Rein, ohne Hooks.
 * - „nicht bereit“ und „keine Verbindung“ eines Felds mit Kasten entfallen; bei mehreren Feldern nur dieses Feld (der Sammeleintrag
 *   „Lautsprecher Feld 1, 2 nicht bereit“ wird zu „Lautsprecher Feld 2 nicht bereit“).
 * - „Ton nicht aktiv – hier klicken“ und „schlafen gelegt“ gelten dem eigenen Gerät: sie entfallen nur, wenn dieses Gerät Lautsprecher GENAU der
 *   Felder ist, deren Kasten gezeigt wird (ist es auch Lautsprecher eines anderen Felds, bleibt die Pille: der Kasten sagt nichts über das andere Feld).
 */
import type { FeldAnzeige, HallAnzeige } from './hallAnzeige';

export function hallAnzeigeOhneGezeigtenKasten(anzeige: HallAnzeige, kastenFelder: ReadonlySet<number>): HallAnzeige {
  if (kastenFelder.size === 0) {
    return anzeige;
  }
  const eigeneFelder = anzeige.felder.filter((f) => f.eigenesGeraet).map((f) => f.feld);
  const eigenesGeraetNurKasten = eigeneFelder.length > 0 && eigeneFelder.length === kastenFelder.size && eigeneFelder.every((f) => kastenFelder.has(f));
  const entfaellt = (f: FeldAnzeige): boolean => {
    if (!kastenFelder.has(f.feld)) {
      return false;
    }
    switch (f.anzeige.art) {
      case 'nichtBereit':
      case 'keineVerbindung':
        return true;
      case 'tonNichtAktiv':
      case 'schlafenGelegt':
        return eigenesGeraetNurKasten;
      default:
        return false;
    }
  };
  return { ...anzeige, felder: anzeige.felder.filter((f) => !entfaellt(f)) };
}
