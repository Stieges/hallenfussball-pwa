/**
 * A-36b (Teilplan A-36 § 2.4): Sichtbarkeitsmatrix `viewRules`, Statustabelle `viewStatus`, Uhrzeit `time.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { viewRules } from '../visibility';
import { isLive, isUpcoming, viewStatus } from '../status';
import { kickoffLocal, TOURNAMENT_TIME_ZONE, toTournamentLocal } from '../time';
import type { ViewAudience, ViewMedium, ViewRules, ViewerPdfChoice } from '../types';

type Switches = { hideScoresForPublic: boolean; hideRankingsForPublic: boolean };
const SWITCHES: Array<[string, Switches]> = [
  ['alles an', { hideScoresForPublic: false, hideRankingsForPublic: false }],
  ['Tabellen aus (T)', { hideScoresForPublic: false, hideRankingsForPublic: true }],
  ['Kindermodus (K)', { hideScoresForPublic: true, hideRankingsForPublic: false }],
  ['K und T', { hideScoresForPublic: true, hideRankingsForPublic: true }],
];
const PDF: ViewerPdfChoice[] = ['planOnly', 'withResults', 'none'];

/** Erwartung nach Matrix § 2.4 – unabhängig vom Baustein ausgeschrieben. */
function expectedRules(s: Switches, audience: ViewAudience, medium: ViewMedium, p: ViewerPdfChoice): Omit<ViewRules, 'viewerLinkAllowed' | 'viewerPdfOffered'> {
  const k = s.hideScoresForPublic;
  const t = s.hideRankingsForPublic;
  if (audience === 'organizer' && medium === 'app') {
    return { results: true, liveScore: true, tables: true, groupOrigin: true, awardedMark: true, correctedMark: true };
  }
  const withResults = audience === 'viewer' && medium === 'print' ? p === 'withResults' : true;
  return {
    results: !k && withResults,
    liveScore: !k && withResults,
    tables: !k && !t && withResults,
    groupOrigin: !k && !t,
    awardedMark: !k,
    correctedMark: !k,
  };
}

const CELLS: Array<[ViewAudience, ViewMedium]> = [
  ['organizer', 'app'], ['organizer', 'print'], ['viewer', 'app'], ['viewer', 'print'], ['screen', 'app'],
];

describe('@ZM-102 @BM-032 Sichtbarkeitsmatrix viewRules (§ 2.4) vollständig', () => {
  for (const [name, s] of SWITCHES) {
    for (const [audience, medium] of CELLS) {
      it.each(PDF)(`@ZM-102 @BM-032 ${name}: ${audience}·${medium}, Zuschauer-PDF %s`, (p) => {
        const rules = viewRules({ ...s, isPublic: true, shareCode: 'ABC123' }, audience, medium, p);
        expect(rules).toMatchObject(expectedRules(s, audience, medium, p));
        expect(rules.viewerLinkAllowed).toBe(true);
        expect(rules.viewerPdfOffered).toBe(audience === 'viewer' && medium === 'app' && p !== 'none');
      });
    }
  }

  it('@BM-032 Gegenbeispiel: viewer·print „Mit Ergebnissen“ bei Tabellen aus zeigt keine Tabellen', () => {
    const rules = viewRules({ hideScoresForPublic: false, hideRankingsForPublic: true }, 'viewer', 'print', 'withResults');
    expect(rules.tables).toBe(false);
    expect(rules.results).toBe(true);
  });

  it('@BM-032 Gegenbeispiel (W4): „Nur Spielplan“ verbirgt die Gruppen-Herkunft nicht', () => {
    expect(viewRules({ hideScoresForPublic: false, hideRankingsForPublic: false }, 'viewer', 'print', 'planOnly').groupOrigin).toBe(true);
  });

  it('@BM-054 ohne Freigabe oder ohne Code kein Zuschauer-Link und kein PDF-Knopf', () => {
    const base = { hideScoresForPublic: false, hideRankingsForPublic: false };
    expect(viewRules({ ...base, isPublic: false, shareCode: 'ABC' }, 'viewer', 'app').viewerLinkAllowed).toBe(false);
    expect(viewRules({ ...base, isPublic: true }, 'viewer', 'app').viewerPdfOffered).toBe(false);
    expect(viewRules({ ...base, isPublic: true, shareCode: 'ABC' }, 'viewer', 'app').viewerPdfOffered).toBe(true);
  });

  it('Vorgabe der Zuschauer-PDF-Wahl ist „Nur Spielplan“ (keine Ergebnisse im Zuschauer-PDF)', () => {
    expect(viewRules({ hideScoresForPublic: false, hideRankingsForPublic: false }, 'viewer', 'print').results).toBe(false);
  });
});

