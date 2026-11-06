/**
 * Leibchen-Wahl in der Anpfiff-Ansicht (@SL-137, @SL-138, @SL-148, @SL-149, @SL-151, @SL-173): reine Regeln ohne React.
 *
 * - `kitHinweis`: Hinweis auf gleiche bzw. zu ähnliche Trikotfarben (ΔE2000 und Helligkeit, `kitConflictWithLuminance`).
 * - `ersteLeibchenWahl`: Vorbelegung – bei Konflikt die Heimseite mit der Leibchenfarbe des Turniers, sonst kein Leibchen; ist sie dem Gegner
 *   zu ähnlich (@SL-151), die erste wählbare Farbe ohne Konflikt (`leibchenFarbeFuer`).
 * - `leibchenGegenGegner`: @SL-151 – die Leibchenfarbe ist der Trikotfarbe des Gegners zu ähnlich.
 * - `kitAusWahl`: das `kit`, das beim Anpfiff mitgeht; die Wahl gilt nur für dieses Spiel.
 * - `vorschauKaesten`: Kästen und Team-Köpfe vor dem Anpfiff in den echten Trikotfarben, ohne Ausweichfarbe der Zuschauer-Kästen, Leibchen als Zeichen (@SL-196).
 */
import { palette } from '../../design-tokens/colors/palette';
import { DEFAULT_BIB_COLOR, kitConflictWithLuminance, normalizeKitColor, type KitConflict, type KitSide, type MatchKit, compactKit } from './kit';
import type { BoxFill, SideBox } from './scoreBoxColors';
import type { Match, Team } from '../../types/tournament';
import { slotTeamId } from './matchSlot';

/** Wahl vor dem Anpfiff: `bibSide` = Seite mit Leibchen (`null` = ohne Leibchen), `bibColor` = Farbe der Leibchen. */
export interface LeibchenWahl {
  bibSide: KitSide | null;
  bibColor: string;
}

/** Trikotfarben beider Seiten (`a` = Heim, `b` = Gast), normalisiert oder `undefined` („keine Farbe“). */
export interface TrikotFarben {
  a?: string;
  b?: string;
}

/** Wählbare Leibchenfarben (Daten, keine Gestaltung): die Vorgabe Gelb, dazu übliche Leibchen der Hallen; Name für Text und Vorlesen. */
const WAHL: ReadonlyArray<readonly [LeibchenFarbName, string]> = [
  ['gelb', DEFAULT_BIB_COLOR], ['orange', palette.orange[500]], ['gruen', palette.green[500]],
  ['blau', palette.kit.blue], ['rot', palette.kit.red], ['weiss', palette.neutral[0]],
];
export type LeibchenFarbName = 'gelb' | 'orange' | 'gruen' | 'blau' | 'rot' | 'weiss';
export const LEIBCHEN_FARBEN: readonly string[] = WAHL.map(([, farbe]) => normalizeKitColor(farbe) ?? DEFAULT_BIB_COLOR);

/** Name einer wählbaren Leibchenfarbe; eine eigene Farbe des Turniers hat keinen (`null`). */
export function leibchenFarbName(farbe: string): LeibchenFarbName | null {
  const hex = normalizeKitColor(farbe);
  const index = LEIBCHEN_FARBEN.findIndex((kandidat) => kandidat === hex);
  return index < 0 ? null : WAHL[index][0];
}

/** Farbe der Leibchen des Turniers zuerst, danach die übrigen wählbaren Farben (ohne Doppel). */
export function leibchenFarbenMit(turnierFarbe: string): string[] {
  const erste = normalizeKitColor(turnierFarbe) ?? DEFAULT_BIB_COLOR;
  return [erste, ...LEIBCHEN_FARBEN.filter((farbe) => farbe !== erste)];
}

/** @SL-137/@SL-139/@SL-173: gleiche oder zu ähnliche Trikotfarben; ohne Farbe einer Seite kein Hinweis. */
export function kitHinweis(farben: TrikotFarben): KitConflict {
  return kitConflictWithLuminance(farben.a, farben.b);
}

/** @SL-137/@SL-138: bei Konflikt die Heimseite mit Leibchen vorbelegt, sonst ohne Leibchen. */
const andere = (seite: KitSide): KitSide => (seite === 'a' ? 'b' : 'a');

