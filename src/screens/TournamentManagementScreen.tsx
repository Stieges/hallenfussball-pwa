/**
 * TournamentManagementScreen - Hauptscreen für veröffentlichte Turniere
 *
 * Tab-Navigation für Veranstalter:
 * 1. Spielplan - Editable Spielplan mit Ergebniseingabe
 * 2. Turnierleitung - Match Cockpit (Kampfgericht)
 * 3. Monitor - Konfigurator für die Hallenbildschirme
 */

import { useState, useCallback, useEffect } from 'react';
import { CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cssVars } from '../design-tokens';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Tournament } from '../types/tournament';
import { MatchUpdate } from '../core/models/types';
import { useToast } from '../components/ui/Toast';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTournamentManager } from '../hooks/useTournamentManager';
import { ManagementHeader, ManagementMobileNav } from './ManagementChrome';
import { useCockpitFrame } from '../components/live-cockpit/frame/cockpitFrame';
import { getTabFromPath, buildTournamentTabPath, TournamentTab } from '../features/tournament-management/utils/tournamentTabUtils';

// Tab Components
import { ScheduleTab } from '../features/tournament-management/ScheduleTab';
import { TabellenTab } from '../features/tournament-management/TabellenTab';
import { StandingTieProvider } from '../features/tournament-management/standings/StandingTieProvider';
import { GroupCompletionProvider } from '../features/tournament-management/group-completion/GroupCompletionProvider';
import { ManagementTab } from '../features/tournament-management/ManagementTab';
import { SettingsTabConnected } from '../features/tournament-management/SettingsTabConnected';
import { TeamsTab } from '../features/tournament-management/TeamsTab';
import { MonitorsConfigTab } from '../features/tournament-management/MonitorsConfigTab';
import { MonitorEditor } from '../features/tournament-management/MonitorEditor';


interface TournamentManagementScreenProps {
  tournamentId: string;
  onBack?: () => void;
  onEditInWizard?: (tournament: Tournament, targetStep?: number) => void;
  // Auth Navigation
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings?: () => void;
}

// Type alias for backward compatibility
type TabType = TournamentTab;

