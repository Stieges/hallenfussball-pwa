/**
 * TournamentManagementScreen - Hauptscreen für veröffentlichte Turniere
 *
 * Tab-Navigation für Veranstalter:
 * 1. Spielplan - Editable Spielplan mit Ergebniseingabe
 * 2. Turnierleitung - Match Cockpit (Kampfgericht)
 * 3. Monitor - Große Zuschauer-Ansicht
 */

import { useState } from 'react';
import { CSSProperties } from 'react';
import { borderRadius, colors, fontFamilies, fontSizes, fontSizesMd3, fontWeights, spacing } from '../design-tokens';
import { Tournament } from '../types/tournament';
import { getLocationName, formatDateGerman } from '../utils/locationHelpers';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTournamentSync } from '../hooks/useTournamentSync';
import { BottomNavigation, BottomSheet, BottomSheetItem, Icons } from '../components/ui';
import type { BottomNavTab } from '../components/ui';

// Tab Components
import { ScheduleTab } from '../features/tournament-management/ScheduleTab';
import { TabellenTab } from '../features/tournament-management/TabellenTab';
import { ManagementTab } from '../features/tournament-management/ManagementTab';
import { MonitorTab } from '../features/tournament-management/MonitorTab';
import { SettingsTab } from '../features/tournament-management/SettingsTab';
import { TeamsTab } from '../features/tournament-management/TeamsTab';

interface TournamentManagementScreenProps {
  tournamentId: string;
  onBack?: () => void;
  onEditInWizard?: (tournament: Tournament, targetStep?: number) => void;
}

type TabType = 'schedule' | 'tabellen' | 'management' | 'monitor' | 'teams' | 'settings';

