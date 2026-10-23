/**
 * A-08f3e4 Fixrunde 1 (I-1) – @FU-090 Beispiel „im Assistenten den Spielplan neu erzeugen“ auf dem echten Weg: Ein bestehendes
 * Turnier öffnet nach einer Strukturänderung die Neuplanung (`TournamentCreationScreen` → `openReplan`). Gegeben Spiel 7 hat
 * Einträge (hier: nur ein SKIP – ein abgesetztes Spiel gilt beim Anpfiff-Zustand als „nicht angepfiffen“) · Wenn Olli den Spielplan
 * neu erzeugen will · Dann führt die App es nicht aus und zeigt „Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen“ ·
 * Und Spiel 7 behält seine Einträge. Gegenbeispiel: ohne Einträge öffnet die Neuplanung wie heute.
 * Aufbau wie `replan.integration.test.tsx`, dazu echte Spiel-Engine (fake-indexeddb) und echte DE-Texte.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';

vi.unmock('i18next');
vi.unmock('react-i18next');

const spies = vi.hoisted(() => ({
  publishTournament: vi.fn<(override?: Partial<Tournament>) => Promise<Tournament>>(), setFormData: vi.fn(), onSave: vi.fn(),
  existing: undefined as Tournament | undefined, startState: 'not-started',
  recheck: vi.fn<() => Promise<'not-started' | 'started' | 'unknown'>>(), formDataOverride: undefined as Partial<Tournament> | undefined,
}));

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: null }));

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({ save: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)), getAll: vi.fn(() => Promise.resolve([])), delete: vi.fn(() => Promise.resolve()) }),
}));

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()) }),
}));

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

vi.mock('../../../hooks/useTournamentStartState', () => ({
  useTournamentStartState: () => ({ state: spies.startState, recheck: spies.recheck }),
}));

// AuthSection liest useRepositories() (useGuardedLogout); hier ohne Konto-Queue.
vi.mock('../../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: {} }),
}));

vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

vi.mock('../../../components/ScheduleDisplay', () => ({ ScheduleDisplay: () => <div data-testid="schedule-display-stub" /> }));
vi.mock('../../../components/RefereeAssignmentEditor', () => ({ RefereeAssignmentEditor: () => <div data-testid="referee-editor-stub" /> }));

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1', email: 'o@example.org', name: 'Olli' }, signIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock('../../../features/auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, members: [], isLoading: false }),
}));

vi.mock('../../../hooks/useTournamentWizard', () => ({
  useTournamentWizard: (t?: Tournament) => {
    const base = t ?? spies.existing;
    if (!base) { throw new Error('Test-Setup fehlt: existingTournament'); }
    // formData spiegelt die Strukturänderung: Feld hinzufügen (1 → 2)
    const formData = spies.formDataOverride ?? { ...base, numberOfFields: 2 };
    return {
      step: 6, formData, visitedSteps: new Set([1, 2, 3, 4, 5, 6]), stepErrors: {}, scheduleError: null, hasResults: false,
      lastSavedDataRef: { current: '' },
      setStep: vi.fn(), setFormData: spies.setFormData, setScheduleError: vi.fn(), updateForm: vi.fn(),
      handleStepChange: vi.fn(), handleNavigateToStep: vi.fn(), canGoNext: () => true, canNavigateToStep: () => true,
      validateStep: () => [], addTeam: vi.fn(), removeTeam: vi.fn(), updateTeam: vi.fn(), movePlacementLogic: vi.fn(),
      togglePlacementLogic: vi.fn(), reorderPlacementLogic: vi.fn(), handleTournamentTypeChange: vi.fn(), handleResetTournament: vi.fn(),
      createDraftTournament: () => formData,
      saveDraft: vi.fn(() => Promise.resolve(base)),
      publishTournament: spies.publishTournament,
    };
  },
}));

import { TournamentCreationScreen } from '../../../screens/TournamentCreationScreen';
import { ToastProvider } from '../../../components/ui/Toast';
import { testUuid } from '../../../test/testIds';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { MatchEngineContext } from '../../match-engine/matchEngineContextInstance';
import { MatchCommands } from '../../../core/match/client';
import { buildValidMatches } from '../../../hooks/engineMatchModel';
import { makeScheduleEngine, settle, type ScheduleEngine } from '../../../test/scheduleEngineHarness';
import { entryCount } from '../../../test/matchEntrySeed';

await initRealDeI18n();

const baseTournament = (): Tournament =>
  ({
    id: 't1', title: 'Live-Cup', ageClass: 'U13', sport: 'football', tournamentType: 'classic', mode: 'roundRobin',
    groupSystem: 'roundRobin', date: '2030-01-01', timeSlot: '09:00', startDate: '2030-01-01', startTime: '09:00',
    numberOfTeams: 4, numberOfFields: 1, numberOfGroups: 1, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2,
    finalRoundGameDuration: 10, finalRoundBreakDuration: 2, breakBetweenPhases: 0, placementLogic: [],
    teams: [1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: `Team ${n}` })), matches: [],
    status: 'published', publishedAt: '2026-10-04T08:00:00Z', isKidsTournament: false, hideScoresForPublic: false,
    hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false }, location: { name: 'Halle' },
    createdAt: '2026-10-04T08:00:00Z', updatedAt: '2026-10-04T08:00:00Z', lastVisitedStep: 6,
  }) as unknown as Tournament;

const established = (): Tournament => {
  const base = baseTournament();
  return {
    ...base,
    matches: generateFullSchedule(base).allMatches.map((m, index) => ({
      id: m.id, round: index + 1, field: m.field, slotA: m.slotA, slotB: m.slotB, scheduledTime: m.startTime,
    })),
  };
};

/** Bestehender Live-Cup; das dritte Spiel trägt die Spielnummer 7. */
const liveCup = (): Tournament => {
  const t = established();
  return { ...t, matches: t.matches.map((m, i) => (i === 2 ? { ...m, matchNumber: 7 } : m)) };
};
const spiel7 = (t: Tournament) => t.matches[2];