export const TournamentManagementScreen: React.FC<TournamentManagementScreenProps> = ({
  tournamentId,
  onBack,
  onEditInWizard,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToProfile,
  onNavigateToSettings,
}) => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const location = useLocation();

  // Get active tab from URL path (e.g., /tournament/:id/schedule)
  const pathParts = location.pathname.split('/');
  const tabFromUrl = pathParts.length >= 4 ? pathParts[3] : undefined;
  const activeTab = getTabFromPath(tabFromUrl);

  // Parse matchId from URL query params (for deep-linking to specific match)
  const searchParams = new URLSearchParams(location.search);
  const matchIdFromUrl = searchParams.get('matchId');

  // Initial match ID for cockpit navigation (passed from ScheduleTab or URL)
  const [initialMatchId, setInitialMatchId] = useState<string | null>(matchIdFromUrl);
  // Ändert sich die Adresse im geöffneten Bildschirm (Link, Zurück/Vor), gilt die neue Spiel-Kennung (@OB-029: die Adresse nennt das Spiel)
  useEffect(() => { if (matchIdFromUrl) { setInitialMatchId(matchIdFromUrl); } }, [matchIdFromUrl]);

  // Mobile Navigation
  const isMobile = useIsMobile();
  const { vollbild } = useCockpitFrame();

  // TOUR-EDIT-META: Dirty-State-Tracking für SettingsTab
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<TabType | null>(null);
  const [showDirtyWarning, setShowDirtyWarning] = useState(false);

  // MON-KONF-01: Monitor-Konfigurator State
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);

  // Tournament-Schedule sync via custom hook
  const {
    tournament,
    schedule,
    currentStandings,
    overallStandings,
    isLoading,
    loadingError,
    handleTournamentUpdate,
    applyRemote,
    reload,
    scheduleService,
  } = useTournamentManager(tournamentId);

  // Paket TB-B: nach dem Eintragen oder Zurücknehmen einer Gleichstands-Entscheidung frisch aus der Cloud lesen
  const reloadFresh = useCallback(() => { void reload({ fresh: true }); }, [reload]);


  // A2 (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-brief.md): result entry in
  // the schedule persists ONLY the touched matches (targeted update) instead of a full tournament
  // save -- a stale local tournament state at the owner must never overwrite a helper's live
  // match. Local state is already synced by `applyRemote` (via ScheduleTab's
  // onLocalTournamentUpdate); this only talks to the repository.
  const handleMatchesUpdate = useCallback((updates: MatchUpdate[]) => {
    if (updates.length === 0) { return; }
    const run = updates.length === 1
      ? scheduleService.updateMatch(tournamentId, updates[0])
      : scheduleService.updateMatches(tournamentId, updates);
    run.catch((err: unknown) => {
      console.error('Failed to persist match update:', err);
      // A2 Fixrunde 1 (M6): vorher nur console.error -- über OfflineRepository unkritisch (lokal
      // geschrieben, eingereiht), aber ein Nutzer im reinen Cloud-Pfad bekam einen gescheiterten
      // Ergebnis-/Status-Sync NIE angezeigt.
      showError('Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.');
    });
  }, [scheduleService, tournamentId, showError]);

  // TOUR-EDIT-META: Tab-Wechsel mit Dirty-State-Prüfung
  const handleTabChange = (newTab: TabType) => {
    if (activeTab === 'settings' && isSettingsDirty && newTab !== 'settings') {
      setPendingTab(newTab);
      setShowDirtyWarning(true);
    } else {
      // Navigate to new tab URL
      void navigate(buildTournamentTabPath(tournamentId, newTab));
    }
  };

  // TOUR-EDIT-META: Dirty-Warning Dialog bestätigen
  const handleConfirmTabChange = () => {
    if (pendingTab) {
      void navigate(buildTournamentTabPath(tournamentId, pendingTab));
      setPendingTab(null);
      setShowDirtyWarning(false);
      setIsSettingsDirty(false);
    }
  };

  // TOUR-EDIT-META: Dirty-Warning Dialog abbrechen
  const handleCancelTabChange = () => {
    setPendingTab(null);
    setShowDirtyWarning(false);
  };

  // Handle navigation to cockpit with specific match
  const handleNavigateToCockpit = (matchId: string) => {
    setInitialMatchId(matchId);
    // Navigate to live/management tab with match ID as query param
    void navigate(`${buildTournamentTabPath(tournamentId, 'management')}?matchId=${matchId}`);
  };

  // MON-KONF-01: Async wrapper for monitor components
  const handleAsyncTournamentUpdate = async (updatedTournament: Tournament): Promise<void> => {
    void handleTournamentUpdate(updatedTournament);
  };

  // Loading / Error state
  if (!tournament || !schedule) {
    // Still loading - show spinner
    if (isLoading) {
      return (
        <div style={loadingStyle}>
          <div style={loadingTextStyle}>Lade Turnier...</div>
        </div>
      );
    }

    // Loading finished but no tournament - show error
    const errorMessage = loadingError ?? 'Turnier nicht gefunden';
    return (
      <div style={loadingStyle}>
        <div>
          <div style={{ ...loadingTextStyle, color: cssVars.colors.error, marginBottom: '16px' }}>
            ❌ {loadingError ? 'Fehler beim Laden' : 'Nicht gefunden'}
          </div>
          <div style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary }}>
            {errorMessage}
          </div>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                marginTop: '24px',
                padding: '12px 24px',
                background: cssVars.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: cssVars.borderRadius.md,
                cursor: 'pointer',
                fontSize: cssVars.fontSizes.md,
              }}
            >
              Zurück zum Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  const containerStyle: CSSProperties = {
    minHeight: 'var(--min-h-screen)',
    ...(vollbild ? { flex: 1, minHeight: 0 } : {}),
    background: cssVars.colors.background,
    display: 'flex',
    flexDirection: 'column',
  };

  // Im Rahmen (Cockpit-Vollbild, @SL-140) füllt der Inhalt die Resthöhe und gibt sie dem Cockpit weiter (K3); sonst scrollt die Seite wie bisher
  const contentStyle: CSSProperties = vollbild
    ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
    : { flex: 1, overflow: 'auto', paddingBottom: isMobile ? '72px' : undefined };

  return (
    <div style={containerStyle}>
      {!vollbild && (
        <ManagementHeader
          tournament={tournament} isMobile={isMobile} activeTab={activeTab} isSettingsDirty={isSettingsDirty} onBack={onBack}
          onTabChange={handleTabChange} onNavigateToLogin={onNavigateToLogin} onNavigateToRegister={onNavigateToRegister}
          onNavigateToProfile={onNavigateToProfile} onNavigateToSettings={onNavigateToSettings}
        />
      )}

      {/* TAB CONTENT */}
      <div style={contentStyle}>
        {(activeTab === 'schedule' || activeTab === 'tabellen') && (
          // GA4 A-13c: Spielplan und Tabellen teilen sich Rechte, Netz und den Ablauf „Gruppe abschließen“ (Banner, Dialoge)
          <StandingTieProvider tournamentId={tournamentId} onChanged={reloadFresh}>
            <GroupCompletionProvider tournament={tournament}>
              {activeTab === 'schedule' && (
                <ScheduleTab
                  tournament={tournament}
                  schedule={schedule}
                  currentStandings={currentStandings}
                  onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }}
                  onLocalTournamentUpdate={applyRemote}
                  onMatchesUpdate={handleMatchesUpdate}
                  onNavigateToCockpit={(id) => { handleNavigateToCockpit(id); }}
                />
              )}
              {activeTab === 'tabellen' && (
                <TabellenTab
                  tournament={tournament}
                  schedule={schedule}
                  currentStandings={currentStandings}
                  overallStandings={overallStandings}
                />
              )}
            </GroupCompletionProvider>
          </StandingTieProvider>
        )}
        {activeTab === 'management' && (
          <ManagementTab
            tournament={tournament}
            schedule={schedule}
            onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }}
            onLocalTournamentUpdate={applyRemote}
            initialMatchId={initialMatchId}
            onInitialMatchConsumed={() => setInitialMatchId(null)}
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
            onDirtyChange={setIsSettingsDirty}
            onEditInWizard={onEditInWizard}
            focusSection={searchParams.get('abschnitt') ?? undefined}
            onPlacesSaved={reloadFresh}
          />
        )}
        {activeTab === 'monitor' && (
          <MonitorsConfigTab
            tournament={tournament}
            onTournamentUpdate={handleAsyncTournamentUpdate}
            onEditMonitor={setEditingMonitorId}
          />
        )}
      </div>

      {/* MON-KONF-01: Monitor-Editor Dialog */}
      {editingMonitorId && (
        <MonitorEditor
          tournament={tournament}
          monitorId={editingMonitorId}
          onTournamentUpdate={handleAsyncTournamentUpdate}
          onClose={() => setEditingMonitorId(null)}
        />
      )}

      {/* TOUR-EDIT-META: Dirty-Warning Dialog */}
      {showDirtyWarning && (
        <ConfirmDialog
          variant="danger"
          title="Ungespeicherte Änderungen"
          message="Du hast Änderungen an den Turnier-Einstellungen vorgenommen, die noch nicht gespeichert wurden. Möchtest du die Änderungen verwerfen?"
          confirmText="Verwerfen"
          cancelText="Abbrechen"
          onConfirm={handleConfirmTabChange}
          onCancel={handleCancelTabChange}
        />
      )}

      {!vollbild && isMobile && <ManagementMobileNav activeTab={activeTab} onTabChange={handleTabChange} />}
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const loadingStyle: CSSProperties = {
  minHeight: 'var(--min-h-screen)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: cssVars.colors.background,
};

const loadingTextStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xl,
  color: cssVars.colors.textSecondary,
};

