/**
 * TournamentManagementScreen - Hauptscreen für veröffentlichte Turniere
 *
 * Tab-Navigation für Veranstalter:
 * 1. Spielplan - Editable Spielplan mit Ergebniseingabe
 * 2. Turnierleitung - Match Cockpit (Kampfgericht)
 * 3. Monitor - Große Zuschauer-Ansicht
 */

import { useState, useEffect } from 'react';
import { CSSProperties } from 'react';
import { theme } from '../styles/theme';
import { Tournament } from '../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../lib/scheduleGenerator';
import { Standing } from '../types/tournament';
import { calculateStandings } from '../utils/calculations';
import { getLocationName, formatDateGerman } from '../utils/locationHelpers';

// Tab Components
import { ScheduleTab } from '../features/tournament-management/ScheduleTab';
import { TableTab } from '../features/tournament-management/TableTab';
import { RankingTab } from '../features/tournament-management/RankingTab';
import { ManagementTab } from '../features/tournament-management/ManagementTab';
import { MonitorTab } from '../features/tournament-management/MonitorTab';
import { SettingsTab } from '../features/tournament-management/SettingsTab';
import { TeamsTab } from '../features/tournament-management/TeamsTab';

interface TournamentManagementScreenProps {
  tournamentId: string;
  onBack?: () => void;
  onEditInWizard?: (tournament: Tournament, targetStep?: number) => void;
}

type TabType = 'schedule' | 'table' | 'ranking' | 'management' | 'monitor' | 'teams' | 'settings';

