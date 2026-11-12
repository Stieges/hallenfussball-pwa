/**
 * Regeln der Leibchen-Wahl (@SL-137, @SL-138, @SL-148, @SL-151, @SL-173, @SL-219, @SL-231): reine Regeln ohne React.
 *
 * - `kitHinweis`: Hinweis auf gleiche bzw. zu ähnliche Trikotfarben (Farbabstand ΔE2000, `kitConflict`; die Helligkeit löst keine Karte aus, @SL-173).
 * - `leibchenFarbeFuer`: erste wählbare Farbe ohne Konflikt mit dem Gegner (@SL-151).
 * - `LEIBCHEN_FARBEN`, `leibchenAuswahl`: die Grundauswahl aus 8 Farben (Gelb, Orange, Neongrün, Pink, Rot, Blau, Weiß, Schwarz) mit den Hallenfarben
 *   des Turniers zuerst, nichts doppelt (@SL-199, @SL-219, @W3-029); Werte aus der Trikot-Palette des Assistenten.
 * - `leibchenWieEigenesTrikot`: Warnung „Leibchen sieht aus wie das eigene Trikot“ bzw. Hinweis „gleich hell“ (@SL-231, @SL-173).
 * Den Vorschlag der Karte rechnet `kitProposal.ts`, das `kit` des Anpfiffs `kitAnpfiff.ts`.
 */
import { palette } from '../../design-tokens/colors/palette';
import { DEFAULT_BIB_COLOR, kitConflict, kitSameBrightness, normalizeKitColor, type KitConflict, type KitSide } from './kit';
import type { Match, Team } from '../../types/tournament';
import { slotTeamId } from './matchSlot';

/** Trikotfarben beider Seiten (`a` = Heim, `b` = Gast), normalisiert oder `undefined` („keine Farbe“). */
export interface TrikotFarben {
  a?: string;
  b?: string;
}

/** Namen der Farben der Trikot-Palette (Text und Vorlesen, @SL-219: jede Farbe trägt ihren Namen als Wort). */
export type LeibchenFarbName =
  | 'gelb' | 'orange' | 'neongruen' | 'pink' | 'rot' | 'blau' | 'weiss' | 'schwarz'
  | 'gruen' | 'lila' | 'tuerkis' | 'grau' | 'braun';

const J = palette.jersey;
/** Grundauswahl im Cockpit, in dieser Reihenfolge (Daniel 2026-11-09): Gelb, Orange, Neongrün, Pink, Rot, Blau, Weiß, Schwarz. */
const GRUNDAUSWAHL: ReadonlyArray<readonly [LeibchenFarbName, string]> = [
  ['gelb', J.yellow], ['orange', J.orange], ['neongruen', J.neonGreen], ['pink', J.pink],
  ['rot', J.red], ['blau', J.blue], ['weiss', J.white], ['schwarz', J.black],
];
/** Übrige Farben der Trikot-Palette: als Hallenfarbe wählbar, nicht in der Grundauswahl (z. B. Grün), aber mit Namen. */
const WEITERE_NAMEN: ReadonlyArray<readonly [LeibchenFarbName, string]> = [
  ['gruen', J.green], ['lila', J.purple], ['tuerkis', J.teal], ['grau', J.gray], ['braun', J.brown],
];
const hexOf = (farbe: string): string => normalizeKitColor(farbe) ?? DEFAULT_BIB_COLOR;
/** Die 8 Farben der Grundauswahl (normalisiert `#RRGGBB`). */
export const LEIBCHEN_FARBEN: readonly string[] = GRUNDAUSWAHL.map(([, farbe]) => hexOf(farbe));

/** Name einer Farbe der Trikot-Palette; eine eigene Farbe außerhalb der Palette hat keinen (`null`). */
export function leibchenFarbName(farbe: string): LeibchenFarbName | null {
  const hex = normalizeKitColor(farbe);
  const treffer = [...GRUNDAUSWAHL, ...WEITERE_NAMEN].find(([, kandidat]) => hexOf(kandidat) === hex);
  return treffer === undefined ? null : treffer[0];
}

/** Ohne Doppel, normalisiert, ungültige Werte entfallen. */
function ohneDoppel(farben: readonly string[]): string[] {
  const out: string[] = [];
  for (const farbe of farben) {
    const hex = normalizeKitColor(farbe);
    if (hex !== undefined && !out.includes(hex)) { out.push(hex); }
  }
  return out;
}

