/**
 * Prüfstand für die Gleichstands-Oberfläche der Tabelle (Paket TB-B, TB-6; Regel T2-UI). Rollen, die offline im echten Ablauf
 * nicht erreichbar sind (Helfer: lokal gilt jeder als Eigentümer; Zuschauer-Link), und feste Zustände für Bilder gegen das
 * Mockup v3. Echte Komponenten (`TabellenTab`, `PublicStandingsTab`), echte Tokens, i18n und Thema; der Dienst arbeitet auf
 * einem Speicher im Fenster, nichts verlässt die Seite. Adresse: `?rolle=leitung|helfer|zuschauer`, `&plaetze=1,2,3`,
 * `&zustand=offen|annahme|schiessen|abgeschlossen` (abgeschlossen = „Gruppe abschließen“ gewählt), `&netz=aus`, `&sprache=en`. Nur Testumgebung, nicht Teil des Builds.
 */
import { useCallback, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { TabellenTab } from '../../../src/features/tournament-management/TabellenTab';
import { PublicStandingsTab } from '../../../src/features/public-view/components/PublicStandingsTab';
import { StandingTieContext, type StandingTieContextValue } from '../../../src/features/tournament-management/standings/standingTieContext';
import { generateFullSchedule } from '../../../src/core/generators';
import { calculateStandings, calculateStandingsPerGroup } from '../../../src/utils/calculations';
import { StandingDecisionService } from '../../../src/core/services/StandingDecisionService';
import { groupClosedFromCompletions } from '../../../src/core/standings/groupCompletions';
import type { RecordDecisionRequest, RecordDecisionResult } from '../../../src/core/repositories/groupCompletionCloud';
import type { ITournamentRepository } from '../../../src/core/repositories/ITournamentRepository';
import type { Tournament } from '../../../src/types/tournament';
import { id } from '../../../src/core/standings/__tests__/fixtures';
import saat from '../../../scripts/visual-metrics/saat/nikolaus-gleichstand.json';

const query = new URLSearchParams(window.location.search);
const rolle = query.get('rolle') ?? 'leitung';
const zustand = query.get('zustand') ?? 'offen';
const online = query.get('netz') !== 'aus';
void i18n.changeLanguage(query.get('sprache') === 'en' ? 'en' : 'de');

const grund = (saat.datenbanken[0] as { eintraege: { tournaments: unknown[] } }).eintraege.tournaments[0] as Tournament;
const plaetze = (query.get('plaetze') ?? '1').split(',').filter(Boolean).map(Number);
let current: Tournament = { ...grund, version: 1, placementsToPlayOut: plaetze };

/** Speicher im Fenster mit echter Versionslogik (wie `MemoryRepo` der Tests). */
const repository = {
  get: () => Promise.resolve(JSON.parse(JSON.stringify(current)) as Tournament),
  recordStandingDecision: (_id: string, request: RecordDecisionRequest, expectedVersion: number): Promise<RecordDecisionResult> => {
    const others = (current.standingDecisions ?? []).filter((d) => d.id !== request.decision.id);
    current = { ...current, standingDecisions: request.action === 'decide' ? [...others, request.decision] : others, version: expectedVersion + 1 };
    return Promise.resolve({ status: 'ok', alreadyApplied: false, version: expectedVersion + 1 });
  },
} as unknown as ITournamentRepository;
const service = new StandingDecisionService(repository, { groupClosed: groupClosedFromCompletions });

const P = id('P');
const D = id('D');
if (zustand === 'annahme') {
  await service.decide(current.id, { groupId: '', teamIds: [P, D], order: [P, D], kind: 'shared' });
} else if (zustand === 'schiessen') {
  await service.decide(current.id, { groupId: '', teamIds: [D, P], order: [D, P], kind: 'shootout', shootout: { winner: 4, loser: 3 } });
} else if (zustand === 'abgeschlossen') {
  await service.decide(current.id, { groupId: '', teamIds: [P, D], order: [P, D], kind: 'shared' });
  // „Gruppe abschließen“ (A-13b-C): der echte Abschluss, nicht mehr die Zwischenregel über Folgespiele
  current = { ...current, groupCompletions: [{ groupId: '', ranking: current.teams.map((t) => t.id), openRanks: [], stale: false, completedAt: '2026-12-06T10:00:00Z' }] };
}

declare global { interface Window { __harness: { tournament: () => Tournament } } }
window.__harness = { tournament: () => current };

// eslint-disable-next-line react-refresh/only-export-components -- Prüfstand, kein Teil der App (keine Schnellaktualisierung nötig)
function Seite() {
  const [tournament, setTournament] = useState<Tournament>(current);
  const onChanged = useCallback(() => setTournament(JSON.parse(JSON.stringify(current)) as Tournament), []);
  const value = useMemo<StandingTieContextValue>(() => ({
    tournamentId: current.id, canDecide: rolle === 'leitung', online, service, onChanged, openRules: () => { window.__harness = { ...window.__harness }; },
  }), [onChanged]);
  const schedule = useMemo(() => generateFullSchedule(tournament), [tournament]);
  const standings = useMemo(() => calculateStandingsPerGroup(tournament), [tournament]);
  const overall = useMemo(() => calculateStandings(tournament.teams, tournament.matches, tournament), [tournament]);
  if (rolle === 'zuschauer') {
    return <div style={{ maxWidth: 1200, margin: '0 auto' }}><PublicStandingsTab tournament={tournament} standings={standings} /></div>;
  }
  return (
    <StandingTieContext.Provider value={value}>
      <TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} overallStandings={overall} />
    </StandingTieContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<ThemeProvider><Seite /></ThemeProvider>);
