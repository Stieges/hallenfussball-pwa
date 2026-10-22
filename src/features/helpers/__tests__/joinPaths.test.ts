import { describe, expect, it } from 'vitest';
import { formatJoinDate, helperFieldPath, helperSchedulePath, helperStandingsPath, helperTournamentPath, spectatorPath } from '../joinPaths';

describe('joinPaths (A-17b)', () => {
  it('@HE-095 Feld öffnen: Live-Reiter mit ?f=', () => {
    expect(helperFieldPath('t-1', 2)).toBe('/tournament/t-1/live?f=2');
  });
  it('@HE-091 / @HE-055 / @HE-098 Zielseiten', () => {
    expect(helperTournamentPath('t-1')).toBe('/tournament/t-1');
    expect(helperSchedulePath('t-1')).toBe('/tournament/t-1/schedule');
    expect(helperStandingsPath('t-1')).toBe('/tournament/t-1/standings');
  });
  it('@HE-033 Zuschauer-Weg', () => {
    expect(spectatorPath('AB12CD')).toBe('/live/AB12CD');
  });
  it('Gegenbeispiel: Sonderzeichen in der Kennung werden maskiert', () => {
    expect(helperFieldPath('a/b', 1)).toBe('/tournament/a%2Fb/live?f=1');
  });
  it('Datum: Ortszeit ohne Zeitzonen-Sprung; Unlesbares bleibt unverändert', () => {
    expect(formatJoinDate('2026-11-28', 'de')).toContain('28');
    expect(formatJoinDate('2026-11-28', 'de')).toMatch(/Sa/);
    expect(formatJoinDate('kaputt', 'de')).toBe('kaputt');
  });
});