describe('@ZM-039 @ZM-040 @ZM-104 Statustabelle viewStatus (§ 2.4)', () => {
  it.each([
    [undefined, 'scheduled'], ['scheduled', 'scheduled'], ['waiting', 'scheduled'], ['running', 'running'],
    ['paused', 'paused'], ['finished', 'finished'], ['skipped', 'cancelled'],
  ] as const)('@ZM-039 Cache %s → %s', (cache, expected) => {
    expect(viewStatus({ matchStatus: cache })).toBe(expected);
  });

  it.each([
    ['scheduled', 'scheduled'], ['running', 'running'], ['shootout', 'running'], ['paused', 'paused'],
    ['section_break', 'paused'], ['decision_pending', 'paused'], ['finished', 'finished'], ['skipped', 'cancelled'],
  ] as const)('@ZM-040 Engine %s → %s', (engine, expected) => {
    expect(viewStatus({ matchStatus: 'running' }, engine)).toBe(expected);
  });

  it('@ZM-039 Engine finished hat Vorrang vor dem Cache running', () => {
    expect(viewStatus({ matchStatus: 'running' }, 'finished')).toBe('finished');
  });

  it('@ZM-104 beendet mit decidedBy forfeit → gewertet (F-WERT, Einheitstest bis A-25)', () => {
    expect(viewStatus({ matchStatus: 'finished', decidedBy: 'forfeit' })).toBe('awarded');
    expect(viewStatus({ matchStatus: 'running', decidedBy: 'forfeit' })).toBe('running');
  });

  it('@ZM-039 @ZM-041 isLive = laufend oder unterbrochen; isUpcoming nur geplant', () => {
    expect(isLive('paused')).toBe(true);
    expect(isLive('running')).toBe(true);
    expect(isLive('finished')).toBe(false);
    expect(isUpcoming('paused')).toBe(false);
    expect(isUpcoming('cancelled')).toBe(false);
    expect(isUpcoming('scheduled')).toBe(true);
  });
});

describe('@ZM-111 Uhrzeit in Turnier-Ortszeit (W14)', () => {
  const previousTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = previousTz;
  });

  it('@ZM-111 toTournamentLocal: 13:32 UTC am 28.11. ist 14:32 in Europe/Berlin, egal wie das Gerät steht', () => {
    process.env.TZ = 'America/New_York';
    const local = toTournamentLocal(new Date(Date.UTC(2026, 10, 28, 13, 32)), TOURNAMENT_TIME_ZONE);
    expect(local).toEqual({ date: '2026-11-28', time: '14:32' });
  });

  it('@ZM-111 kickoffLocal: Anstoß wie gespeichert (Wanduhr), Datum des Turniers', () => {
    process.env.TZ = 'America/New_York';
    expect(kickoffLocal('2026-11-28', new Date('1970-01-01T14:40:00'))).toEqual({ date: '2026-11-28', time: '14:40' });
    expect(kickoffLocal('2026-11-28', '14:40')).toEqual({ date: '2026-11-28', time: '14:40' });
    expect(kickoffLocal('2026-11-28', undefined)).toBeUndefined();
    expect(kickoffLocal('2026-11-28', 'kaputt')).toBeUndefined();
  });
});
