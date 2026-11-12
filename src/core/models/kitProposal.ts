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

/** Die Farbe passt für `seite`: nicht die eigene Trikotfarbe der Seite und dem Gegner nicht zu ähnlich (@SL-217). */
function passt(farbe: string, seite: KitSide, farben: TrikotFarben): boolean {
  return kitConflict(farbe, farben[seite]) !== 'same' && kitConflict(farbe, farben[andere(seite)]) === 'none';
}

export function kitProposal(farben: TrikotFarben, hallenFarben: readonly string[], regel: 'home' | 'away'): KitProposal {
  const reihe = hallenFarben.map((f) => normalizeKitColor(f)).filter((f): f is string => f !== undefined);
  const kandidaten = reihe.length > 0 ? reihe : [DEFAULT_BIB_COLOR];
  const zuerst: KitSide = regel === 'away' ? 'b' : 'a';
  for (const seite of [zuerst, andere(zuerst)]) {
    const farbe = kandidaten.find((f) => passt(f, seite, farben));
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
