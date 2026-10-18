/**
 * Reine Tests der Ansichts-Logik der Zuschauer-Seite (B-13c). Ohne React.
 * Fixture: buildLiveViewTournament – Spiel 1 beendet 2:0, Spiel 5 ausgefallen, Spiel 7 läuft 1:0.
 */
import { describe, it, expect } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { buildTournamentView } from '../../../core/view';
import type { Tournament } from '../../../types/tournament';
import type { ViewFilters } from '../publicScheduleFilters';
import {
  applyViewFilters,
  applyScoreVisibility,
  publicSchedule,
  publicMatches,
  visibleStandings,
  uniqueGroups,
  myTeamName,
} from '../publicScheduleFilters';
import { buildLiveViewTournament, TEAM_IDS } from '../../../screens/__tests__/liveViewFixture';

/** Die Ansicht der Zuschauer: Status und Sichtbarkeit kommen daraus (A-36c). */
const viewOf = (t: Tournament) => buildTournamentView(t, { audience: 'viewer', medium: 'app', locale: 'de' });

const NO_FILTER: ViewFilters = {
  showOnlyMyTeam: false,
  myTeamId: null,
  selectedGroup: null,
  selectedPhase: 'all',
  selectedStatus: 'all',
};

function scheduleOf(opts: Parameters<typeof buildLiveViewTournament>[0] = {}) {
  const t = buildLiveViewTournament(opts);
  return { t, schedule: generateFullSchedule(t) };
}

describe('applyViewFilters', () => {
  it('Status live (running) liefert nur Spiel 7', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, selectedStatus: 'live' });
    expect(result.allMatches.map((m) => m.matchNumber)).toEqual([7]);
  });

  it('Gegenbeispiel: Status live nimmt beendete (Spiel 1) und ausgefallene (Spiel 5) Spiele nicht mit', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, selectedStatus: 'live' });
    const numbers = result.allMatches.map((m) => m.matchNumber);
    expect(numbers).not.toContain(1);
    expect(numbers).not.toContain(5);
  });

  it('Status finished liefert nur Spiel 1', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, selectedStatus: 'finished' });
    expect(result.allMatches.map((m) => m.matchNumber)).toEqual([1]);
  });

  it('Status scheduled schließt ausgefallene (skipped) Spiele aus', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, selectedStatus: 'scheduled' });
    expect(result.allMatches.map((m) => m.matchNumber)).not.toContain(5);
    expect(result.allMatches.map((m) => m.matchNumber)).not.toContain(7);
  });

  it('Status scheduled enthält geplante Spiele (Spiel 9 ist drin)', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, selectedStatus: 'scheduled' });
    expect(result.allMatches.map((m) => m.matchNumber)).toContain(9);
  });

  it('Status scheduled enthält wartende (waiting) Spiele, Status live nicht', () => {
    const { t, schedule } = scheduleOf();
    const waitingTournament = {
      ...t,
      matches: t.matches.map((tm) => (tm.matchNumber === 9 ? { ...tm, matchStatus: 'waiting' as const } : tm)),
    };
    const scheduled = applyViewFilters(schedule, viewOf(waitingTournament), { ...NO_FILTER, selectedStatus: 'scheduled' });
    expect(scheduled.allMatches.map((m) => m.matchNumber)).toContain(9);
    const live = applyViewFilters(schedule, viewOf(waitingTournament), { ...NO_FILTER, selectedStatus: 'live' });
    expect(live.allMatches.map((m) => m.matchNumber)).not.toContain(9);
  });

  it('„Nur meine“ ohne gewähltes Team filtert nicht', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, showOnlyMyTeam: true, myTeamId: null });
    expect(result.allMatches).toHaveLength(schedule.allMatches.length);
  });

  it('„Nur meine“ mit Team nord zeigt nur Spiele, an denen FC Nord beteiligt ist', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, showOnlyMyTeam: true, myTeamId: TEAM_IDS.nord });
    expect(result.allMatches.length).toBeGreaterThan(0);
    for (const m of result.allMatches) {
      expect([m.originalTeamA, m.originalTeamB]).toContain(TEAM_IDS.nord);
    }
  });

  it('Gruppenfilter B zeigt nur Gruppe-B-Spiele und leert keine Phasen-Hülle', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, selectedGroup: 'B' });
    expect(result.allMatches.length).toBeGreaterThan(0);
    expect(result.allMatches.every((m) => m.group === 'B')).toBe(true);
    expect(result.phases.every((p) => p.matches.length > 0)).toBe(true);
  });

  it('Phase final schließt die Gruppenphase aus', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), { ...NO_FILTER, selectedPhase: 'final' });
    expect(result.allMatches.length).toBeGreaterThan(0);
    expect(result.allMatches.every((m) => m.phase !== 'groupStage')).toBe(true);
  });

  it('ohne Filter bleibt der Spielplan vollständig', () => {
    const { t, schedule } = scheduleOf();
    const result = applyViewFilters(schedule, viewOf(t), NO_FILTER);
    expect(result.allMatches).toHaveLength(schedule.allMatches.length);
  });
});

