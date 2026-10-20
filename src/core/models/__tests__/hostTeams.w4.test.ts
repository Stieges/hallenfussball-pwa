/**
 * Markierung „Mannschaft des Veranstalters“ und Wahl der Eröffnung – Modell und Logik (ohne Oberfläche).
 * Record docs/anforderungen/2026-09-27_wizard-zeitrahmen-fairness.md: @W4-034, @W4-041, @W4-044, dazu
 * @W4-027/@W4-033 über den ganzen Spielplan (generateFullSchedule).
 */
import { describe, expect, it } from 'vitest';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import type { Team, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../generators/scheduleGenerator';
import { effectiveHostTeamIds, hostOpeningInfo } from '../hostTeams';
import { TournamentSchema } from '../schemas/TournamentSchema';
import { TournamentCreationService } from '../../services/TournamentCreationService';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';

function teams(n: number, groups: string[] = ['A']): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: testUuid(i + 1),
    name: i === 0 ? 'TSV Waging rot' : i === 1 ? 'TSV Waging blau' : `Gast ${i - 1}`,
    group: groups[i % groups.length],
    players: [],
  }));
}

function tournament(overrides: Partial<Tournament>): Tournament {
  return createMockTournament({ sportId: 'football-indoor', numberOfFields: 1, groupSystem: 'roundRobin', teams: teams(6), ...overrides });
}

/** Prüfung wie beim lokalen Laden (LocalStorageRepository: TournamentSchema.safeParse). */
function parse(raw: unknown): { hostTeamIds?: string[]; openingMode?: string } | null {
  const result = TournamentSchema.safeParse(raw);
  return result.success ? result.data : null;
}

const ROT = testUuid(1);
const BLAU = testUuid(2);

describe('@W4-034 Mannschaften des Veranstalters werden beim Anlegen markiert (Modell)', () => {
  it('die Markierung ist am Turnier gespeichert und übersteht die Prüfung (Zod)', () => {
    const parsed = parse(tournament({ hostTeamIds: [ROT], openingMode: 'club-derby' }));

    expect(parsed?.hostTeamIds).toEqual([ROT]);
    expect(parsed?.openingMode).toBe('club-derby');
  });

  it('eine ungültige Eröffnungswahl macht das Turnier nicht ungültig, sie wird verworfen', () => {
    const raw = { ...tournament({}), openingMode: 'unbekannt', hostTeamIds: 'kaputt' };
    const parsed = parse(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.openingMode).toBeUndefined();
    expect(parsed?.hostTeamIds).toBeUndefined();
  });

  it('genau eine markierte Mannschaft: keine Wahl, nur der Hinweis mit ihr', () => {
    const info = hostOpeningInfo({ hostTeamIds: [ROT], teams: teams(6), roundsPlan: true });

    expect(info).toEqual({ hostTeamIds: [ROT], openingChoice: false });
  });

  it('zwei markierte Mannschaften in einem Rundenplan: die Wahl erscheint', () => {
    const info = hostOpeningInfo({ hostTeamIds: [BLAU, ROT], teams: teams(6), roundsPlan: true });

    expect(info).toEqual({ hostTeamIds: [ROT, BLAU], openingChoice: true });
  });

  it('zwei markierte Mannschaften in verschiedenen Gruppen: keine Wahl (@W4-033)', () => {
    const info = hostOpeningInfo({ hostTeamIds: [ROT, BLAU], teams: teams(12, ['A', 'B']), roundsPlan: true });

    expect(info.openingChoice).toBe(false);
  });
});

