/**
 * @TM-153 – Der Assistent zeigt bei mehreren Runden Spielzahl und Ende und warnt nur (Record 2026-10-01_turniermodi),
 * @TM-152 (Rundenzahl landet im gespeicherten Turnier). Tests aus dem Gherkin über den echten Bedienweg
 * `useTournamentWizard` → `Step2_ModeAndSystem` → `mapTournamentToSupabase`.
 * Gegeben: „Jeder gegen jeden“, 6 Teams, 10 Minuten je Spiel, ohne Pause zwischen den Spielen, Beginn 16:30
 * (Record-Stand 31.10.). Kein Hinweis „gegen Mitternacht“ (nie freigegeben, ausgebaut).
 * „Ende ca.“ = Ende des erzeugten Plans (Review #423 R2: auch bei mehreren Feldern, ungerader Teamzahl).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { Step2_ModeAndSystem } from '../Step2_ModeAndSystem';
import { mapTournamentToSupabase } from '../../../core/repositories/supabaseMappers';
import { defaultPlacementLogic } from '../../../core/standings/placementDefaults';
import type { Tournament } from '../../../types/tournament';
import { ToastProvider } from '../../../components/ui/Toast/ToastContext';
import { i18nWrapper } from '../../tournament-management/standings/__tests__/tieTestKit';
import { generateFullSchedule } from '../../../core/generators';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';
import type { ITournamentRepository } from '../../../core/repositories';
import { testUuid } from '../../../test/testIds';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

const entwurf = (over: Partial<Tournament> = {}): Tournament => ({
  id: 'turnier-tm153',
  title: 'Nikolaus-Turnier',
  date: '2030-12-06',
  startTime: '16:30',
  timeSlot: '16:30',
  location: { name: 'Halle' },
  numberOfTeams: 6,
  numberOfGroups: 1,
  numberOfFields: 1,
  mode: 'classic',
  placementLogic: defaultPlacementLogic(),
  groupSystem: 'roundRobin',
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 0,
  teams: [],
  matches: [],
  status: 'draft',
  lastVisitedStep: 3,
  ...over,
}) as unknown as Tournament;

async function zeigeSchritt(tournament: Tournament) {
  const Wrapper = await i18nWrapper('de');
  const wizard = renderHook(() => useTournamentWizard(tournament, () => Promise.resolve(false)));
  const props = () => ({
    formData: wizard.result.current.formData,
    onUpdate: wizard.result.current.updateForm,
    onMovePlacementLogic: wizard.result.current.movePlacementLogic,
    onTogglePlacementLogic: wizard.result.current.togglePlacementLogic,
    onReorderPlacementLogic: wizard.result.current.reorderPlacementLogic,
  });
  const view = render(<Wrapper><ToastProvider><Step2_ModeAndSystem {...props()} /></ToastProvider></Wrapper>);
  const sync = () => view.rerender(<Wrapper><ToastProvider><Step2_ModeAndSystem {...props()} /></ToastProvider></Wrapper>);
  return { wizard, sync };
}

const tippe = (wert: string, sync: () => void) => {
  fireEvent.change(screen.getByTestId('wizard-round-count-input'), { target: { value: wert } });
  sync();
};

describe('@TM-153 Rundenzahl im Assistenten (Jeder gegen jeden, 6 Teams, 10 Min, Beginn 16:30)', () => {
  it('@TM-153 3 Runden: „45 Spiele · Ende ca. 00:00“; Weiter bleibt möglich', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    tippe('3', sync);

    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent(/^45 Spiele · Ende ca\. 00:00$/);
    expect(wizard.result.current.formData.numberOfRounds).toBe(3);
    // keine Sperre: der Schritt meldet keinen Fehler
    expect(wizard.result.current.validateStep(3)).toEqual([]);
    expect(screen.getByTestId('wizard-round-count-hint')).toBeEmptyDOMElement();
    expect(screen.queryByText(/Mitternacht/)).toBeNull();
  });

  it.each([
    { teams: 7, fields: 2 },
    { teams: 10, fields: 3 },
    { teams: 9, fields: 3 },
  ])('@TM-153 „Ende ca.“ ist das Ende des erzeugten Plans: $teams Teams, $fields Felder, 3 Runden, 2 Min Pause', async ({ teams, fields }) => {
    const over = { numberOfTeams: teams, numberOfFields: fields, groupPhaseBreakDuration: 2 };
    const { sync } = await zeigeSchritt(entwurf(over));
    tippe('3', sync);

    const plan = generateFullSchedule(entwurf({
      ...over,
      numberOfRounds: 3,
      teams: Array.from({ length: teams }, (_, i) => ({ id: testUuid(i + 1), name: `Team ${String(i + 1)}` })),
    }));
    const ende = new Date(Math.max(...plan.allMatches.map((m) => m.endTime.getTime())));
    const uhr = `${String(ende.getHours()).padStart(2, '0')}:${String(ende.getMinutes()).padStart(2, '0')}`;
    expect(plan.allMatches).toHaveLength(3 * (teams * (teams - 1)) / 2);
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent(`${String(plan.allMatches.length)} Spiele · Ende ca. ${uhr}`);
  });

  it('@TM-153 11 Runden: „Höchstens 10 Runden“, übernimmt 10', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    tippe('11', sync);

    expect(screen.getByTestId('wizard-round-count-hint')).toHaveTextContent('Höchstens 10 Runden');
    expect(wizard.result.current.formData.numberOfRounds).toBe(10);
    expect(screen.getByTestId('wizard-round-count-input')).toHaveValue('10');
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('150 Spiele');
  });

  it('@TM-153 0 Runden: „Mindestens 1 Runde“, übernimmt 1', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf({ numberOfRounds: 2 }));
    tippe('0', sync);

    expect(screen.getByTestId('wizard-round-count-hint')).toHaveTextContent('Mindestens 1 Runde');
    expect(wizard.result.current.formData.numberOfRounds).toBe(1);
    expect(screen.getByTestId('wizard-round-count-input')).toHaveValue('1');
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('15 Spiele · Ende ca. 19:00');
  });

  it('@TM-153 Gegenbeispiel: vorbelegt ist 1 Runde, „15 Spiele · Ende ca. 19:00“ ohne Grenz-Hinweis', async () => {
    await zeigeSchritt(entwurf());

    expect(screen.getByTestId('wizard-round-count-input')).toHaveValue('1');
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('15 Spiele · Ende ca. 19:00');
    expect(screen.getByTestId('wizard-round-count-hint')).toBeEmptyDOMElement();
  });

  it('@TM-153 die Eingabe ist ein Textfeld mit Ziffern-Tastatur (keine Drehpfeile), Buchstaben werden ignoriert', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    const input = screen.getByTestId('wizard-round-count-input');

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('Runden')).toBe(input);
    tippe('4x', sync);
    expect(wizard.result.current.formData.numberOfRounds).toBe(4);
  });

  it('@TM-153 Gegenbeispiel: mit den Tasten bleibt die Zahl zwischen 1 und 10, ohne Grenz-Hinweis', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf({ numberOfRounds: 10 }));

    expect(screen.getByTestId('wizard-round-count-increase')).toBeDisabled();
    fireEvent.click(screen.getByTestId('wizard-round-count-decrease'));
    sync();
    expect(wizard.result.current.formData.numberOfRounds).toBe(9);
    expect(screen.getByTestId('wizard-round-count-hint')).toBeEmptyDOMElement();
  });

  it('@TM-153 Gegenbeispiel: bei „Gruppen + Finalrunde“ gibt es keine Rundenzahl (@TM-140 später)', async () => {
    await zeigeSchritt(entwurf({ groupSystem: 'groupsAndFinals', numberOfGroups: 2 }));

    expect(screen.queryByTestId('wizard-round-count-input')).toBeNull();
    expect(screen.queryByTestId('wizard-round-summary')).toBeNull();
  });

  it('@TM-152 die Rundenzahl landet im gespeicherten Turnier (Spalte config)', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    tippe('3', sync);

    const { tournamentRow } = mapTournamentToSupabase(wizard.result.current.formData as Tournament, 'owner-1');
    expect((tournamentRow.config as { numberOfRounds?: number }).numberOfRounds).toBe(3);
  });

  it('@TM-152 Assistent → Veröffentlichen: der gespeicherte Spielplan hat 45 Spiele, jede Paarung dreimal', async () => {
    const teams = Array.from({ length: 6 }, (_, i) => ({ id: testUuid(i + 1), name: `Team ${String(i + 1)}` }));
    const { wizard, sync } = await zeigeSchritt(entwurf({ teams }));
    tippe('3', sync);

    const repository = { get: vi.fn(() => Promise.resolve(null)), save: vi.fn(() => Promise.resolve()) } as unknown as ITournamentRepository;
    const published = await new TournamentCreationService(repository).publish(wizard.result.current.formData);
    const { matchRows } = mapTournamentToSupabase(published, 'owner-1');

    expect(published.matches).toHaveLength(45);
    expect(matchRows).toHaveLength(45);
    const pairs = new Map<string, number>();
    for (const m of matchRows) {
      const key = [m.team_a_id, m.team_b_id].sort().join('|');
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    expect(pairs.size).toBe(15);
    expect([...pairs.values()].every((c) => c === 3)).toBe(true);
  });
});
