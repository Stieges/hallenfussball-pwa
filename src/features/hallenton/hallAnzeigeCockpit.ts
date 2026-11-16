/**
 * hallAnzeigeCockpit (H4-18, @HT-059): die Anzeige für den Kopf des Cockpits. Eine Störung des gezeigten Felds, die der Kasten unter der Tafel
 * (@HT-039) TATSÄCHLICH zeigt, steht nicht zusätzlich als Pille im Kopf – nur dann; ohne Kasten bleibt die Pille. Rein, ohne Hooks.
 * - „nicht bereit“ und „keine Verbindung“ eines Felds mit Kasten entfallen; bei mehreren Feldern nur dieses Feld (der Sammeleintrag
 *   „Lautsprecher Feld 1, 2 nicht bereit“ wird zu „Lautsprecher Feld 2 nicht bereit“).
 * - „Ton nicht aktiv – hier klicken“ und „schlafen gelegt“ gelten dem eigenen Gerät: sie entfallen nur, wenn dieses Gerät Lautsprecher GENAU der
 *   Felder ist, deren Kasten gezeigt wird UND die Taste „Ton aktivieren“ trägt (ist es auch Lautsprecher eines anderen Felds oder trägt der Kasten keine Taste, bleibt die Pille).
 */
import type { FeldAnzeige, HallAnzeige } from './hallAnzeige';
import type { GezeigteKaesten } from './ui/CockpitKastenOrt';

export function hallAnzeigeOhneGezeigtenKasten(anzeige: HallAnzeige, kaesten: GezeigteKaesten): HallAnzeige {
  const kastenFelder = kaesten.felder;
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
        // der Kasten trägt die Taste nur bei „Ton nicht aktiviert“: ohne sie bliebe im Cockpit nichts zum Beheben (G1, @HT-059)
        return eigenesGeraetNurKasten && kaesten.mitTonTaste.has(f.feld);
      default:
        return false;
    }
  };
  return { ...anzeige, felder: anzeige.felder.filter((f) => !entfaellt(f)) };
}
