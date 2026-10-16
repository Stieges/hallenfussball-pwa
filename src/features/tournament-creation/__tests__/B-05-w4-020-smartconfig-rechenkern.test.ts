/**
 * B-05 — @W4-020: Die Zeit-Empfehlung rechnet bei Gruppenphase + Finalrunde
 * mit den tatsächlichen Spielen.
 *
 * Gegeben 2 Gruppen zu je 4 Teams mit Halbfinale, Spiel um Platz 3 und Finale
 * Wenn die App die Empfehlung berechnet
 * Dann rechnet sie mit 12 Gruppenspielen (2 × 6) und 4 Finalspielen, zusammen 16
 * Und nicht mit jeder gegen jeden über alle 8 Teams (28 Spiele)
 *
 * Gegenbeispiele: jeder gegen jeden (eine Gruppe) → 28; ungleiche Gruppen 5+4 → 10+6;
 * nur Finale → +1.
 * Mutation: Formel zurück auf n·(n−1)/2 → rot; Finalrunde nicht mitgezählt → rot.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FinalsPreset, Team, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import {
  buildConstraintsList,
  calculateRecommendation,
  countTournamentMatches,
  loadStoredConfig,
  saveStoredConfig,
} from '../utils/smartConfigCalculator';
import { testUuid } from '../../../test/testIds';

/** Turnier mit groupCount Gruppen (Teams i % groupCount → Gruppe A, B, …) für den echten Generator. */
const gruppenTurnier = (teams: number, groupCount: number, preset: FinalsPreset): Tournament => {
  const labels = ['A', 'B', 'C', 'D'];
  const teamList: Team[] = Array.from({ length: teams }, (_, index) => ({
    id: testUuid(index + 1),
    name: `Team ${index + 1}`,
    group: labels[index % groupCount],
  }));
  return {
    id: 'b05',
    title: 'B-05 Stichprobe',
    ageClass: 'U13',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'groupsAndFinals',
    groupSystem: 'groupsAndFinals',
    date: '2030-01-01',
    timeSlot: '09:00',
    startDate: '2030-01-01',
    startTime: '09:00',
    numberOfTeams: teams,
    numberOfFields: 2,
    numberOfGroups: groupCount,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    finalsConfig: { preset },
    placementLogic: [],
    teams: teamList,
    matches: [],
    status: 'published',
    publishedAt: '2026-10-04T08:00:00Z',
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' },
    createdAt: '2026-10-04T08:00:00Z',
    updatedAt: '2026-10-04T08:00:00Z',
  } as unknown as Tournament;
};

describe('@W4-020 Finalrunde „Alle Plätze“ zählt mit echten Gruppengrößen', () => {
  it('6 Teams in 2 Gruppen (3+3), Alle Plätze → 6 Gruppen- + 5 Finalspiele = 11', () => {
    expect(countTournamentMatches(6, { groupCount: 2, finalsPlan: 'all-places' })).toBe(11);
  });

  it('5 Teams in 2 Gruppen (3+2), Alle Plätze → 4 Gruppen- + 4 Finalspiele = 8', () => {
    expect(countTournamentMatches(5, { groupCount: 2, finalsPlan: 'all-places' })).toBe(8);
  });

  it('7 Teams in 2 Gruppen (4+3), Alle Plätze → 9 Gruppen- + 5 Finalspiele = 14', () => {
    expect(countTournamentMatches(7, { groupCount: 2, finalsPlan: 'all-places' })).toBe(14);
  });

  it('8 Teams in 2 Gruppen (4+4), Alle Plätze → 12 + 6 = 18', () => {
    expect(countTournamentMatches(8, { groupCount: 2, finalsPlan: 'all-places' })).toBe(18);
  });

  it('Stichprobe gegen generateFullSchedule: Zählung stimmt mit dem echten Spielplan überein', () => {
    const faelle: Array<[number, number, FinalsPreset]> = [
      [6, 2, 'all-places'],
      [5, 2, 'all-places'],
      [7, 2, 'all-places'],
      [8, 2, 'all-places'],
      [9, 2, 'all-places'],
      [8, 2, 'top-4'],
      [9, 2, 'top-4'],
      [8, 2, 'final-only'],
      [8, 2, 'none'],
      [8, 4, 'top-8'],
      [8, 4, 'all-places'],
      [12, 4, 'top-16'],
    ];
    for (const [teams, groups, preset] of faelle) {
      const tatsaechlich = generateFullSchedule(gruppenTurnier(teams, groups, preset)).allMatches
        .length;
      expect(countTournamentMatches(teams, { groupCount: groups, finalsPlan: preset })).toBe(
        tatsaechlich
      );
    }
  });
});