/** @SL-151: Leibchenfarbe gegen die Trikotfarbe des Gegners der Seite `seite` (ΔE2000 < 30 oder Helligkeit < 1,5 : 1). */
export function leibchenFarbeZuAehnlich(farben: TrikotFarben, seite: KitSide, farbe: string): boolean {
  return kitConflictWithLuminance(farbe, farben[andere(seite)]) !== 'none';
}

/**
 * @SL-137/@SL-151: Leibchenfarbe für `seite` – die des Turniers, wenn sie dem Gegner nicht zu ähnlich ist, sonst die erste wählbare Farbe
 * ohne Konflikt; haben alle einen, bleibt die des Turniers (der Hinweis sagt es).
 */
export function leibchenFarbeFuer(farben: TrikotFarben, seite: KitSide, turnierFarbe: string): string {
  const reihe = leibchenFarbenMit(turnierFarbe);
  return reihe.find((farbe) => !leibchenFarbeZuAehnlich(farben, seite, farbe)) ?? reihe[0];
}

export function ersteLeibchenWahl(farben: TrikotFarben, turnierFarbe: string): LeibchenWahl {
  const konflikt = kitHinweis(farben) !== 'none';
  return {
    bibSide: konflikt ? 'a' : null,
    bibColor: konflikt ? leibchenFarbeFuer(farben, 'a', turnierFarbe) : normalizeKitColor(turnierFarbe) ?? DEFAULT_BIB_COLOR,
  };
}

/** @SL-151: Leibchenfarbe gegen die Trikotfarbe des Gegners (dieselbe Grenze wie der Hinweis); ohne Leibchen nie. */
export function leibchenGegenGegner(farben: TrikotFarben, wahl: LeibchenWahl): boolean {
  if (wahl.bibSide === null) { return false; }
  return kitConflictWithLuminance(wahl.bibColor, farben[andere(wahl.bibSide)]) !== 'none';
}

/** Das `kit` des Anpfiffs: getragene Farben beider Seiten, bei Leibchen die Leibchenfarbe auf dieser Seite. */
export function kitAusWahl(farben: TrikotFarben, wahl: LeibchenWahl): MatchKit {
  const a = normalizeKitColor(farben.a);
  const b = normalizeKitColor(farben.b);
  if (wahl.bibSide === null) { return compactKit({ a, b }); }
  const bib = normalizeKitColor(wahl.bibColor) ?? DEFAULT_BIB_COLOR;
  return compactKit({ a: wahl.bibSide === 'a' ? bib : a, b: wahl.bibSide === 'b' ? bib : b, bibSide: wahl.bibSide });
}

/**
 * @SL-196: Kästen vor dem Anpfiff in den echten Trikotfarben („beide Kästen und Team-Köpfe Blau“), die gewählte Leibchen-Seite nur mit dem
 * Leibchen-Zeichen; die Weste (Leibchen über dem Trikot) zeigt die Anzeige erst ab dem Anpfiff. Ohne Trikotfarbe einer Seite gilt deren
 * Standardfarbe aus `standard` (dieselbe wie ohne Teamfarben).
 */
export function vorschauKaesten(farben: TrikotFarben, wahl: LeibchenWahl, standard: { a: SideBox; b: SideBox }): { a: SideBox; b: SideBox } {
  const seite = (s: KitSide): SideBox => {
    const trikot = normalizeKitColor(farben[s]);
    const grund: string = trikot ?? (standard[s].fill.kind === 'vest' ? standard[s].fill.stripes : standard[s].fill.color);
    const fill: BoxFill = { kind: 'solid', color: grund };
    return { fill, bib: wahl.bibSide === s };
  };
  return { a: seite('a'), b: seite('b') };
}

/** Echte Trikotfarben eines Spiels (aktuelle Teamfarbe je Seite, normalisiert); offene Seite oder keine Farbe → `undefined`. */
export function trikotFarben(match: Pick<Match, 'slotA' | 'slotB'>, teams: ReadonlyArray<Pick<Team, 'id' | 'colors'>>): TrikotFarben {
  const farbe = (slot: Match['slotA']): string | undefined => {
    const teamId = slotTeamId(slot);
    return teamId === undefined ? undefined : normalizeKitColor(teams.find((team) => team.id === teamId)?.colors?.primary);
  };
  return compactFarben(farbe(match.slotA), farbe(match.slotB));
}

function compactFarben(a: string | undefined, b: string | undefined): TrikotFarben {
  return { ...(a === undefined ? {} : { a }), ...(b === undefined ? {} : { b }) };
}
