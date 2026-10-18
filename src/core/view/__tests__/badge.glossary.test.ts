/**
 * Aufgabe 1.1 (Spielanzeige): die Abzeichen-Wörter stehen in beiden Sprachen wie im Glossar (docs/GLOSSAR.md) (@OB-066).
 * Deutsch aus dem Gherkin, Englisch nach Controller-Entscheidung 18.10.2026. Die Wörter stehen bewusst nicht in
 * `glossary.json`: die Lint-Regel `no-hardcoded-sport-terms-preferred` meldete dann jedes „live“ und „Ende“ im Code.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import deTournament from '../../../i18n/locales/de/tournament.json';
import enTournament from '../../../i18n/locales/en/tournament.json';
import { MATCH_BADGE_WORD_KEY, type MatchBadgeState } from '../badge';

const STATES = Object.keys(MATCH_BADGE_WORD_KEY) as MatchBadgeState[];
const DE: Record<MatchBadgeState, string> = {
  live: 'Live', pause: 'Pause', halftime: 'Halbzeit', overtime: 'Verlängerung', shootout: 'Strafstoßschießen', ended: 'Ende', cancelled: 'ausgefallen',
};
const EN: Record<MatchBadgeState, string> = {
  live: 'Live', pause: 'Paused', halftime: 'Half-time', overtime: 'Extra time', shootout: 'Penalties', ended: 'Full time', cancelled: 'Cancelled',
};
const glossar = readFileSync(resolve(process.cwd(), 'docs/GLOSSAR.md'), 'utf8');

describe('Abzeichen-Wörter', () => {
  it.each(STATES)('@OB-066 %s: Deutsch wie im Gherkin, Englisch wie im Glossar', (state) => {
    expect(deTournament.matchBadge[state]).toBe(DE[state]);
    expect(enTournament.matchBadge[state]).toBe(EN[state]);
    expect(glossar).toContain(`| ${DE[state]} | ${EN[state]} |`);
  });

  it('@OB-066 Gegenbeispiel: der englische Zustand „Pause“ heißt nicht „Live“ (Uhr angehalten ≠ läuft)', () => {
    expect(enTournament.matchBadge.pause).not.toBe(enTournament.matchBadge.live);
  });

  it.each([['de', deTournament], ['en', enTournament]] as const)(
    '@OB-066 @ZM-104 „ausgefallen“ heißt in Abzeichen und Statushinweis gleich (%s)',
    (_lang, tournament) => {
      expect(tournament.view.status.cancelled).toBe(tournament.matchBadge.cancelled);
    },
  );

  it('@OB-066 GLOSSAR.md nennt die Abweichung „Penalties“ zu glossary.json („penalty shootout“) ausdrücklich', () => {
    expect(glossar).toMatch(/Penalties[\s\S]*penalty shootout/);
  });
});
