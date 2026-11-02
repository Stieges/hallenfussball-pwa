/**
 * Kurzformen des Glossars (@OB-075): welcher Begriff hat welche Kurzform (Namensraum `short`) und welchen
 * ausgeschriebenen Begriff (Namensraum `sport`). Die Zuordnung spiegelt `short.shortKey` und `i18nKey` aus
 * `src/i18n/glossary.json`; `src/i18n/__tests__/kurzformen.test.ts` prüft den Gleichlauf.
 */
export const SHORT_TERMS = {
  rank: { short: 'short:tabellenkopf.rank', long: 'sport:tabelle.rank' },
  played: { short: 'short:tabellenkopf.played', long: 'sport:tabelle.played' },
  won: { short: 'short:tabellenkopf.won', long: 'sport:tabelle.won' },
  drawn: { short: 'short:tabellenkopf.drawn', long: 'sport:tabelle.drawn' },
  lost: { short: 'short:tabellenkopf.lost', long: 'sport:tabelle.lost' },
  goalDifference: { short: 'short:tabellenkopf.goalDifference', long: 'sport:tabelle.goalDifference' },
  points: { short: 'short:tabellenkopf.points', long: 'sport:tabelle.points' },
  number: { short: 'short:tabellenkopf.number', long: 'sport:tabelle.number' },
  extraTime: { short: 'short:ergebniszelle.extraTime', long: 'sport:phases.afterExtraTime' },
} as const;

export type ShortTerm = keyof typeof SHORT_TERMS;

/** Kurzformen, die im Kopf einer Tabellenspalte stehen dürfen. */
export type TableHeadTerm = Extract<ShortTerm, 'rank' | 'played' | 'won' | 'drawn' | 'lost' | 'goalDifference' | 'points' | 'number'>;
