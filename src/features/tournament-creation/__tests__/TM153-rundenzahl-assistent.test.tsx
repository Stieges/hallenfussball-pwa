/**
 * @TM-153 – Der Assistent zeigt bei mehreren Runden Spielzahl und Ende und warnt nur (Record 2026-10-01_turniermodi),
 * @TM-152 (Rundenzahl landet im gespeicherten Turnier). Tests aus dem Gherkin über den echten Bedienweg
 * `useTournamentWizard` → `Step2_ModeAndSystem` → `mapTournamentToSupabase`.
 * Gegeben: „Jeder gegen jeden“, 6 Teams, 10 Minuten je Spiel, Beginn 16:30. Pause zwischen den Spielen 0 – nur so ergibt
 * die Rechnung des Szenarios (45 · 10 Min ab 16:30) „Ende ca. 00:00“ (Lücke im Gegeben, im Bericht gemeldet).
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
  it('@TM-153 3 Runden: „45 Spiele · Ende ca. 00:00“ und der Hinweis gegen Mitternacht; Weiter bleibt möglich', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    tippe('3', sync);

    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('45 Spiele · Ende ca. 00:00');
    expect(screen.getByTestId('wizard-round-late-hint')).toHaveTextContent('Das Turnier endet erst gegen Mitternacht');
    expect(wizard.result.current.formData.numberOfRounds).toBe(3);
    // nur Hinweis, keine Sperre: der Schritt meldet keinen Fehler
    expect(wizard.result.current.validateStep(3)).toEqual([]);
    expect(screen.queryByTestId('wizard-round-count-hint')).toBeNull();
  });

  it('@TM-153 11 Runden: „Höchstens 10 Runden“, übernimmt 10', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf());
    tippe('11', sync);

    expect(screen.getByTestId('wizard-round-count-hint')).toHaveTextContent('Höchstens 10 Runden');
    expect(wizard.result.current.formData.numberOfRounds).toBe(10);
    expect(screen.getByTestId('wizard-round-count-input')).toHaveValue(10);
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('150 Spiele');
  });

  it('@TM-153 0 Runden: „Mindestens 1 Runde“, übernimmt 1', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf({ numberOfRounds: 2 }));
    tippe('0', sync);

    expect(screen.getByTestId('wizard-round-count-hint')).toHaveTextContent('Mindestens 1 Runde');
    expect(wizard.result.current.formData.numberOfRounds).toBe(1);
    expect(screen.getByTestId('wizard-round-count-input')).toHaveValue(1);
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('15 Spiele · Ende ca. 19:00');
  });

  it('@TM-153 Gegenbeispiel: vorbelegt ist 1 Runde, „15 Spiele · Ende ca. 19:00“ ohne Hinweis gegen Mitternacht', async () => {
    await zeigeSchritt(entwurf());

    expect(screen.getByTestId('wizard-round-count-input')).toHaveValue(1);
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('15 Spiele · Ende ca. 19:00');
    expect(screen.queryByTestId('wizard-round-late-hint')).toBeNull();
    expect(screen.queryByTestId('wizard-round-count-hint')).toBeNull();
  });

  it('@TM-153 Gegenbeispiel: mit den Tasten bleibt die Zahl zwischen 1 und 10, ohne Grenz-Hinweis', async () => {
    const { wizard, sync } = await zeigeSchritt(entwurf({ numberOfRounds: 10 }));

    expect(screen.getByTestId('wizard-round-count-increase')).toBeDisabled();
    fireEvent.click(screen.getByTestId('wizard-round-count-decrease'));
    sync();
    expect(wizard.result.current.formData.numberOfRounds).toBe(9);
    expect(screen.queryByTestId('wizard-round-count-hint')).toBeNull();
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
});
