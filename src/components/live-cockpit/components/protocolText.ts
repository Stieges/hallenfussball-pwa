/**
 * protocolText: reine Hilfen für den Text einer Protokollzeile im Handy-Blatt (@OB-021, @OB-025, VISUAL-DESIGN § 2).
 * Ein Wort eines Teamnamens steht nie auf zwei Zeilen: Wörter mit Bindestrich („Nordheim-Süd“) bleiben beisammen, Umbruch nur an
 * Leerzeichen (und nach „/“). Der Text selbst bleibt unverändert (Kopieren, Suchen, Bildschirmleser). Kleine Übergangslösung neben der Zeile:
 * der Baustein `TeamName` (PR #514) ersetzt sie.
 */
const WITH_HYPHEN = /\p{L}-\p{L}/u;
const NO_BREAK_SPACE = ' ';

export interface ProtocolTextPart {
  text: string;
  /** `true`: Wort mit Bindestrich, darf nicht umbrechen (nowrap). */
  keepTogether: boolean;
}

/** Zerlegt in Wörter und Leerräume; Bindestrich-Wörter sind `keepTogether`. */
export function splitProtocolText(text: string): ProtocolTextPart[] {
  return text.split(/(\s+)/).filter((part) => part !== '').map((part) => ({ text: part, keepTogether: WITH_HYPHEN.test(part) }));
}

/** Die Rückennummer am Ende („… SV Süd #5“) hängt mit geschütztem Leerzeichen am Namen und steht nie allein in einer Zeile. */
export function bindTrailingNumber(text: string): string {
  return text.replace(/ (#\d+)$/, `${NO_BREAK_SPACE}$1`);
}