export const TournamentManagementScreen: React.FC<TournamentManagementScreenProps> = ({
  tournamentId,
  onBack,
  onEditInWizard,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [currentStandings, setCurrentStandings] = useState<Standing[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // TOUR-EDIT-META: Dirty-State-Tracking für SettingsTab
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<TabType | null>(null);
  const [showDirtyWarning, setShowDirtyWarning] = useState(false);

  // Load tournament from localStorage (später von Backend)
  useEffect(() => {
    const loadTournament = () => {
      try {
        const stored = localStorage.getItem('tournaments');

        if (!stored) {
          console.error('❌ No tournaments found in localStorage');
          setLoadingError('Keine Turniere in localStorage gefunden');
          return;
        }

        const tournaments: Tournament[] = JSON.parse(stored);

        const found = tournaments.find((t) => t.id === tournamentId);

        if (found) {
          // MIGRATION: Generate matches if empty (for old tournaments)
          let updatedTournament = found;
          if (!found.matches || found.matches.length === 0) {

            // Generate schedule to get matches
            const tempSchedule = generateFullSchedule(found);

            // Convert ScheduledMatch[] to Match[]
            const generatedMatches = tempSchedule.allMatches.map((scheduledMatch, index) => ({
              id: scheduledMatch.id,
              round: Math.floor(index / found.numberOfFields) + 1,
              field: scheduledMatch.field,
              slot: scheduledMatch.slot,
              teamA: scheduledMatch.homeTeam,
              teamB: scheduledMatch.awayTeam,
              scoreA: scheduledMatch.scoreA,
              scoreB: scheduledMatch.scoreB,
              group: scheduledMatch.group,
              isFinal: scheduledMatch.phase !== 'groupStage',
              finalType: scheduledMatch.finalType,
              label: scheduledMatch.label,
              scheduledTime: scheduledMatch.startTime,
              referee: scheduledMatch.referee,
            }));

            // Update tournament with generated matches
            updatedTournament = {
              ...found,
              matches: generatedMatches,
              updatedAt: new Date().toISOString(),
            };

            // Save updated tournament back to localStorage
            const index = tournaments.findIndex((t) => t.id === tournamentId);
            if (index !== -1) {
              tournaments[index] = updatedTournament;
              localStorage.setItem('tournaments', JSON.stringify(tournaments));
              // Notify useTournaments hook about the change
              window.dispatchEvent(new CustomEvent('tournament-updated'));
            }
          }

          setTournament(updatedTournament);

          // Generate schedule
          const generatedSchedule = generateFullSchedule(updatedTournament);

          // CRITICAL: Sync match IDs from tournament.matches to schedule.allMatches
          // This ensures the IDs match when we try to merge scores
          const syncedSchedule = {
            ...generatedSchedule,
            allMatches: generatedSchedule.allMatches.map((sm, index) => {
              const tournamentMatch = updatedTournament.matches[index];
              if (tournamentMatch) {
                return { ...sm, id: tournamentMatch.id };
              }
              return sm;
            }),
            phases: generatedSchedule.phases.map(phase => ({
              ...phase,
              matches: phase.matches.map((sm) => {
                // FIX: Match by slot + field + group/label instead of team names
                // Team names can differ in format (technical placeholder vs display text)
                // NOTE: Use slot (time slot index) NOT round or matchNumber (they are different!)
                const tournamentMatch = updatedTournament.matches.find(m => {
                  // For group stage: match by slot + field + group
                  if (sm.group && m.group) {
                    return m.slot === sm.slot && m.field === sm.field && m.group === sm.group;
                  }
                  // For playoffs: match by label (most reliable for finals)
                  if (sm.label && m.label) {
                    return m.label === sm.label;
                  }
                  // Fallback: match by slot + field (should be unique)
                  return m.slot === sm.slot && m.field === sm.field;
                });
                if (tournamentMatch) {
                  return { ...sm, id: tournamentMatch.id };
                }
                return sm;
              })
            }))
          };

          setSchedule(syncedSchedule);

          // Calculate initial standings
          const standings = calculateStandings(updatedTournament.teams, updatedTournament.matches, updatedTournament);
          setCurrentStandings(standings);
          setLoadingError(null);
        } else {
          console.error('❌ Tournament not found with ID:', tournamentId);
          setLoadingError(`Turnier mit ID ${tournamentId} nicht gefunden`);
        }
      } catch (error) {
        console.error('❌ Error loading tournament:', error);
        setLoadingError(`Fehler beim Laden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
      }
    };

    loadTournament();
  }, [tournamentId]);

  const handleTournamentUpdate = (updatedTournament: Tournament, regenerateSchedule = false) => {
    // Persist to localStorage (später Backend)
    const stored = localStorage.getItem('tournaments');
    if (stored) {
      const tournaments: Tournament[] = JSON.parse(stored);
      const index = tournaments.findIndex((t) => t.id === updatedTournament.id);
      if (index !== -1) {
        tournaments[index] = updatedTournament;
        localStorage.setItem('tournaments', JSON.stringify(tournaments));
        // Notify useTournaments hook about the change (for Dashboard refresh)
        window.dispatchEvent(new CustomEvent('tournament-updated'));
      }
    }

    // BATCH all state updates together to prevent multiple re-renders
    if (regenerateSchedule) {
      const generatedSchedule = generateFullSchedule(updatedTournament);

      // CRITICAL: Sync match IDs from tournament.matches to schedule
      const syncedSchedule = {
        ...generatedSchedule,
        allMatches: generatedSchedule.allMatches.map((sm, index) => {
          const tournamentMatch = updatedTournament.matches[index];
          if (tournamentMatch) {
            return { ...sm, id: tournamentMatch.id };
          }
          return sm;
        }),
        phases: generatedSchedule.phases.map(phase => ({
          ...phase,
          matches: phase.matches.map((sm) => {
            // FIX: Match by slot + field + group/label instead of team names
            // Team names can differ in format (technical placeholder vs display text)
            // NOTE: Use slot (time slot index) NOT round or matchNumber (they are different!)
            const tournamentMatch = updatedTournament.matches.find(m => {
              // For group stage: match by slot + field + group
              if (sm.group && m.group) {
                return m.slot === sm.slot && m.field === sm.field && m.group === sm.group;
              }
              // For playoffs: match by label (most reliable for finals)
              if (sm.label && m.label) {
                return m.label === sm.label;
              }
              // Fallback: match by slot + field (should be unique)
              return m.slot === sm.slot && m.field === sm.field;
            });
            if (tournamentMatch) {
              return { ...sm, id: tournamentMatch.id };
            }
            return sm;
          })
        }))
      };

      const standings = calculateStandings(updatedTournament.teams, updatedTournament.matches, updatedTournament);

      setTournament(updatedTournament);
      setSchedule(syncedSchedule);
      setCurrentStandings(standings);
    } else {
      // For updates without regeneration: Sync referee assignments from tournament.matches to schedule
      if (schedule) {
        const updatedSchedule = {
          ...schedule,
          allMatches: schedule.allMatches.map(sm => {
            const tournamentMatch = updatedTournament.matches.find(m => m.id === sm.id);
            if (tournamentMatch) {
              return { ...sm, referee: tournamentMatch.referee };
            }
            return sm;
          }),
          phases: schedule.phases.map(phase => ({
            ...phase,
            matches: phase.matches.map(sm => {
              const tournamentMatch = updatedTournament.matches.find(m => m.id === sm.id);
              if (tournamentMatch) {
                return { ...sm, referee: tournamentMatch.referee };
              }
              return sm;
            })
          }))
        };

        const standings = calculateStandings(updatedTournament.teams, updatedTournament.matches, updatedTournament);

        setTournament(updatedTournament);
        setSchedule(updatedSchedule);
        setCurrentStandings(standings);
      } else {
        // Fallback if schedule is null
        const standings = calculateStandings(updatedTournament.teams, updatedTournament.matches, updatedTournament);
        setTournament(updatedTournament);
        setCurrentStandings(standings);
      }
    }
  };

  // TOUR-EDIT-META: Tab-Wechsel mit Dirty-State-Prüfung
  const handleTabChange = (newTab: TabType) => {
    // Wenn wir im Settings-Tab sind und es ungespeicherte Änderungen gibt
    if (activeTab === 'settings' && isSettingsDirty && newTab !== 'settings') {
      setPendingTab(newTab);
      setShowDirtyWarning(true);
    } else {
      setActiveTab(newTab);
    }
  };

  // TOUR-EDIT-META: Dirty-Warning Dialog bestätigen
  const handleConfirmTabChange = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
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

  if (!tournament || !schedule) {
    return (
      <div style={loadingStyle}>
        {loadingError ? (
          <div>
            <div style={{ ...loadingTextStyle, color: theme.colors.error, marginBottom: '16px' }}>
              ❌ Fehler beim Laden
            </div>
            <div style={{ fontSize: theme.fontSizes.md, color: theme.colors.text.secondary }}>
              {loadingError}
            </div>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  marginTop: '24px',
                  padding: '12px 24px',
                  background: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes.md,
                }}
              >
                Zurück zum Dashboard
              </button>
            )}
          </div>
        ) : (
          <div style={loadingTextStyle}>Lade Turnier...</div>
        )}
      </div>
    );
  }

  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    background: theme.colors.background,
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: CSSProperties = {
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    position: 'relative',
  };

  const backButtonStyle: CSSProperties = {
    position: 'absolute',
    left: theme.spacing.lg,
    top: '50%',
    transform: 'translateY(-50%)',
    padding: theme.spacing.sm,
    background: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.text.primary,
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    transition: 'all 0.2s ease',
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.fontSizes.xxl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    marginLeft: onBack ? '50px' : '0',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary,
    marginLeft: onBack ? '50px' : '0',
  };

  const tabBarStyle: CSSProperties = {
    display: 'flex',
    gap: theme.spacing.xs,
    padding: `0 ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', // IE/Edge
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    overflow: 'auto',
  };

  return (
    <div style={containerStyle}>
      {/* HEADER */}
      <header style={headerStyle}>
        {onBack && (
          <button
            onClick={onBack}
            style={backButtonStyle}
            title="Zurück zum Dashboard"
          >
            ←
          </button>
        )}
        <div style={titleStyle}>{tournament.title}</div>
        <div style={subtitleStyle}>
          {tournament.ageClass} · {formatDateGerman(tournament.date)} · {getLocationName(tournament)}
        </div>
      </header>

      {/* TAB BAR */}
      <nav style={tabBarStyle}>
        <TabButton
          label="Spielplan"
          isActive={activeTab === 'schedule'}
          onClick={() => handleTabChange('schedule')}
        />
        <TabButton
          label="Gruppen-Tabelle"
          isActive={activeTab === 'table'}
          onClick={() => handleTabChange('table')}
        />
        <TabButton
          label="Platzierung"
          isActive={activeTab === 'ranking'}
          onClick={() => handleTabChange('ranking')}
        />
        <TabButton
          label="Turnierleitung"
          isActive={activeTab === 'management'}
          onClick={() => handleTabChange('management')}
        />
        <TabButton
          label="Monitor"
          isActive={activeTab === 'monitor'}
          onClick={() => handleTabChange('monitor')}
        />
        <TabButton
          label="Teams"
          isActive={activeTab === 'teams'}
          onClick={() => handleTabChange('teams')}
        />
        <TabButton
          label="Einstellungen"
          isActive={activeTab === 'settings'}
          onClick={() => handleTabChange('settings')}
          isDirty={isSettingsDirty}
        />
      </nav>

      {/* TAB CONTENT */}
      <div style={contentStyle}>
        {activeTab === 'schedule' && (
          <ScheduleTab
            tournament={tournament}
            schedule={schedule}
            currentStandings={currentStandings}
            onTournamentUpdate={handleTournamentUpdate}
          />
        )}

        {activeTab === 'table' && (
          <TableTab
            tournament={tournament}
            schedule={schedule}
            currentStandings={currentStandings}
          />
        )}

        {activeTab === 'ranking' && (
          <RankingTab
            tournament={tournament}
            schedule={schedule}
            currentStandings={currentStandings}
          />
        )}

        {activeTab === 'management' && (
          <ManagementTab
            tournament={tournament}
            schedule={schedule}
            onTournamentUpdate={handleTournamentUpdate}
          />
        )}

        {activeTab === 'monitor' && (
          <MonitorTab
            tournament={tournament}
            schedule={schedule}
            currentStandings={currentStandings}
          />
        )}

        {activeTab === 'teams' && (
          <TeamsTab
            tournament={tournament}
            onTournamentUpdate={handleTournamentUpdate}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            tournament={tournament}
            onTournamentUpdate={handleTournamentUpdate}
            onDirtyChange={setIsSettingsDirty}
            onEditInWizard={onEditInWizard}
          />
        )}
      </div>

      {/* TOUR-EDIT-META: Dirty-Warning Dialog */}
      {showDirtyWarning && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: theme.colors.text.primary }}>
              Ungespeicherte Änderungen
            </h3>
            <p style={{ margin: '0 0 24px 0', color: theme.colors.text.secondary }}>
              Du hast Änderungen an den Turnier-Einstellungen vorgenommen, die noch nicht gespeichert wurden.
              Möchtest du die Änderungen verwerfen?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelTabChange}
                style={dialogButtonStyle('secondary')}
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmTabChange}
                style={dialogButtonStyle('danger')}
              >
                Verwerfen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// TAB BUTTON COMPONENT
// ============================================================================

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  isDirty?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick, isDirty }) => {
  const buttonStyle: CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    background: 'transparent',
    border: 'none',
    borderBottom: isActive ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
    color: isActive ? theme.colors.primary : theme.colors.text.secondary,
    fontSize: theme.fontSizes.md,
    fontWeight: isActive ? theme.fontWeights.semibold : theme.fontWeights.normal,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: theme.fonts.body,
  };

  const hoverStyle: CSSProperties = {
    ...buttonStyle,
    color: theme.colors.primary,
  };

  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      style={isHovered && !isActive ? hoverStyle : buttonStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {label}
      {isDirty && (
        <span style={{
          marginLeft: '6px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#FF9800',
          display: 'inline-block',
        }} title="Ungespeicherte Änderungen" />
      )}
    </button>
  );
};

// ============================================================================
// LOADING STYLES
// ============================================================================

const loadingStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.colors.background,
};

const loadingTextStyle: CSSProperties = {
  fontSize: theme.fontSizes.xl,
  color: theme.colors.text.secondary,
};

// TOUR-EDIT-META: Dialog Styles
const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: CSSProperties = {
  background: theme.colors.surface,
  borderRadius: theme.borderRadius.lg,
  padding: theme.spacing.xl,
  maxWidth: '400px',
  width: '90%',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

const dialogButtonStyle = (variant: 'secondary' | 'danger'): CSSProperties => ({
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  border: variant === 'secondary' ? `1px solid ${theme.colors.border}` : 'none',
  borderRadius: theme.borderRadius.md,
  fontSize: theme.fontSizes.md,
  fontWeight: theme.fontWeights.semibold,
  cursor: 'pointer',
  background: variant === 'danger' ? theme.colors.error : 'transparent',
  color: variant === 'danger' ? 'white' : theme.colors.text.secondary,
  transition: 'all 0.2s ease',
});
