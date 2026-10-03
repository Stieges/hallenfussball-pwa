/**
 * A-04a (MVP-Bauplan, Spur A) – der Spielplan zeigt Spielseiten über `slotLabel`.
 * @TM-015 „Ein unbesetzter Platz zeigt seine Herkunft“ – Ansicht „der Spielplan der Turnierleitung“.
 *
 * Echte i18n-Instanz (DE/EN) für `slotLabel`; die Komponenten-Texte (react-i18next) liefern Schlüssel.
 * Der im Spiel gespeicherte Anzeigetext (`homeTeam/awayTeam`) ist in den Fixtures absichtlich VERALTET –
 * wird er gelesen, zeigt der Spielplan den alten Namen (Mutation „homeTeam aus gespeichertem Namen“).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import type { ScheduledMatch } from '../../../core/generators';
import { teamSlot, pendingSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { FinalStageSchedule } from '../FinalStageSchedule';
import { DesktopCard } from '../DesktopCard';
import { GroupStageSchedule } from '../GroupStageSchedule';
import { SortableMobileCard } from '../SortableMobileCard';
import { ScheduleDisplay } from '../../ScheduleDisplay';
import { SortableDesktopCard } from '../SortableDesktopCard';
import type { GeneratedSchedule } from '../../../core/generators';
import { buildSideContext, sideDisplay, sideName } from '../matchSides';

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

// Live-Daten sind hier nicht Gegenstand (kein Repository-Provider im Test)
vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const NORD = testUuid(1);
const UFER = testUuid(2);
const SEMI1 = testUuid(101);
const SEMI2 = testUuid(102);
const FINAL = testUuid(103);

function scheduled(partial: Partial<ScheduledMatch> & Pick<ScheduledMatch, 'id'>): ScheduledMatch {
  const start = new Date('2026-10-03T10:00:00');
  return {
    matchNumber: 1,
    time: '10:00',
    field: 1,
    homeTeam: 'ALTER NAME HEIM',
    awayTeam: 'ALTER NAME GAST',
    originalTeamA: 'alt-a',
    originalTeamB: 'alt-b',
    phase: 'semifinal',
    startTime: start,
    endTime: start,
    duration: 10,
    ...partial,
  };
}

const semi1 = scheduled({
  id: SEMI1,
  label: '1. Halbfinale',
  matchNumber: 7,
  slotA: pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 }),
  slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }),
});
const semi2 = scheduled({
  id: SEMI2,
  label: '2. Halbfinale',
  matchNumber: 8,
  slotA: teamSlot(NORD),
  slotB: teamSlot(UFER),
});
const finale = scheduled({
  id: FINAL,
  label: 'Finale',
  matchNumber: 9,
  finalType: 'final',
  phase: 'final',
  slotA: pendingSlot({ kind: 'matchResult', matchId: SEMI1, role: 'winner' }),
  slotB: pendingSlot({ kind: 'matchResult', matchId: SEMI2, role: 'winner' }),
});

const teams = [
  { id: NORD, name: 'FC Nord' },
  { id: UFER, name: 'VfB Ufer' },
];
const shown = [semi1, semi2, finale];

beforeEach(async () => {
  await i18next.changeLanguage('de');
});

describe('Spielplan (Finalrunde) zeigt Spielseiten über slotLabel', () => {
  it('@TM-015 Spielplan der Turnierleitung: Halbfinale 1 zeigt „Erster Gruppe A“ gegen „Zweiter Gruppe B“', () => {
    render(<FinalStageSchedule matches={shown} tournament={{ teams }} />);
    expect(screen.getAllByText('Erster Gruppe A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zweiter Gruppe B').length).toBeGreaterThan(0);
  });

  it('@TM-015 Pflichttest: offene Finalseite zeigt den Sieger des Halbfinales (Wortlaut aus der i18n-Datei)', () => {
    render(<FinalStageSchedule matches={shown} tournament={{ teams }} />);
    expect(screen.getAllByText('Sieger 1. Halbfinale').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sieger 2. Halbfinale').length).toBeGreaterThan(0);
  });

  it('@TM-015 Pflichttest in EN: kein deutscher Text in der Herkunft', async () => {
    await i18next.changeLanguage('en');
    render(<FinalStageSchedule matches={shown} tournament={{ teams }} />);
    expect(screen.getAllByText('Winner of Semifinal 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sieger|Halbfinale/)).toBeNull();
  });

  it('@TM-015 Gegenbeispiel: nach Umbenennen eines Teams zeigt der Spielplan den neuen Namen, nicht den gespeicherten', () => {
    const renamed = [{ id: NORD, name: 'FC Nordlicht' }, teams[1]];
    render(<FinalStageSchedule matches={shown} tournament={{ teams: renamed }} />);
    expect(screen.getAllByText('FC Nordlicht').length).toBeGreaterThan(0);
    expect(screen.queryByText('FC Nord')).toBeNull();
    expect(screen.queryByText(/ALTER NAME/)).toBeNull();
  });

  it('@TM-015 Gegenbeispiel: Spiel ohne Slot (Altdaten) zeigt „?“, nie den gespeicherten Namen', () => {
    const ohneSlot = scheduled({ id: SEMI2, label: '2. Halbfinale' });
    render(<FinalStageSchedule matches={[ohneSlot]} tournament={{ teams }} />);
    expect(screen.queryByText(/ALTER NAME/)).toBeNull();
    expect(screen.getAllByText('?').length).toBeGreaterThan(0);
  });
});

describe('Spielplan-Karten (Gruppenphase) zeigen Spielseiten über slotLabel', () => {
  const groupMatch = scheduled({
    id: SEMI2,
    phase: 'groupStage',
    label: undefined,
    slotA: teamSlot(NORD),
    slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 1 }),
  });
  const tournament = { teams, matches: [] as never[] };
  const noop = vi.fn();

  it('@TM-015 DesktopCard: Teamname über Team-ID, offene Seite über Herkunft', () => {
    render(
      <DesktopCard
        match={groupMatch}
        status="scheduled"
        isExpanded={false}
        tournament={tournament as never}
        onCardClick={noop}
        onCircleClick={noop}
        renderExpandContent={() => null}
      />,
    );
    expect(screen.getAllByText('FC Nord').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Erster Gruppe B').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ALTER NAME/)).toBeNull();
  });

  it('@TM-015 Gegenbeispiel DesktopCard: nach Umbenennen zeigt die Karte den neuen Namen', () => {
    render(
      <DesktopCard
        match={groupMatch}
        status="scheduled"
        isExpanded={false}
        tournament={{ ...tournament, teams: [{ id: NORD, name: 'FC Nordlicht' }] } as never}
        onCardClick={noop}
        onCircleClick={noop}
        renderExpandContent={() => null}
      />,
    );
    expect(screen.getAllByText('FC Nordlicht').length).toBeGreaterThan(0);
    expect(screen.queryByText('FC Nord')).toBeNull();
  });

  it('@TM-015 SortableDesktopCard (Bearbeiten-Modus): Seiten über slotLabel', () => {
    render(
      <SortableDesktopCard
        match={groupMatch}
        status="scheduled"
        displayedRef={undefined}
        displayedField={1}
        hasUnsavedChanges={false}
        hasPendingRef={false}
        hasPendingField={false}
        conflicts={[]}
        editingSchedule={false}
        canSwap={false}
        tournament={tournament as never}
        showReferees={false}
        refereeOptions={[]}
        showFields={false}
        fieldOptions={[]}
      />,
    );
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.getByText('Erster Gruppe B')).toBeInTheDocument();
  });
});

describe('matchSides (Helfer)', () => {
  const ctx = buildSideContext({ teams }, shown);

  it('@TM-015 besetzte Seite: Team-ID als id, nicht offen', () => {
    expect(sideDisplay(semi2, 'A', ctx)).toMatchObject({ id: NORD, name: 'FC Nord', pending: false });
  });

  it('@TM-015 offene Seite: eigene id je Spiel und Seite, offen', () => {
    expect(sideDisplay(semi1, 'B', ctx)).toMatchObject({ id: `${SEMI1}:B`, pending: true });
    expect(sideName(semi1, 'B', ctx)).toBe('Zweiter Gruppe B');
  });

  it('@TM-015 Vorgängerspiel nur im Turnier gespeichert: wird gefunden', () => {
    const fromStore = buildSideContext({ teams, matches: [{ id: SEMI1, label: '1. Halbfinale' }] }, [finale]);
    expect(sideName(finale, 'A', fromStore)).toBe('Sieger 1. Halbfinale');
  });
});

describe('Spielplan – Gruppenphase und Karten (weitere Ansichten)', () => {
  const groupMatch = scheduled({
    id: SEMI2, phase: 'groupStage', label: undefined,
    slotA: teamSlot(NORD), slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 1 }),
  });
  const tournament = { id: 't1', teams, matches: [], groups: [] } as never;
  const noop = vi.fn();

  it('@TM-015 GroupStageSchedule: Namen über slotLabel; Gegenbeispiel: nach Umbenennen der neue Name, nie der gespeicherte', () => {
    const renamed = { ...(tournament as object), teams: [{ id: NORD, name: 'FC Nordlicht' }, teams[1]] } as never;
    render(<GroupStageSchedule matches={[groupMatch]} hasGroups={false} tournament={renamed} />);
    expect(screen.getAllByText('FC Nordlicht').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Erster Gruppe B').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ALTER NAME/)).toBeNull();
    expect(screen.queryByText('FC Nord')).toBeNull();
  });

  it('@TM-015 SortableMobileCard: Seiten über slotLabel', () => {
    render(
      <SortableMobileCard
        match={groupMatch}
        status="scheduled"
        isExpanded={false}
        displayedRef={undefined}
        displayedField={1}
        hasUnsavedChanges={false}
        hasPendingField={false}
        conflicts={[]}
        editingSchedule={false}
        canSwap={false}
        tournament={tournament}
        showReferees={false}
        refereeOptions={[]}
        showFields={false}
        fieldOptions={[]}
        onCardClick={noop}
        onCircleClick={noop}
        renderExpandContent={() => null}
      />,
    );
    expect(screen.getAllByText('FC Nord').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Erster Gruppe B').length).toBeGreaterThan(0);
  });

  it('@TM-015 ScheduleDisplay (Container): Finalspiele zeigen die Herkunft, auch wenn ein Filter das Vorgängerspiel ausblendet', () => {
    const schedule = {
      tournament: { id: 't1', title: 'Hallencup', date: '2026-10-03', location: { name: 'Halle' }, ageClass: 'U11', groups: [] },
      allMatches: [semi1, finale],
      phases: [{ name: 'final', label: 'Finalrunde', matches: [semi1, finale], startTime: new Date(), endTime: new Date() }],
      teams: teams.map((team) => ({ ...team, group: undefined })),
      initialStandings: [],
      numberOfFields: 1,
      startTime: new Date('2026-10-03T10:00:00'),
      endTime: new Date('2026-10-03T12:00:00'),
    } as unknown as GeneratedSchedule;
    render(<ScheduleDisplay schedule={schedule} visibleMatchIds={new Set([FINAL])} />);
    expect(screen.getAllByText('Sieger 1. Halbfinale').length).toBeGreaterThan(0);
  });
});