describe('@W4-041 Wo kein Rundenplan entsteht, bietet der Assistent die Wahl des Eröffnungsspiels nicht an (Logik)', () => {
  it('6 Teams auf 2 Feldern, beide markiert: kein Rundenplan, keine Wahl, Hinweis nennt beide', () => {
    const t = tournament({ numberOfFields: 2, hostTeamIds: [ROT, BLAU] });
    const schedule = generateFullSchedule(t);
    const info = hostOpeningInfo({ hostTeamIds: t.hostTeamIds, teams: t.teams, roundsPlan: schedule.roundsPlan });

    expect(schedule.roundsPlan).toBe(false);
    expect(info).toEqual({ hostTeamIds: [ROT, BLAU], openingChoice: false });
    expect([ROT, BLAU]).toContain(schedule.allMatches[0].originalTeamA);
  });

  it('Gegenbeispiel: 6 Teams auf einem Feld ergeben einen Rundenplan und die Wahl', () => {
    const t = tournament({ hostTeamIds: [ROT, BLAU] });
    const schedule = generateFullSchedule(t);

    expect(schedule.roundsPlan).toBe(true);
    expect(hostOpeningInfo({ hostTeamIds: t.hostTeamIds, teams: t.teams, roundsPlan: schedule.roundsPlan }).openingChoice).toBe(true);
  });
});

describe('@W4-044 Eine gelöschte oder abgewählte Mannschaft des Veranstalters hinterlässt keine Regel (Logik)', () => {
  it('blau gelöscht: nur noch rot markiert, die Wahl verschwindet, der Hinweis nennt rot', () => {
    const ohneBlau = teams(6).filter((t) => t.id !== BLAU);

    expect(effectiveHostTeamIds([ROT, BLAU], ohneBlau)).toEqual([ROT]);
    expect(hostOpeningInfo({ hostTeamIds: [ROT, BLAU], teams: ohneBlau, roundsPlan: true }))
      .toEqual({ hostTeamIds: [ROT], openingChoice: false });
  });

  it('beim Speichern (Entwurf) wird die Markierung der gelöschten Mannschaft entfernt', () => {
    const service = new TournamentCreationService({} as ITournamentRepository);
    const draft = service.createDraft({ teams: teams(6).filter((t) => t.id !== BLAU), hostTeamIds: [ROT, BLAU] });

    expect(draft.hostTeamIds).toEqual([ROT]);
  });

  it('auch rot abgewählt: derselbe Spielplan wie ohne Markierung', () => {
    const ohne = generateFullSchedule(tournament({}));
    const abgewaehlt = generateFullSchedule(tournament({ hostTeamIds: [], openingMode: 'club-derby' }));

    expect(abgewaehlt.allMatches.map((m) => `${m.originalTeamA}-${m.originalTeamB}`))
      .toEqual(ohne.allMatches.map((m) => `${m.originalTeamA}-${m.originalTeamB}`));
  });

  it('Reihenfolge bei mehr als zwei Markierungen ist die Teamliste, doppelte Einträge zählen einmal', () => {
    const list = teams(6);

    expect(effectiveHostTeamIds([list[4].id, ROT, list[4].id, BLAU], list)).toEqual([ROT, BLAU, list[4].id]);
  });
});

describe('@W4-027/@W4-033 über den ganzen Spielplan (generateFullSchedule)', () => {
  it('rot und blau markiert, Vereinsduell eröffnet: Spiel 1 ist rot gegen blau', () => {
    const schedule = generateFullSchedule(tournament({ hostTeamIds: [ROT, BLAU], openingMode: 'club-derby' }));

    expect([schedule.allMatches[0].originalTeamA, schedule.allMatches[0].originalTeamB]).toEqual([ROT, BLAU]);
    expect(schedule.allMatches[0].homeTeam).toBe('TSV Waging rot');
  });

  it('ohne Wahl: eine Waging-Mannschaft eröffnet als Heim gegen einen Gast', () => {
    const schedule = generateFullSchedule(tournament({ hostTeamIds: [ROT, BLAU] }));

    expect([ROT, BLAU]).toContain(schedule.allMatches[0].originalTeamA);
    expect([ROT, BLAU]).not.toContain(schedule.allMatches[0].originalTeamB);
    expect(schedule.scheduleNotices).toEqual([]);
  });
});
