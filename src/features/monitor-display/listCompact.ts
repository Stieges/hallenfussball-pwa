/**
 * Listen-Folien mit schmaler Zeitspalte (@ZM-211, @ZM-187, @ZM-150): reine Funktionen ohne React.
 *
 * Neben der Uhrzeit steht keine leere Spalte mehr: Uhrzeit, „(war hh:mm)“ und Zustand stehen übereinander in einer schmalen Spalte, in jeder Zeile
 * der Folie gleich (der Zusatz hat immer seine Zeile, auch wenn kein Spiel verschoben ist). Der freie Platz geht an die Teamnamen, die Schrift
 * wächst um einen Maßstab. Die Seiten bleiben die des bisherigen Höhenmodells (`listRows.ts`: gleiche Aufteilung, gleiche Seitenzahl für den Takt).
 *
 * Der Maßstab ist so gewählt, dass (1) jede Seite in die Höhe passt und (2) kein Name erst durch die Vergrößerung umbricht. Dafür rechnet das Modell
 * die Breite der Namen aus den Zeichenbreiten der echten Schrift (`interWidths.ts`) und ist vorsichtig: die Zeilen im neuen Maßstab mit
 * Zuschlag auf die Breiten gegen die Zeilen der bisherigen Aufteilung mit Abschlag. Passt es schon im Maßstab 1 nicht (Höhe oder neuer Umbruch),
 * bleibt die Folie bei der bisherigen Aufteilung (`null`). Die Prüfung an der gerenderten Breite steht im Browser-Test
 * `tests/e2e/listen-folien-monitor.spec.ts`.
 */
import { displayList } from '../../design-tokens';
import type { MatchView } from '../../core/view';
import { FALLBACK_EM, INTER_BREITE_EM, SICHERHEIT } from './interWidths';
import { availableHeight, LINE, num, ROW_BORDER, type ListColumns, type ListFrame } from './listRows';
import { monitorSideLabel } from './matchSides';

/** Tokens der Zeilen im Maßstab: nur die Schriftstufen wachsen, Abstände und Polster bleiben; die Zeitspalte ist die schmale. */
export type ListTokens = { fontSizes: Record<keyof typeof displayList.fontSizes, string> } & Record<Exclude<keyof typeof displayList, 'fontSizes' | 'fit' | 'standings'>, string>
  & Pick<typeof displayList, 'fit' | 'standings'>;

const SCALED_FONTS = ['team', 'time', 'score', 'note', 'timeNote'] as const;

/** Zeitspalte der schmalen Aufteilung: im Spielplan (Zustandsabzeichen möglich) breit genug für das längste Zustandswort, sonst für „(war hh:mm)“. */
export function zeitSpalte(cols: ListColumns): string {
  return cols.state ? displayList.timeColumnStateWidth : displayList.timeColumnWidth;
}

/** Die Tokens der Zeilen für die schmale Aufteilung im Maßstab `scale`; `timeFieldWidth` trägt die schmale Zeitspalte. */
export function compactTokens(scale: number, cols: ListColumns): ListTokens {
  const fontSizes: ListTokens['fontSizes'] = { ...displayList.fontSizes };
  for (const key of SCALED_FONTS) { fontSizes[key] = `${String(Math.round(num(displayList.fontSizes[key]) * scale * 1000) / 1000)}vh`; }
  return { ...displayList, fontSizes, timeFieldWidth: zeitSpalte(cols) };
}

const SPACE_EM = INTER_BREITE_EM[' '];

/** Breite eines Textes in em der Schrift (Normalschnitt); `faktor` > 1 vorsichtig, < 1 bewusst knapp. */
export function textBreiteEm(text: string, faktor: number = SICHERHEIT): number {
  let breite = 0;
  for (const zeichen of text) { breite += INTER_BREITE_EM[zeichen] ?? FALLBACK_EM; }
  return breite * faktor;
}

interface Teil { breite: number; leerzeichen: boolean }

/** Teile, an denen der Browser umbrechen darf: nach Leerzeichen und nach „/“; Bindestrich-Wörter bleiben zusammen, solange sie in eine Zeile passen. */
function teile(text: string, breiteEm: number, faktor: number): Teil[] {
  const ergebnis: Teil[] = [];
  let leerzeichen = false;
  for (const m of text.matchAll(/(\s+)|([^\s]+)/g)) {
    if (m[1] !== undefined) { leerzeichen = true; continue; }
    const wort = m[2];
    const stuecke = (wort.match(/[^/]+\/?|\//g) ?? [wort]).flatMap((stueck) => (
      stueck.includes('-') && textBreiteEm(stueck, faktor) <= breiteEm ? [stueck] : stueck.match(/[^-]+-?|-/g) ?? []
    ));
    stuecke.forEach((stueck, i) => { ergebnis.push({ breite: textBreiteEm(stueck, faktor), leerzeichen: i === 0 && leerzeichen && ergebnis.length > 0 }); });
    leerzeichen = false;
  }
  return ergebnis;
}

/** Zeilen, die ein Name bei der Breite `breiteEm` belegt (Umbruch an Leerzeichen und nach „/“, überlange Wörter brechen). */
export function nameZeilen(text: string, breiteEm: number, faktor: number = SICHERHEIT): number {
  let zeilen = 1;
  let belegt = 0;
  for (const teil of teile(text, breiteEm, faktor)) {
    const leer = teil.leerzeichen ? SPACE_EM * faktor : 0;
    if (belegt !== 0 && belegt + leer + teil.breite > breiteEm) {
      zeilen += 1;
      belegt = 0;
    }
    if (teil.breite > breiteEm) {
      zeilen += Math.ceil(teil.breite / breiteEm) - 1;
      belegt = teil.breite % breiteEm || breiteEm;
    } else {
      belegt = belegt === 0 ? teil.breite : belegt + leer + teil.breite;
    }
  }
  return zeilen;
}

