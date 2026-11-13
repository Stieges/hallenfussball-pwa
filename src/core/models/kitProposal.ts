/**
 * Vorschlag der Leibchen-Karte (@SL-207, @SL-217, @SL-151, @SL-206): reine Regel ohne React.
 *
 * - Die Seite nennt die Regel des Turniers (`home` = erstgenannte, `away` = Gast); die Farbe ist die erste Hallenfarbe; ohne eingetragene Farben Gelb.
 * - Eine Farbe passt nicht, wenn die ziehende Seite selbst in dieser Farbe spielt oder sie dem Gegner zu ähnlich ist (ΔE2000 < 30, @SL-151).
 * - Passt für die Regel-Seite keine der Farben, aber für die andere, schlägt die Karte die andere Seite vor (@SL-217); erst wenn für keine Seite eine
 *   Farbe passt: „Kein passendes Leibchen vorhanden“, die Seite nach der Regel ist vorgewählt.
 * - `karteNoetig`: die Karte erscheint nur bei gleicher oder sehr ähnlicher Trikotfarbe (@SL-137, @SL-139); ohne Farbe einer Seite nie (@SL-138).
 */
import { DEFAULT_BIB_COLOR, kitConflict, normalizeKitColor, type KitSide } from './kit';
import { leibchenAuswahl, type TrikotFarben } from './kitChoice';

export type KitProposal =
  | { kind: 'vorschlag'; seite: KitSide; farbe: string }
  | { kind: 'keinPassendes'; seite: KitSide };

const andere = (seite: KitSide): KitSide => (seite === 'a' ? 'b' : 'a');

/** Die Karte ist nötig: beide Trikotfarben bekannt und gleich oder sehr ähnlich. */
export function karteNoetig(farben: TrikotFarben): boolean {
  return kitConflict(farben.a, farben.b) !== 'none';
}

/**
 * Schalter: schließt der Vorschlag auch eine dem EIGENEN Trikot nur ÄHNLICHE Hallenfarbe aus? Vorgabe `false` – so verlangt es der Record: @SL-207 und @SL-217
 * schließen für die ziehende Seite nur die GLEICHE eigene Trikotfarbe aus („spielt selbst in dieser Farbe“); eine ähnliche Farbe deckt @SL-231 (Warnung „sieht aus
 * wie das eigene Trikot“ bei der Wahl, Bestätigen bleibt erlaubt). `true` schlösse auch Ähnliches aus; dann kann der Vorschlag der ANDEREN Seite (@SL-217) nie
 * vorkommen, denn dafür muss die Farbe dem Trikot dieser Seite ähneln.
 */
export const AEHNLICHES_EIGENES_TRIKOT_AUSSCHLIESSEN = false;

export interface KitProposalOptions {
  aehnlichesEigenesAusschliessen?: boolean;
}

/** Die Farbe passt für `seite`: nicht die eigene Trikotfarbe der Seite (je nach Schalter auch keine ähnliche) und dem Gegner nicht zu ähnlich. */
function passt(farbe: string, seite: KitSide, farben: TrikotFarben, eigenStreng: boolean): boolean {
  const eigen = kitConflict(farbe, farben[seite]);
  return (eigenStreng ? eigen === 'none' : eigen !== 'same') && kitConflict(farbe, farben[andere(seite)]) === 'none';
}

export function kitProposal(farben: TrikotFarben, hallenFarben: readonly string[], regel: 'home' | 'away', optionen: KitProposalOptions = {}): KitProposal {
  const eigenStreng = optionen.aehnlichesEigenesAusschliessen ?? AEHNLICHES_EIGENES_TRIKOT_AUSSCHLIESSEN;
  const reihe = hallenFarben.map((f) => normalizeKitColor(f)).filter((f): f is string => f !== undefined);
  const kandidaten = reihe.length > 0 ? reihe : [DEFAULT_BIB_COLOR];
  const zuerst: KitSide = regel === 'away' ? 'b' : 'a';
  for (const seite of [zuerst, andere(zuerst)]) {
    const farbe = kandidaten.find((f) => passt(f, seite, farben, eigenStreng));
    if (farbe !== undefined) {
      return { kind: 'vorschlag', seite, farbe };
    }
  }
  return { kind: 'keinPassendes', seite: zuerst };
}

/** Farben der Wahl „Andere Farbe …“: Hallenfarben zuerst, darunter die Grundauswahl (@SL-219). */
export const wahlFarben = (hallenFarben: readonly string[]): { halle: string[]; weitere: string[] } => {
  const { halle, weitere } = leibchenAuswahl(hallenFarben);
  return { halle, weitere };
};