/** Olli hat Spiel 7 abgesetzt (Server-Weg, ein SKIP-Eintrag). */
async function spiel7Abgesetzt(h: ScheduleEngine, t: Tournament): Promise<void> {
  const entry = buildValidMatches(t).find((e) => e.externalId === spiel7(t).id);
  if (!entry) { throw new Error('Spiel 7 hat keine zwei Teams'); }
  await h.engine.ensureMatch(entry.matchId, entry.ctx, t.id);
  await new MatchCommands({ engine: h.engine, store: h.store, sender: h.value.sender, accountId: h.value.accountId }).skip(entry.matchId, entry.ctx, 'leitung');
  await settle();
}

const renderScreen = (h: ScheduleEngine, existing: Tournament) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <MatchEngineContext.Provider value={h.value}>
          <TournamentCreationScreen
            onBack={vi.fn()} onSave={spies.onSave} existingTournament={existing} quickEditMode={false}
            onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()}
          />
        </MatchEngineContext.Provider>
      </ToastProvider>
    </MemoryRouter>
  );

describe('A-08f3e4 Fixrunde 1: Neuplanung eines bestehenden Turniers mit Einträgen (@FU-090)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('indexedDB', new IDBFactory());
    spies.existing = liveCup();
    spies.startState = 'not-started';
    spies.recheck.mockResolvedValue('not-started');
    spies.formDataOverride = undefined;
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('@FU-090 Spiel 7 nur abgesetzt (ein SKIP) → keine Neuplanung, Text wörtlich, der Eintrag bleibt', async () => {
    const current = spies.existing ?? liveCup();
    await spiel7Abgesetzt(h, current);
    renderScreen(h, current);

    fireEvent.click(screen.getByTestId('wizard-show-preview'));

    expect(await screen.findByText('Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen')).toBeInTheDocument();
    expect(screen.queryByTestId('replan-end-time')).not.toBeInTheDocument();
    expect(screen.queryByText(/bereits angepfiffen/)).not.toBeInTheDocument();
    expect(await entryCount(h, spiel7(current).id.toLowerCase())).toBe(1);
  });

  it('Gegenbeispiel: Turnier ohne Einträge → die Neuplanung öffnet wie heute', async () => {
    renderScreen(h, spies.existing ?? liveCup());

    fireEvent.click(screen.getByTestId('wizard-show-preview'));

    expect(await screen.findByTestId('replan-end-time')).toBeInTheDocument();
    expect(screen.queryByText(/hat Einträge/)).not.toBeInTheDocument();
  });
});