describe('applyScoreVisibility / publicSchedule', () => {
  it('hideScoresForPublic entfernt Stände aus Spielplan und Phasen', () => {
    const { t, schedule } = scheduleOf({ hideScoresForPublic: true });
    const result = applyScoreVisibility(schedule, viewOf(t).rules);
    expect(result.allMatches.some((m) => m.scoreA !== undefined || m.scoreB !== undefined)).toBe(false);
    expect(
      result.phases.some((p) => p.matches.some((m) => m.scoreA !== undefined || m.scoreB !== undefined))
    ).toBe(false);
  });

  it('ohne hideScoresForPublic bleibt der Spielplan unverändert (Gegenbeispiel)', () => {
    const { t, schedule } = scheduleOf({ hideScoresForPublic: false });
    expect(applyScoreVisibility(schedule, viewOf(t).rules)).toBe(schedule);
    const stand = applyScoreVisibility(schedule, viewOf(t).rules).allMatches.find((m) => m.matchNumber === 1);
    expect(stand?.scoreA).toBe(2);
  });

  it('publicSchedule kombiniert Filter und Ausblenden der Stände', () => {
    const { t, schedule } = scheduleOf({ hideScoresForPublic: true });
    const result = publicSchedule(schedule, viewOf(t), { ...NO_FILTER, selectedGroup: 'A' });
    expect(result.allMatches.every((m) => m.group === 'A')).toBe(true);
    expect(result.allMatches.every((m) => m.scoreA === undefined)).toBe(true);
  });
});

describe('publicMatches', () => {
  it('hideScoresForPublic: Liste ohne Stände, Turnierdaten unverändert', () => {
    const t = buildLiveViewTournament({ hideScoresForPublic: true });
    const list = publicMatches(t, viewOf(t).rules);
    expect(list.every((m) => m.scoreA === undefined && m.scoreB === undefined)).toBe(true);
    expect(t.matches.find((m) => m.id !== undefined && m.scoreA === 2)).toBeDefined();
  });

  it('ohne hideScoresForPublic: dieselbe Liste wie im Turnier', () => {
    const t = buildLiveViewTournament({ hideScoresForPublic: false });
    expect(publicMatches(t, viewOf(t).rules)).toBe(t.matches);
  });
});

describe('visibleStandings', () => {
  const standings = [{ teamId: TEAM_IDS.nord, points: 3 }] as unknown as Parameters<typeof visibleStandings>[1];

  it('hideRankingsForPublic liefert keine Tabelle', () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: true });
    expect(visibleStandings(viewOf(t).rules, standings)).toEqual([]);
  });

  it('ohne hideRankingsForPublic bleiben die Tabellen', () => {
    const t = buildLiveViewTournament({ hideRankingsForPublic: false });
    expect(visibleStandings(viewOf(t).rules, standings)).toBe(standings);
  });
});

describe('uniqueGroups / myTeamName', () => {
  it('uniqueGroups liefert die Gruppen in Reihenfolge ohne Doppelte', () => {
    expect(uniqueGroups(buildLiveViewTournament())).toEqual(['A', 'B']);
  });

  it('myTeamName liefert den Namen des gewählten Teams', () => {
    expect(myTeamName(buildLiveViewTournament(), TEAM_IDS.sued)).toBe('SV Süd');
  });

  it('myTeamName ohne Auswahl oder unbekanntes Team ist null', () => {
    const t = buildLiveViewTournament();
    expect(myTeamName(t, null)).toBeNull();
    expect(myTeamName(t, 'gibt-es-nicht')).toBeNull();
  });
});
