/**
 * Lesehilfen für das Endstand-PDF im Nikolaus-Durchstich (N8): Plätze und Torschützenliste aus den Textstücken, die `extractPdfText` liefert.
 * Rein (ohne Playwright), damit ein Vitest-Test sie am echten PDF prüft (`__tests__/endstandPdfLesen.test.ts`). Seite „Siegerehrung“
 * (@DR-052): Überschrift „Platzierung“ mit allen Plätzen, danach „Torschützen“ mit Rang | Verein | Nr. | Tore und der Fußnote „Außerdem: …“.
 */

/** Ein Eintrag der gespeicherten Torschützenliste (`snapshot.scorers`, @ET-045). */
export type GespeicherterSchuetze =
  | { kind: 'player'; rank: number; teamName: string; number: number; goals: number }
  | { kind: 'noNumber' | 'ownGoals'; rank: null; teamName: string; goals: number };

const textstuecke = (seiten: string[][]): string[] => seiten.flat().map((s) => s.trim()).filter((s) => s !== '');

/**
 * Plätze des Blocks „Platzierung“ bzw. der „Abschlusstabelle“ (@DR-009): Teamnamen nach der letzten solchen Überschrift in Reihenfolge.
 * Im Endstand-PDF ist es die Seite „Siegerehrung“: dort folgt der Platzliste die Torschützenliste mit denselben Vereinen, darum endet
 * das Lesen vor der Überschrift „Torschützen“.
 */
export function plaetzeImPdf(seiten: string[][], namen: readonly string[]): string[] {
  const text = textstuecke(seiten);
  const start = Math.max(text.lastIndexOf('Abschlusstabelle'), text.lastIndexOf('Platzierung'));
  if (start < 0) { return []; }
  const danach = text.slice(start + 1);
  const ende = danach.indexOf('Torschützen');
  return (ende < 0 ? danach : danach.slice(0, ende)).filter((s) => namen.includes(s));
}

/** Spieler mit Rückennummer der gespeicherten Liste. */
export const spielerOf = (scorers: readonly GespeicherterSchuetze[]): Array<Extract<GespeicherterSchuetze, { kind: 'player' }>> =>
  scorers.filter((z): z is Extract<GespeicherterSchuetze, { kind: 'player' }> => z.kind === 'player');

/** Textstücke der Zeilen, wie das PDF sie druckt: Rang nur bei der ersten Zeile seiner Gruppe, Verein, „#Nr“, Tore. */
export function erwarteteZeilen(scorers: readonly GespeicherterSchuetze[]): string[] {
  const spieler = spielerOf(scorers);
  return spieler.flatMap((z, i) => [...(i === 0 || spieler[i - 1].rank !== z.rank ? [`${String(z.rank)}.`] : []), z.teamName, `#${String(z.number)}`, String(z.goals)]);
}

/** Fußnote „Außerdem: 2 Tore ohne Rückennummer · 1 Eigentor“ nach der gespeicherten Liste; leer, wenn es keine solchen Tore gibt. */
export function erwarteteFussnote(scorers: readonly GespeicherterSchuetze[]): string {
  const summe = (kind: 'noNumber' | 'ownGoals'): number => scorers.filter((z) => z.kind === kind).reduce((n, z) => n + z.goals, 0);
  const teile = [
    ...(summe('noNumber') > 0 ? [`${String(summe('noNumber'))} ${summe('noNumber') === 1 ? 'Tor' : 'Tore'} ohne Rückennummer`] : []),
    ...(summe('ownGoals') > 0 ? [`${String(summe('ownGoals'))} ${summe('ownGoals') === 1 ? 'Eigentor' : 'Eigentore'}`] : []),
  ];
  return teile.length === 0 ? '' : `Außerdem: ${teile.join(' · ')}`;
}

/** Gelesene Torschützenliste: ob die Überschrift steht, die vier Spaltenköpfe, die Textstücke der Zeilen (so viele wie erwartet) und die Fußnote. */
export function schuetzenImPdf(seiten: string[][], zeilenAnzahl: number): { ueberschrift: boolean; kopf: string[]; zeilen: string[]; fussnote: string } {
  const text = textstuecke(seiten);
  const start = text.lastIndexOf('Torschützen');
  if (start < 0) { return { ueberschrift: false, kopf: [], zeilen: [], fussnote: '' }; }
  return {
    ueberschrift: true,
    kopf: text.slice(start + 1, start + 5),
    zeilen: text.slice(start + 5, start + 5 + zeilenAnzahl),
    fussnote: text.find((t, i) => i > start && t.startsWith('Außerdem:')) ?? '',
  };
}
