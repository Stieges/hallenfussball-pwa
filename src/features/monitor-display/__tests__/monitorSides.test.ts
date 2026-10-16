/**
 * Spielseiten im Monitor und in der Zuschauer-Spielplanliste (@TM-015 „Ein unbesetzter Platz zeigt seine Herkunft“,
 * @TM-036 Kindermodus). Pflicht-Weg: offene Gruppen-Seite → „Erster Gruppe A“, nie „TBD“; Kindermodus → „noch offen“.
 *
 * Diese Datei ersetzt den globalen i18next-Mock durch eine echte Instanz mit den DE/EN-Texten (wie slotLabel.test.ts).
 */
import { describe, it, expect, vi } from 'vitest';
import { monitorSideName, monitorSideTeam } from '../monitorSides';
import { toLiveMatch } from '../monitorMatch';
import { buildSideContext, sideName } from '../../../components/schedule/matchSides';
import { pendingSlot, teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { FIXTURE_MATCHES, buildTournament } from './monitorFixture';
import type { Match, Team } from '../../../types/tournament';

vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../i18n/locales/de/tournament.json')).default;
  const en = (await import('../../../i18n/locales/en/tournament.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({
    lng: 'de',
    fallbackLng: false,
    resources: { de: { tournament: de }, en: { tournament: en } },
    interpolation: { escapeValue: false },
  });
  return { default: instance };
});

const NORD = testUuid(1);
const SEMI1_ID = testUuid(101);
const teams: Team[] = [
  { id: NORD, name: 'FC Nord' },
  { id: testUuid(2), name: 'SV Ost' },
];

/** Gruppen-Halbfinale: A-Erster gegen B-Zweiter, beide Seiten offen. */
function openSemi(): Match {
  return {
    ...FIXTURE_MATCHES[0],
    id: SEMI1_ID,
    label: '1. Halbfinale',
    slotA: pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 }),
    slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }),
  };
}

describe('monitorSideName – offene Seiten zeigen die Herkunft', () => {
  it('Gruppenplatz offen → „Erster Gruppe A“ / „Zweiter Gruppe B“, nie „TBD“', () => {
    const match = openSemi();
    const tournament = buildTournament({ teams, matches: [match] });
    expect(monitorSideName(match, 'A', tournament)).toBe('Erster Gruppe A');
    expect(monitorSideName(match, 'B', tournament)).toBe('Zweiter Gruppe B');
  });

  it('Sieger eines Vorgängerspiels → „Sieger 1. Halbfinale“', () => {
    const previous = { ...openSemi(), id: testUuid(102), label: '1. Halbfinale' };
    const next: Match = {
      ...openSemi(),
      id: testUuid(103),
      slotA: pendingSlot({ kind: 'matchResult', matchId: previous.id, role: 'winner' }),
      slotB: teamSlot(NORD),
    };
    const tournament = buildTournament({ teams, matches: [previous, next] });
    expect(monitorSideName(next, 'A', tournament)).toBe('Sieger 1. Halbfinale');
  });

  it('Gegenbeispiel: besetzte Seite zeigt den Teamnamen, nie die Herkunft', () => {
    const match: Match = { ...openSemi(), slotA: teamSlot(NORD) };
    const tournament = buildTournament({ teams, matches: [match] });
    expect(monitorSideName(match, 'A', tournament)).toBe('FC Nord');
    expect(monitorSideTeam(match, 'A', teams)?.name).toBe('FC Nord');
    expect(monitorSideTeam(openSemi(), 'A', teams)).toBeUndefined();
  });
});

describe('Kindermodus (hideScoresForPublic) – keine Herkunft mit Platz', () => {
  it('offene Seite → „noch offen“, nie die Herkunft', () => {
    const match = openSemi();
    const tournament = buildTournament({ teams, matches: [match], hideScoresForPublic: true });
    expect(monitorSideName(match, 'A', tournament)).toBe('noch offen');
    expect(monitorSideName(match, 'B', tournament)).toBe('noch offen');
  });

  it('besetzte Seite bleibt beim Teamnamen', () => {
    const match: Match = { ...openSemi(), slotA: teamSlot(NORD) };
    const tournament = buildTournament({ teams, matches: [match], hideScoresForPublic: true });
    expect(monitorSideName(match, 'A', tournament)).toBe('FC Nord');
    expect(monitorSideName(match, 'B', tournament)).toBe('noch offen');
  });

  it('Zuschauer-Spielplan (Side-Kontext) zeigt ebenfalls „noch offen“', () => {
    const match = openSemi();
    const ctx = buildSideContext({ teams, groups: [], matches: [match], hidePendingOrigin: true }, [match]);
    expect(sideName(match, 'A', ctx)).toBe('noch offen');
  });

  it('ohne Kindermodus bleibt die Herkunft sichtbar', () => {
    const match = openSemi();
    const ctx = buildSideContext({ teams, groups: [], matches: [match], hidePendingOrigin: false }, [match]);
    expect(sideName(match, 'A', ctx)).toBe('Erster Gruppe A');
  });
});

describe('Monitor-Live-Match (toLiveMatch)', () => {
  it('offene Seite trägt Herkunft als Anzeigename, nicht „TBD“', () => {
    const match = openSemi();
    const tournament = buildTournament({ teams, matches: [match] });
    const live = toLiveMatch(match, teams, tournament);
    expect(live.homeTeam.name).toBe('Erster Gruppe A');
    expect(live.awayTeam.name).toBe('Zweiter Gruppe B');
  });

  it('besetzte Seite liefert das Team-Objekt (Logo/Farben bleiben erhalten)', () => {
    const match: Match = { ...openSemi(), slotA: teamSlot(NORD) };
    const tournament = buildTournament({ teams, matches: [match] });
    const live = toLiveMatch(match, teams, tournament);
    expect(live.homeTeam).toEqual(teams[0]);
  });
});
