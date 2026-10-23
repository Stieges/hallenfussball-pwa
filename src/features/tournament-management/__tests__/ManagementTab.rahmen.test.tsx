/**
 * Rahmen und Feldwahl im Live-Reiter (Plan LT-2): schmaler Kopf mit „Zurück“ und Feldwahl (@SL-140, Entscheidung A1), Feld in der Adresse
 * (`?f=`, K4, @OB-030), „Zurück“ zum Spielplan über `buildTournamentTabPath` (K5), Rahmen auch beim Laden (K6), keine Spielauswahl (@SL-057).
 * LiveCockpit ist ein Stub; geprüft wird die Verdrahtung in `ManagementTab`. Spiel 11 läuft auf Feld 1, Spiel 12 auf Feld 2, Feld 3 hat kein Spiel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { CockpitFrameProvider } from '../../../components/live-cockpit/frame/CockpitFrameContext';
import { useCockpitFrame } from '../../../components/live-cockpit/frame/cockpitFrame';
import { ManagementTab } from '../ManagementTab';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import type { LiveMatch as CoreLiveMatch } from '../../../core/models/LiveMatch';
import type { TournamentRole } from '../../auth/types/auth.types';
import { testTeamSlot } from '../../../test/matchSlotFixtures';
import type { MatchReview } from '../../../core/match/review/matchReviewTypes';
import { review } from '../../../core/match/review/__tests__/reviewFixtures';

vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));
vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: ({ currentMatch, fieldName }: { currentMatch: { id: string } | null; fieldName: string }) => <div data-testid="cockpit-stub" data-match-id={currentMatch?.id} data-feld={fieldName} />,
}));
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

// B-50 @FU-132: Klärungsliste (Server-Abfrage ersetzt, Rechte über das echte useCan)
const offeneFaelle: { current: MatchReview[] } = { current: [] };
vi.mock('../../klaerungsliste/useMatchReviews', async () => {
  const { useCan } = await import('../../auth/hooks/useCan');
  const zustand = (_id: string, lead: boolean) => ({ enabled: lead, reviews: lead ? offeneFaelle.current : [], refresh: () => Promise.resolve() });
  return {
    useMatchReviews: (id: string) => zustand(id, useCan('leadMatches', id)),
    useMatchReviewsFor: (id: string, lead: boolean) => zustand(id, lead),
  };
});

let currentRole: TournamentRole = 'collaborator';
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));
vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'membership-1', userId: 'user-1', tournamentId: 'tournament-1',
      role: currentRole, teamIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    members: [], isLoading: false, error: null,
  }),
}));

// Spiel 11 läuft auf Feld 1 (Tom), Spiel 12 läuft auf Feld 2 (Clara), Spiel 13 folgt auf Feld 1.
const SPIEL_11 = 'spiel-11';
const SPIEL_12 = 'spiel-12';
const SPIEL_13 = 'spiel-13';
const NORD = { id: 'fc-nord', name: 'FC Nord' };
const SUED = { id: 'sv-sued', name: 'SV Süd' };
const WEST = { id: 'tsv-west', name: 'TSV West' };
const MITTE = { id: 'sg-mitte', name: 'SG Mitte' };

const handleFinish = vi.fn().mockResolvedValue(undefined);
const liveMatches = new Map<string, CoreLiveMatch>();

function live(id: string, number: number, fieldId: string, home: typeof NORD, away: typeof NORD, status: CoreLiveMatch['status']): CoreLiveMatch {
  return {
    id, number, phaseLabel: 'Gruppe A', fieldId, scheduledKickoff: '15:00', durationSeconds: 600, version: 1,
    homeTeam: home, awayTeam: away, homeScore: 1, awayScore: 0, status, elapsedSeconds: 168, events: [],
  };
}

vi.mock('../../../hooks/useCockpitExecution', () => ({
  useCockpitExecution: () => ({
    liveMatches,
    loadingStates: { goal: false, card: false, finish: false, undo: false, start: false },
    isAnyLoading: false,
    getLiveMatchData: () => new Promise(() => undefined), // bleibt offen: das Spiel „wird geladen“ (K6)
    handleStart: vi.fn(), handlePause: vi.fn(), handleResume: vi.fn(), handleFinish,
    handleForceFinish: vi.fn(), handleGoal: vi.fn(), handleTimePenalty: vi.fn(), handleCard: vi.fn(),
    handleSubstitution: vi.fn(), handleFoul: vi.fn(), handleUndoLastEvent: vi.fn(),
    handleManualEditResult: vi.fn(), handleAdjustTime: vi.fn(), handleReopenMatch: vi.fn(),
    // wie useCockpitExecution: das ERSTE laufende Spiel des ganzen Turniers, feldübergreifend
    hasRunningMatch: () => [...liveMatches.values()].find((m) => m.status === 'RUNNING'),
    handleStartOvertime: vi.fn(), handleStartGoldenGoal: vi.fn(), handleStartPenaltyShootout: vi.fn(),
    handleRecordPenaltyResult: vi.fn(), handleAbortPenaltyShootout: vi.fn(),
    handleUpdateEvent: vi.fn(), handleDeleteEvent: vi.fn(),
  }),
}));

const tournament = {
  id: 'tournament-1', title: 'Hallencup Süd', numberOfFields: 2, teams: [], matches: [],
} as unknown as Tournament;

function scheduled(id: string, matchNumber: number, field: number, time: string, home: typeof NORD, away: typeof NORD) {
  return {
    id, matchNumber, time, field, slot: matchNumber,
    homeTeam: home.name, awayTeam: away.name, originalTeamA: home.id, originalTeamB: away.id,
    slotA: testTeamSlot(home.id), slotB: testTeamSlot(away.id),
    phase: 'groupStage', label: 'Gruppe A', duration: 10,
  };
}

const schedule = {
  tournament: { id: 'tournament-1', title: 'Hallencup Süd' },
  teams: [NORD, SUED, WEST, MITTE],
  allMatches: [
    scheduled(SPIEL_11, 11, 1, '15:00', NORD, SUED),
    scheduled(SPIEL_12, 12, 2, '15:00', WEST, MITTE),
    scheduled(SPIEL_13, 13, 1, '15:15', WEST, MITTE),
  ],
  phases: [],
} as unknown as GeneratedSchedule;


function Sonde() {
  const ort = useLocation();
  const { vollbild } = useCockpitFrame();
  const navigation = useNavigationType();
  return <div data-testid="sonde" data-pfad={ort.pathname} data-suche={ort.search} data-rahmen={String(vollbild)} data-navigation={navigation} />;
}

function zeige(adresse: string, felder = 2, plan: GeneratedSchedule = schedule) {
  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <CockpitFrameProvider>
        <ManagementTab tournament={{ ...tournament, numberOfFields: felder }} schedule={plan} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />
        <Sonde />
      </CockpitFrameProvider>
    </MemoryRouter>,
  );
}
const sonde = () => screen.getByTestId('sonde');

describe('Rahmen und Feldwahl im Live-Reiter (Plan LT-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleFinish.mockResolvedValue(undefined);
    currentRole = 'collaborator';
    liveMatches.clear();
    liveMatches.set(SPIEL_11, live(SPIEL_11, 11, 'field-1', NORD, SUED, 'RUNNING'));
    liveMatches.set(SPIEL_12, live(SPIEL_12, 12, 'field-2', WEST, MITTE, 'RUNNING'));
    liveMatches.set(SPIEL_13, live(SPIEL_13, 13, 'field-1', WEST, MITTE, 'NOT_STARTED'));
  });

  it('@SL-140 mit einem Spiel auf dem Feld steht der schmale Kopf mit Zurück und Turniername, der Rahmen ist gemeldet', async () => {
    zeige('/tournament/tournament-1/live');
    const kopf = await screen.findByTestId('cockpit-slim-header');
    expect(within(kopf).getByTestId('cockpit-zurueck')).toBeInTheDocument();
    expect(within(kopf).getByTestId('cockpit-turniername')).toHaveTextContent('Hallencup Süd');
    expect(within(kopf).getByTestId('cockpit-verbindung')).toBeInTheDocument();
    await waitFor(() => expect(sonde()).toHaveAttribute('data-rahmen', 'true'));
  });

  it('@SL-140 K5 „Zurück“ führt zum Spielplan des Turniers, das laufende Spiel wird nicht berührt', async () => {
    const user = userEvent.setup();
    zeige('/tournament/tournament-1/live');
    await user.click(await screen.findByTestId('cockpit-zurueck'));
    expect(sonde()).toHaveAttribute('data-pfad', '/tournament/tournament-1/schedule');
    expect(handleFinish).not.toHaveBeenCalled();
  });

  it('@SL-140 Gegenbeispiel: „Zurück“ führt nicht zur Turnierübersicht /tournament/tournament-1', async () => {
    const user = userEvent.setup();
    zeige('/tournament/tournament-1/live');
    await user.click(await screen.findByTestId('cockpit-zurueck'));
    expect(sonde().getAttribute('data-pfad')).not.toBe('/tournament/tournament-1');
  });

  it('@OB-030 K4 die Adresse ?f=2 öffnet Feld 2 (Spiel 12)', async () => {
    zeige('/tournament/tournament-1/live?f=2');
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-match-id', SPIEL_12));
    expect(screen.getByTestId('cockpit-feldwahl')).toHaveValue('2');
  });

  it('@OB-030 K4 Feld wählen schreibt ?f=2 in die Adresse (ersetzt den Eintrag) und zeigt Spiel 12', async () => {
    const user = userEvent.setup();
    zeige('/tournament/tournament-1/live');
    await user.selectOptions(await screen.findByTestId('cockpit-feldwahl'), '2');
    expect(sonde()).toHaveAttribute('data-suche', '?f=2');
    // S3: der Eintrag wird ersetzt, nicht hinzugefügt (Zurück springt nicht durch alle Feldwechsel)
    expect(sonde()).toHaveAttribute('data-navigation', 'REPLACE');
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-match-id', SPIEL_12));
  });

  it('@OB-030 S4 Feld wählen entfernt ?matchId= aus der Adresse, damit Neu laden das gewählte Feld behält', async () => {
    const user = userEvent.setup();
    zeige(`/tournament/tournament-1/live?matchId=${SPIEL_11}`);
    await user.selectOptions(await screen.findByTestId('cockpit-feldwahl'), '2');
    expect(sonde()).toHaveAttribute('data-suche', '?f=2');
    expect(sonde().getAttribute('data-suche')).not.toContain('matchId');
  });

  it('@OB-030 Gegenbeispiel: ein ungültiges ?f=9 gilt als Feld 1', async () => {
    zeige('/tournament/tournament-1/live?f=9');
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-match-id', SPIEL_11));
  });

  it('@SL-057 im Live-Reiter gibt es keine Spielauswahl, auch nicht für die Turnierleitung', async () => {
    currentRole = 'owner';
    zeige('/tournament/tournament-1/live');
    await screen.findByTestId('cockpit-slim-header');
    expect(screen.queryByRole('combobox', { name: /Spiel/ })).toBeNull();
  });

  it('Gegenbeispiel: die Feldwahl erscheint nur bei mehr als einem Feld', async () => {
    zeige('/tournament/tournament-1/live', 1);
    await screen.findByTestId('cockpit-slim-header');
    expect(screen.queryByTestId('cockpit-feldwahl')).toBeNull();
  });

  it('@SL-140 K6 auch während das Spiel geladen wird, steht der schmale Kopf (kein Springen beim Laden)', async () => {
    liveMatches.clear(); // Spiel 11 ist (noch) nicht geladen: `getLiveMatchData` ist ein Mock ohne Ergebnis, das Cockpit zeigt den Ladehinweis
    zeige('/tournament/tournament-1/live');
    expect(await screen.findByTestId('cockpit-slim-header')).toBeInTheDocument();
    expect(screen.getByText(/management\.matchLoading/)).toBeInTheDocument();
    await waitFor(() => expect(sonde()).toHaveAttribute('data-rahmen', 'true'));
  });

  it('@SL-140 Gegenbeispiel: ohne Spiel auf dem Feld (Feld 3) bleibt der normale Rahmen mit App-Navigation, kein schmaler Kopf', async () => {
    zeige('/tournament/tournament-1/live?f=3', 3);
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toBeInTheDocument());
    expect(screen.queryByTestId('cockpit-slim-header')).toBeNull();
    expect(sonde()).toHaveAttribute('data-rahmen', 'false');
  });

  it('@SL-054 P2 ohne Spiel auf dem Feld und mit mehr als einem Feld bietet die Tafelseite die Feldwahl, die Wahl führt zum Spiel des Felds', async () => {
    const user = userEvent.setup();
    zeige('/tournament/tournament-1/live?f=3', 3);
    const wahl = await screen.findByTestId('cockpit-feldwahl');
    expect(wahl).toHaveValue('3');
    expect(screen.queryByTestId('cockpit-slim-header')).toBeNull();
    await user.selectOptions(wahl, '1');
    expect(sonde()).toHaveAttribute('data-suche', '?f=1');
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-match-id', SPIEL_11));
    expect(screen.getByTestId('cockpit-slim-header')).toBeInTheDocument();
  });

  it('@SL-054 P2 Gegenbeispiel: ohne Spiel und mit nur einem Feld gibt es keine Feldwahl', async () => {
    const leerPlan = { ...schedule, allMatches: [] } as unknown as GeneratedSchedule;
    zeige('/tournament/tournament-1/live', 1, leerPlan);
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toBeInTheDocument());
    expect(screen.queryByTestId('cockpit-feldwahl')).toBeNull();
  });

  it('@SL-140 P4 eine Speicher-Warnung im Rahmen steht im Fluss unter dem schmalen Kopf (nicht fest am Rand), der Offline-Hinweis bleibt weg', async () => {
    zeige('/tournament/tournament-1/live');
    const kopf = await screen.findByTestId('cockpit-slim-header');
    act(() => { window.dispatchEvent(new CustomEvent('storage-quota-warning', { detail: { message: 'Speicher fast voll', timestamp: 1 } })); });
    const warnung = await screen.findByRole('alert');
    expect(warnung).toHaveTextContent('Speicher fast voll');
    expect(warnung.style.position).toBe('static');
    expect(kopf.compareDocumentPosition(warnung) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('@SL-140 P4 Gegenbeispiel: ohne Rahmen (Feld ohne Spiel) zeigt die Verwaltung diese Warnung nicht selbst (sie liegt dann in der Hülle der App)', async () => {
    zeige('/tournament/tournament-1/live?f=3', 3);
    await waitFor(() => expect(screen.getByTestId('cockpit-stub')).toBeInTheDocument());
    act(() => { window.dispatchEvent(new CustomEvent('storage-quota-warning', { detail: { message: 'Speicher fast voll', timestamp: 1 } })); });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('@FU-132 Im Cockpit-Vollbild erreicht die Turnierleitung die Klärungsliste, ohne dass es stört', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatches.clear();
    liveMatches.set(SPIEL_11, live(SPIEL_11, 11, 'field-1', NORD, SUED, 'RUNNING'));
    liveMatches.set(SPIEL_12, live(SPIEL_12, 12, 'field-2', WEST, MITTE, 'RUNNING'));
    offeneFaelle.current = [review({ eventId: 'fall-a', author: 'Tom' }), review({ eventId: 'fall-b', author: 'Clara' })];
  });

  it('Olli leitet Spiel 12 im Vollbild, 2 offene Fälle: kleiner Zähler „2“ im Cockpit-Kopf öffnet die Liste, das Spiel läuft weiter', async () => {
    currentRole = 'co-admin';
    const user = userEvent.setup();
    zeige('/tournament/tournament-1/live?f=2');
    const kopf = await screen.findByTestId('cockpit-slim-header');
    const zaehler = within(kopf).getByTestId('klaerungsliste-knopf-cockpit');
    expect(zaehler).toHaveTextContent(/^2$/);
    expect(zaehler.style.animation).toBe('');
    await user.click(zaehler);
    await waitFor(() => expect(sonde()).toHaveAttribute('data-suche', expect.stringContaining('klaerung=1')));
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-match-id', SPIEL_12);
    expect(sonde()).toHaveAttribute('data-rahmen', 'true');
  });

  it('Gegenbeispiel: ohne offene Fälle zeigt der Cockpit-Kopf keinen Zähler', async () => {
    currentRole = 'co-admin';
    offeneFaelle.current = [];
    zeige('/tournament/tournament-1/live');
    const kopf = await screen.findByTestId('cockpit-slim-header');
    expect(within(kopf).queryByTestId('klaerungsliste-knopf-cockpit')).toBeNull();
  });

  it('Gegenbeispiel: Tom als Helfer sieht im Cockpit keinen Zähler', async () => {
    currentRole = 'collaborator';
    zeige('/tournament/tournament-1/live');
    const kopf = await screen.findByTestId('cockpit-slim-header');
    expect(within(kopf).queryByTestId('klaerungsliste-knopf-cockpit')).toBeNull();
  });
});

