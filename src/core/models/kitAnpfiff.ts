/**
 * Das `kit` des Anpfiffs (@SL-210, @SL-149, @SL-202): reine Regel ohne React.
 *
 * Der Anpfiff belegt nichts vor. Er trägt, was Tom vorher getippt hat – und sonst nur die Trikotfarben:
 * - bestätigt (`kitDecision` `bib`, Leibchen-Seite und -Farbe im Spiel): Leibchenfarbe auf der Leibchen-Seite, Trikot auf der anderen, Seite genannt;
 * - „Keine Leibchen“ (`none`): ausdrücklich `bibSide: null`;
 * - offen (nichts getippt): kein Schlüssel `bibSide` – der Server lässt die Wahl, wie sie war (NULL), keine Leibchen (@SL-210).
 * Eine ausdrückliche Wahl der alten Anpfiff-Ansicht (`wahl`) gilt bis zur Karte (Schritt 2b-2) weiter.
 */
import { compactKit, normalizeKitColor, type KitSide, type StartKit } from './kit';
import { kitAusWahl, trikotFarben, type LeibchenWahl, type TrikotFarben } from './kitChoice';
import type { Match, Team } from '../../types/tournament';

type AnpfiffSpiel = Pick<Match, 'slotA' | 'slotB' | 'kit' | 'kitDecision'>;

function bestaetigt(spiel: AnpfiffSpiel, farben: TrikotFarben): StartKit | null {
  const seite: KitSide | undefined = spiel.kit?.bibSide;
  const farbe = seite === undefined ? undefined : normalizeKitColor(spiel.kit?.[seite]);
  if (spiel.kitDecision !== 'bib' || seite === undefined || farbe === undefined) {
    return null;
  }
  return compactKit({ a: seite === 'a' ? farbe : farben.a, b: seite === 'b' ? farbe : farben.b, bibSide: seite });
}

export function kitBeimAnpfiff(spiel: AnpfiffSpiel, teams: readonly Pick<Team, 'id' | 'colors'>[], wahl: LeibchenWahl | undefined): StartKit {
  const farben = trikotFarben(spiel, teams);
  if (wahl !== undefined) {
    return kitAusWahl(farben, wahl);
  }
  const gewaehlt = bestaetigt(spiel, farben);
  if (gewaehlt !== null) {
    return gewaehlt;
  }
  return spiel.kitDecision === 'none' ? compactKit({ a: farben.a, b: farben.b, bibSide: null }) : compactKit({ a: farben.a, b: farben.b });
}
