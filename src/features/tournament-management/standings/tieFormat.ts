/**
 * Textbausteine der Gleichstands-Oberfläche (Paket TB-B): Namen und Plätze als Liste, immer in der Sprache der App.
 * Reine Funktionen ohne React; die Übersetzung selbst liegt in `tournament.json` → `standingsTie` (und `wizard.json` →
 * `playOut.places` für den Assistenten).
 */

/** „A und B“, „A, B und C“ in der Sprache der App. */
export function listText(items: readonly string[], language: string): string {
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(items);
}

/** Zusammenhängende Plätze zu Bereichen: [1, 2, 3, 5] → [[1, 3], [5, 5]]. */
export function placeRuns(places: readonly number[]): Array<[number, number]> {
  const sorted = [...new Set(places)].sort((a, b) => a - b);
  const runs: Array<[number, number]> = [];
  for (const place of sorted) {
    const last = runs[runs.length - 1];
    if (last !== undefined && place === last[1] + 1) {
      last[1] = place;
    } else {
      runs.push([place, place]);
    }
  }
  return runs;
}

/** Wörter für Plätze: einer, zwei hintereinander, mehrere hintereinander. */
export interface PlaceTexts {
  one: (from: number) => string;
  two: (from: number, to: number) => string;
  range: (from: number, to: number) => string;
}

/** „Platz 3“, „Platz 3 und 4“, „Platz 3 bis 5“. */
export function placeText(texts: PlaceTexts, from: number, to: number): string {
  if (from === to) {
    return texts.one(from);
  }
  return to === from + 1 ? texts.two(from, to) : texts.range(from, to);
}

/** Eine Liste von Plätzen als Text: „Platz 1 bis 3 und Platz 5“. */
export function placesListText(texts: PlaceTexts, places: readonly number[], language: string): string {
  return listText(placeRuns(places).map(([from, to]) => placeText(texts, from, to)), language);
}

/** Uhrzeit „14:32“ in der Sprache der App (Zeitpunkt der Eintragung im Verlauf, @W2A-063). */
export function timeText(isoTime: string, language: string): string {
  return new Date(isoTime).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
}