/**
 * @SL-219/@SL-199: die Auswahl „Andere Farbe …“ – zuerst die Hallenfarben des Turniers, darunter die Grundauswahl aus 8 Farben, jede Farbe nur einmal.
 * Ohne eingetragene Hallenfarben ist es gleich die Grundauswahl; eine Hallenfarbe außerhalb der Grundauswahl (Grün) steht nur oben.
 */
export function leibchenAuswahl(hallenFarben: readonly string[]): { halle: string[]; weitere: string[]; alle: string[] } {
  const halle = ohneDoppel(hallenFarben);
  const weitere = LEIBCHEN_FARBEN.filter((farbe) => !halle.includes(farbe));
  return { halle, weitere, alle: [...halle, ...weitere] };
}

/** Farbe der Leibchen des Turniers zuerst, danach die übrigen der Grundauswahl (ohne Doppel). */
export function leibchenFarbenMit(turnierFarbe: string | readonly string[]): string[] {
  const halle = typeof turnierFarbe === 'string' ? [hexOf(turnierFarbe)] : turnierFarbe;
  return leibchenAuswahl(halle).alle;
}

/** @SL-137/@SL-139/@SL-173: gleiche oder zu ähnliche Trikotfarben; ohne Farbe einer Seite kein Hinweis. */
export function kitHinweis(farben: TrikotFarben): KitConflict {
  return kitConflict(farben.a, farben.b);
}

/** @SL-137/@SL-138: bei Konflikt die Heimseite mit Leibchen vorbelegt, sonst ohne Leibchen. */
const andere = (seite: KitSide): KitSide => (seite === 'a' ? 'b' : 'a');

/** @SL-151: Leibchenfarbe gegen die Trikotfarbe des Gegners der Seite `seite` (ΔE2000 < 30; die Helligkeit ist nur der Hinweis „gleich hell“, @SL-173). */
export function leibchenFarbeZuAehnlich(farben: TrikotFarben, seite: KitSide, farbe: string): boolean {
  return kitConflict(farbe, farben[andere(seite)]) !== 'none';
}

/**
 * @SL-137/@SL-151: Leibchenfarbe für `seite` – die des Turniers, wenn sie dem Gegner nicht zu ähnlich ist, sonst die erste wählbare Farbe
 * ohne Konflikt; haben alle einen, bleibt die des Turniers (der Hinweis sagt es).
 */
export function leibchenFarbeFuer(farben: TrikotFarben, seite: KitSide, turnierFarbe: string): string {
  const reihe = leibchenFarbenMit(turnierFarbe);
  return reihe.find((farbe) => !leibchenFarbeZuAehnlich(farben, seite, farbe)) ?? reihe[0];
}

/** Hinweis zu einer Leibchenfarbe in der Farbliste: `aehnlich` (ΔE2000 < 30 oder gleich), `gleichHell` (nur Helligkeit < 1,5 : 1, @SL-173), sonst `none`. */
export type LeibchenFarbHinweis = 'none' | 'aehnlich' | 'gleichHell';

function farbHinweis(farbe: string, trikot: string | undefined): LeibchenFarbHinweis {
  if (kitConflict(farbe, trikot) !== 'none') { return 'aehnlich'; }
  return kitSameBrightness(farbe, trikot) ? 'gleichHell' : 'none';
}

/**
 * @SL-231/@SL-173: die gewählte Leibchenfarbe gegen das EIGENE Trikot der ziehenden Seite – `aehnlich` („Leibchen sieht aus wie das eigene Trikot“,
 * Kachel „Wie Trikot“) oder `gleichHell` (Rot `#C62828` gegen Blau `#1565C0`: Farbabstand 44,8, aber 1,02 : 1). Warnung mit Zeichen und Wort,
 * Bestätigen bleibt erlaubt. Ohne Trikotfarbe der Seite nie.
 */
export function leibchenWieEigenesTrikot(farben: TrikotFarben, seite: KitSide, farbe: string): LeibchenFarbHinweis {
  return farbHinweis(farbe, farben[seite]);
}

/** Dasselbe gegen das Trikot des Gegners (@SL-151, Farbliste): `aehnlich` löst „Leibchen zu ähnlich wie der Gegner“ aus, `gleichHell` ist nur ein Hinweis. */
export function leibchenGegenGegnerHinweis(farben: TrikotFarben, seite: KitSide, farbe: string): LeibchenFarbHinweis {
  return farbHinweis(farbe, farben[andere(seite)]);
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