describe('@W4-020 Zeit-Empfehlung zählt tatsächliche Spiele', () => {
  it('8 Teams, 2 Gruppen à 4, Top 4 (HF + Platz 3 + Finale) → 16 Spiele', () => {
    const result = calculateRecommendation(10, 8, {}, { groupCount: 2, finalsPlan: 'top-4' });
    expect(result.recommendation?.totalMatches).toBe(16);
    expect(countTournamentMatches(8, { groupCount: 2, finalsPlan: 'top-4' })).toBe(16);
  });

  it('Gegenbeispiel: jeder gegen jeden über alle 8 Teams → 28 Spiele', () => {
    const result = calculateRecommendation(10, 8);
    expect(result.recommendation?.totalMatches).toBe(28);
    expect(countTournamentMatches(8)).toBe(28);
  });

  it('eine Gruppe ohne Finalrunde ist jeder gegen jeden → 28 Spiele', () => {
    expect(countTournamentMatches(8, { groupCount: 1, finalsPlan: 'none' })).toBe(28);
  });

  it('Gruppenphase ohne Finalrunde → 12 Gruppenspiele', () => {
    expect(countTournamentMatches(8, { groupCount: 2, finalsPlan: 'none' })).toBe(12);
  });

  it('ungleiche Gruppen: 9 Teams in 2 Gruppen 5+4 → 10 + 6 = 16 Gruppenspiele', () => {
    expect(countTournamentMatches(9, { groupCount: 2, finalsPlan: 'none' })).toBe(16);
  });

  it('ungleiche Gruppen mit Top 4 → 16 + 4 Finalspiele = 20', () => {
    expect(countTournamentMatches(9, { groupCount: 2, finalsPlan: 'top-4' })).toBe(20);
  });

  it('nur Finale (2 Gruppen) → 12 + 1 = 13', () => {
    expect(countTournamentMatches(8, { groupCount: 2, finalsPlan: 'final-only' })).toBe(13);
  });

  it('Finalrunde ohne Gruppen wird nicht gezählt (jeder gegen jeden)', () => {
    expect(countTournamentMatches(8, { finalsPlan: 'top-4' })).toBe(28);
  });
});

describe('@W4-020 Rechenkern: Grenzfälle und Fallback mit Spielstruktur', () => {
  it('Einschränkung nicht erfüllbar → constraintsImpossible mit Mindeststunden', () => {
    const result = calculateRecommendation(0.1, 8, { gameDuration: 10 });
    expect(result.recommendation).toBeNull();
    expect(result.constraintsImpossible).toBe(true);
    expect(result.minRequiredHours).toBeGreaterThan(0.1);
  });

  it('ohne Einschränkung zu wenig Zeit → Fallback mit reduzierten Teams, Spielzahl aus Struktur', () => {
    const result = calculateRecommendation(0.05, 8, {}, { groupCount: 2, finalsPlan: 'top-4' });
    // 8 Teams → floor(8 * 0.7) = 5 Teams in 2 Gruppen (3 + 2) → 3 + 1 Gruppenspiele, + 4 Finalspiele
    expect(result.constraintsImpossible).toBe(false);
    expect(result.recommendation?.teams).toBe(5);
    expect(result.recommendation?.totalMatches).toBe(8);
  });

  it('Einschränkung für Pause und Felder wird eingehalten', () => {
    const result = calculateRecommendation(10, 8, { breakDuration: 2, fields: 2 });
    expect(result.recommendation?.breakDuration).toBe(2);
    expect(result.recommendation?.fields).toBe(2);
  });

  it('ohne Einschränkung und ohne Struktur → Fallback zählt jeder gegen jeden', () => {
    const result = calculateRecommendation(0.05, 20);
    expect(result.recommendation?.teams).toBe(14);
    expect(result.recommendation?.totalMatches).toBe(91);
  });
});

describe('@W4-020 Hilfsfunktionen des Smart-Config-Moduls', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadStoredConfig liefert Standard ohne Eintrag und den gespeicherten Stand mit Eintrag', () => {
    expect(loadStoredConfig()).toEqual({ lastHours: 4 });
    saveStoredConfig({ lastHours: 2.5 });
    expect(loadStoredConfig().lastHours).toBe(2.5);
  });

  it('loadStoredConfig ignoriert defektes JSON und liefert Standard', () => {
    store.set('smartConfig', '{kaputt');
    expect(loadStoredConfig()).toEqual({ lastHours: 4 });
  });

  it('buildConstraintsList: Singular bei einem Feld (B-38 @W4-021: keine Gruppen mehr in der Liste)', () => {
    expect(buildConstraintsList({ teams: 8, fields: 1 })).toEqual(['8 Teams', '1 Feld']);
    expect(
      buildConstraintsList({ fields: 2, gameDuration: 10, breakDuration: 3 })
    ).toEqual(['2 Felder', '10 Min Spieldauer', '3 Min Pause']);
    expect(buildConstraintsList({ breakDuration: 3 })).toEqual(['3 Min Pause']);
  });
});
