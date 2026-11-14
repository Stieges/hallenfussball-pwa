/**
 * Inhalt des gewählten Reiters der Verwaltung (Spielplan, Tabellen, Turnierleitung, Teams, Einstellungen, Monitor).
 * Ausgelagert aus TournamentManagementScreen (Dateigröße); reine Weitergabe, die Zustände und Speicherwege bleiben im Screen.
 * @W5-042: ohne Spiele zeigen Spielplan, Tabellen und Turnierleitung den Hinweis statt eines erzeugten Plans.
 */
import { useNavigate } from 'react-router-dom';
import type { Tournament, Standing } from '../../types/tournament';
import type { GeneratedSchedule } from '../../core/generators';
import type { TournamentTab } from './utils/tournamentTabUtils';
import { ScheduleTab } from './ScheduleTab';
import { FinishTournamentSection } from '../tournament-finish/components/FinishTournamentSection';
import { TabellenTabMitAdresse } from './TabellenTabMitAdresse';
import { StandingTieProvider } from './standings/StandingTieProvider';
import { GroupCompletionProvider } from './group-completion/GroupCompletionProvider';
import { ManagementTab } from './ManagementTab';
import { ScheduleMissingNotice } from './ScheduleMissingNotice';
import { SettingsTabConnected } from './SettingsTabConnected';
import { TeamsTab } from './TeamsTab';
import { MonitorsConfigTab } from './MonitorsConfigTab';
import type { MatchUpdate } from '../../core/models/types';

export interface ManagementTabContentProps {
  tournamentId: string;
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
  overallStandings: Standing[];
  activeTab: TournamentTab;
  initialMatchId: string | null;
  focusSection?: string;
  handleTournamentUpdate: (tournament: Tournament) => Promise<void> | void;
  saveTournamentOrThrow: (tournament: Tournament) => Promise<void>;
  applyRemote: (tournament: Tournament) => void;
  onMatchesUpdate: (updates: MatchUpdate[]) => void;
  reloadFresh: () => void;
  onNavigateToCockpit: (matchId: string) => void;
  onInitialMatchConsumed: () => void;
  onSettingsDirtyChange: (dirty: boolean) => void;
  onEditInWizard?: (tournament: Tournament, targetStep?: number) => void;
  onEditMonitor: (monitorId: string) => void;
}

export const ManagementTabContent = ({
  tournamentId, tournament, schedule, currentStandings, overallStandings, activeTab, initialMatchId, focusSection,
  handleTournamentUpdate, saveTournamentOrThrow, applyRemote, onMatchesUpdate, reloadFresh, onNavigateToCockpit,
  onInitialMatchConsumed, onSettingsDirtyChange, onEditInWizard, onEditMonitor,
}: ManagementTabContentProps) => {
  const navigate = useNavigate();
  const noMatches = tournament.matches.length === 0;
  return (
    <>
    {/* @W5-042: ohne Spiele erzeugt die Verwaltung keinen Plan (Laden schreibt nie), sie weist auf den Wizard hin */}
    {noMatches && (activeTab === 'schedule' || activeTab === 'tabellen' || activeTab === 'management') && (
      <ScheduleMissingNotice
        tournamentId={tournamentId} isDraft={tournament.status === 'draft'}
        onOpenWizard={() => { void navigate(`/tournament/${tournamentId}/edit`); }} onReload={reloadFresh}
      />
    )}
    {!noMatches && (activeTab === 'schedule' || activeTab === 'tabellen') && (
      // GA4 A-13c: Spielplan und Tabellen teilen sich Rechte, Netz und den Ablauf „Gruppe abschließen“ (Banner, Dialoge)
      <StandingTieProvider tournamentId={tournamentId} onChanged={reloadFresh}>
        <GroupCompletionProvider tournament={tournament}>
          {activeTab === 'schedule' && (
            <>
            {/* @LZ-007: ist alles entschieden, steht der Vorschlag zum Abschließen oben im Spielplan */}
            <FinishTournamentSection tournament={tournament} onReload={reloadFresh} placement="schedule" />
            <ScheduleTab
              tournament={tournament}
              schedule={schedule}
              currentStandings={currentStandings}
              onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }} onTournamentSave={saveTournamentOrThrow}
              onLocalTournamentUpdate={applyRemote}
              onMatchesUpdate={onMatchesUpdate}
              onNavigateToCockpit={onNavigateToCockpit}
            />
            </>
          )}
          {activeTab === 'tabellen' && (
            <TabellenTabMitAdresse
              tournament={tournament}
              schedule={schedule}
              currentStandings={currentStandings}
              overallStandings={overallStandings}
            />
          )}
        </GroupCompletionProvider>
      </StandingTieProvider>
    )}
    {!noMatches && activeTab === 'management' && (
      <ManagementTab
        tournament={tournament}
        schedule={schedule}
        onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }}
        onLocalTournamentUpdate={applyRemote}
        initialMatchId={initialMatchId}
        onInitialMatchConsumed={onInitialMatchConsumed}
      />
    )}
    {activeTab === 'teams' && (
      <TeamsTab
        tournament={tournament}
        onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }}
      />
    )}
    {activeTab === 'settings' && (
      <SettingsTabConnected
        tournament={tournament}
        onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }}
        onDirtyChange={onSettingsDirtyChange}
        onEditInWizard={onEditInWizard}
        focusSection={focusSection}
        onPlacesSaved={reloadFresh}
      />
    )}
    {activeTab === 'monitor' && (
      <MonitorsConfigTab
        tournament={tournament}
        onTournamentUpdate={(t) => { void handleTournamentUpdate(t); return Promise.resolve(); }}
        onEditMonitor={onEditMonitor}
      />
    )}
    </>
  );
};