export const TournamentManagementScreen: React.FC<TournamentManagementScreenProps> = ({
  tournamentId,
  onBack,
  onEditInWizard,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');

  // Mobile Navigation
  const isMobile = useIsMobile();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // TOUR-EDIT-META: Dirty-State-Tracking für SettingsTab
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<TabType | null>(null);
  const [showDirtyWarning, setShowDirtyWarning] = useState(false);

  // Tournament-Schedule sync via custom hook
  const {
    tournament,
    schedule,
    currentStandings,
    loadingError,
    handleTournamentUpdate,
  } = useTournamentSync(tournamentId);

  // TOUR-EDIT-META: Tab-Wechsel mit Dirty-State-Prüfung
  const handleTabChange = (newTab: TabType) => {
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

  // Handle mobile bottom navigation
  const handleMobileNavChange = (tab: BottomNavTab) => {
    if (tab === 'more') {
      setShowMoreMenu(true);
    } else {
      handleTabChange(tab as TabType);
    }
  };

  // Handle selection from "more" menu
  const handleMoreMenuSelect = (tab: TabType) => {
    setShowMoreMenu(false);
    handleTabChange(tab);
  };

  // Loading / Error state
  if (!tournament || !schedule) {
    return (
      <div style={loadingStyle}>
        {loadingError ? (
          <div>
            <div style={{ ...loadingTextStyle, color: colors.error, marginBottom: '16px' }}>
              ❌ Fehler beim Laden
            </div>
            <div style={{ fontSize: fontSizes.md, color: colors.textSecondary }}>
              {loadingError}
            </div>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  marginTop: '24px',
                  padding: '12px 24px',
                  background: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  fontSize: fontSizes.md,
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
    background: colors.background,
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: CSSProperties = {
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
    position: 'relative',
  };

  const backButtonStyle: CSSProperties = {
    position: 'absolute',
    left: spacing.lg,
    top: '50%',
    transform: 'translateY(-50%)',
    padding: spacing.sm,
    background: 'transparent',
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    color: colors.textPrimary,
    fontSize: fontSizesMd3.headlineMedium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    transition: 'all 0.2s ease',
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginLeft: onBack ? '50px' : '0',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    marginLeft: onBack ? '50px' : '0',
  };

  const tabBarStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.xs,
    padding: `0 ${spacing.lg}`,
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surface,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    overflow: 'auto',
    paddingBottom: isMobile ? '72px' : undefined,
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

      {/* TAB BAR - Desktop only */}
      {!isMobile && (
        <nav style={tabBarStyle}>
          <TabButton label="Spielplan" isActive={activeTab === 'schedule'} onClick={() => handleTabChange('schedule')} />
          <TabButton label="Tabellen" isActive={activeTab === 'tabellen'} onClick={() => handleTabChange('tabellen')} />
          <TabButton label="Live" isActive={activeTab === 'management'} onClick={() => handleTabChange('management')} />
          <TabButton label="Monitor" isActive={activeTab === 'monitor'} onClick={() => handleTabChange('monitor')} />
          <TabButton label="Teams" isActive={activeTab === 'teams'} onClick={() => handleTabChange('teams')} />
          <TabButton label="Einstellungen" isActive={activeTab === 'settings'} onClick={() => handleTabChange('settings')} isDirty={isSettingsDirty} />
        </nav>
      )}

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
        {activeTab === 'tabellen' && (
          <TabellenTab
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
            <h3 style={{ margin: '0 0 16px 0', color: colors.textPrimary }}>
              Ungespeicherte Änderungen
            </h3>
            <p style={{ margin: '0 0 24px 0', color: colors.textSecondary }}>
              Du hast Änderungen an den Turnier-Einstellungen vorgenommen, die noch nicht gespeichert wurden.
              Möchtest du die Änderungen verwerfen?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleCancelTabChange} style={dialogButtonStyle('secondary')}>
                Abbrechen
              </button>
              <button onClick={handleConfirmTabChange} style={dialogButtonStyle('danger')}>
                Verwerfen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION */}
      {isMobile && (
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={handleMobileNavChange}
        />
      )}

      {/* MOBILE "MEHR" BOTTOM SHEET */}
      <BottomSheet
        isOpen={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        title="Mehr"
      >
        <BottomSheetItem
          icon={<Icons.Users size={20} color="currentColor" />}
          label="Teams"
          description="Teams verwalten"
          onClick={() => handleMoreMenuSelect('teams')}
          isActive={activeTab === 'teams'}
        />
        <BottomSheetItem
          icon={<Icons.Settings size={20} color="currentColor" />}
          label="Einstellungen"
          description="Turnier konfigurieren"
          onClick={() => handleMoreMenuSelect('settings')}
          isActive={activeTab === 'settings'}
        />
        <BottomSheetItem
          icon={<Icons.Monitor size={20} color="currentColor" />}
          label="Monitor"
          description="Großbildschirm-Ansicht"
          onClick={() => handleMoreMenuSelect('monitor')}
          isActive={activeTab === 'monitor'}
        />
      </BottomSheet>
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
  const [isHovered, setIsHovered] = useState(false);

  const buttonStyle: CSSProperties = {
    padding: `${spacing.md} ${spacing.lg}`,
    background: 'transparent',
    border: 'none',
    borderBottom: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
    color: isActive ? colors.primary : (isHovered ? colors.primary : colors.textSecondary),
    fontSize: fontSizes.md,
    fontWeight: isActive ? fontWeights.semibold : fontWeights.normal,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: fontFamilies.body,
  };

  return (
    <button
      style={buttonStyle}
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
          background: colors.warning,
          display: 'inline-block',
        }} title="Ungespeicherte Änderungen" />
      )}
    </button>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const loadingStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: colors.background,
};

const loadingTextStyle: CSSProperties = {
  fontSize: fontSizes.xl,
  color: colors.textSecondary,
};

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
  background: colors.surface,
  borderRadius: borderRadius.lg,
  padding: spacing.xl,
  maxWidth: '400px',
  width: '90%',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

const dialogButtonStyle = (variant: 'secondary' | 'danger'): CSSProperties => ({
  padding: `${spacing.sm} ${spacing.lg}`,
  border: variant === 'secondary' ? `1px solid ${colors.border}` : 'none',
  borderRadius: borderRadius.md,
  fontSize: fontSizes.md,
  fontWeight: fontWeights.semibold,
  cursor: 'pointer',
  background: variant === 'danger' ? colors.error : 'transparent',
  color: variant === 'danger' ? 'white' : colors.textSecondary,
  transition: 'all 0.2s ease',
});