/** Querformat 16:9 als Vorgabe: Breite in Einheiten der Bildhöhe. */
function breiteVh(frame: ListFrame): number {
  return 100 * (frame.aspect ?? 16 / 9);
}

/**
 * Breite einer Namensspalte (Heim oder Gast) in em der Namensschrift. `cols`: Zeitspalte der schmalen Aufteilung, `null` die bisherige;
 * `scale`: Maßstab der Schrift (Abstände bleiben).
 */
export function namenBreiteEm(frame: ListFrame, cols: ListColumns | null, scale: number): number {
  const schrift = num(displayList.fontSizes.team) * scale;
  const feste = (cols === null ? num(displayList.timeFieldWidth) : num(zeitSpalte(cols))) + num(displayList.separatorWidth);
  const rest = breiteVh(frame) * (1 - (2 * frame.overscan) / 100) - 2 * num(displayList.rowPaddingX) - 3 * num(displayList.cellGap) - ROW_BORDER;
  return Math.max(1, rest / 2 / schrift - feste / 2);
}

/** Zeilen des längeren der beiden Namen eines Spiels. */
function zeilenDesSpiels(match: MatchView, breiteEm: number, faktor: number): number {
  return Math.max(nameZeilen(monitorSideLabel(match.home), breiteEm, faktor), nameZeilen(monitorSideLabel(match.away), breiteEm, faktor));
}

/**
 * Höhe eines Spiels in der schmalen Aufteilung in vh: Zwischenzeile (Bezeichnung), Polster, Rahmen und der höchste Inhalt aus Zeitspalte
 * (Uhrzeit, Zusatzzeile „(war …)“ immer reserviert, Zustand, Feld), Teamnamen und Stand (mit Zeile für „(4:3 i. E.)“ im Spielplan).
 */
export function compactRowHeight(match: MatchView, cols: ListColumns, frame: ListFrame, scale: number, reserveExtra: boolean = cols.state): number {
  const namenBreite = namenBreiteEm(frame, cols, scale);
  const schrift = num(displayList.fontSizes.team) * scale;
  const stapel = displayList.fit.stackLineHeight;
  const notiz = num(displayList.fontSizes.note) * scale * LINE;
  const zeit = num(displayList.fontSizes.time) * scale * stapel + num(displayList.fontSizes.timeNote) * scale * stapel
    + (cols.state ? notiz : 0) + (cols.field ? notiz : 0);
  const zwischenzeile = match.labelText ? num(displayList.fontSizes.timeNote) * scale * LINE + num(displayList.labelGap) : 0;
  const padY = num(displayList.rowPaddingY);
  const standZeile = num(displayList.fontSizes.score) * scale * LINE;
  const unten = reserveExtra ? Math.max(0, notiz - 0.8 * padY) : 0;
  const stand = unten > 0 ? 2 * (standZeile / 2 + unten) : standZeile;
  const namen = zeilenDesSpiels(match, namenBreite, SICHERHEIT) * schrift * LINE;
  return zwischenzeile + 2 * padY + ROW_BORDER + Math.max(zeit, namen, stand);
}

/** Höhe der Zeilen einer Seite in vh (Zeilen und Abstände). */
function seitenHoehe(seite: readonly MatchView[], cols: ListColumns, frame: ListFrame, scale: number): number {
  const abstand = num(displayList.rowGap);
  return seite.reduce((summe, m, i) => summe + compactRowHeight(m, cols, frame, scale) + (i === 0 ? 0 : abstand), 0);
}

/** Wie viel Faktor auf die Breiten der bisherigen Aufteilung: knapp gerechnet, damit „vorher einzeilig“ nie zu pessimistisch gilt. */
const KNAPP = 0.95;

/**
 * Größter Maßstab (1 bis `displayList.fit.maxScale`) der schmalen Aufteilung, bei dem jede Seite in die freie Höhe passt und kein Name mehr Zeilen
 * belegt als in der bisherigen Aufteilung; `null`, wenn schon der Maßstab 1 nicht passt (dann bleibt die Folie, wie sie war).
 */
export function compactScale(pages: readonly (readonly MatchView[])[], cols: ListColumns, frame: ListFrame): number | null {
  const spiele = pages.flat();
  const namen = [...new Set(spiele.flatMap(m => [monitorSideLabel(m.home), monitorSideLabel(m.away)]))];
  const bisherBreite = namenBreiteEm(frame, null, 1);
  const bisher = new Map(namen.map(name => [name, nameZeilen(name, bisherBreite, KNAPP)]));
  const frei = availableHeight({ overscan: frame.overscan, notice: frame.notice });
  for (let s = displayList.fit.maxScale; s >= 1 - 1e-9; s -= displayList.fit.scaleStep) {
    const scale = Math.max(1, Math.round(s * 100) / 100);
    const breite = namenBreiteEm(frame, cols, scale);
    // je Name, nicht je Spiel: ein langer Name im Spiel darf einen kurzen nicht verdecken
    const keinNeuerUmbruch = namen.every(name => nameZeilen(name, breite, SICHERHEIT) <= (bisher.get(name) ?? 1));
    if (keinNeuerUmbruch && pages.every(seite => seitenHoehe(seite, cols, frame, scale) <= frei)) { return scale; }
  }
  return null;
}

/** Der Rahmen für die Zeilen einer Folie: schmale Aufteilung im größten passenden Maßstab, sonst der Rahmen von bisher. */
export function compactFrame(pages: readonly (readonly MatchView[])[], cols: ListColumns, frame: ListFrame): ListFrame {
  const scale = compactScale(pages, cols, frame);
  return scale === null ? frame : { ...frame, compact: true, scale };
}
