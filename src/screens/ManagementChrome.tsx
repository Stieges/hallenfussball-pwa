/**
 * ManagementChrome – Kopf mit Reitern und mobile Navigation der Turnierverwaltung (Plan LT-2, Ruling R2: aus
 * `TournamentManagementScreen` ausgelagert). Im Live-Bereich mit laufendem oder bereitem Spiel tritt die App zurück
 * (`useCockpitFrame().vollbild`, @SL-140): dann rendert der Bildschirm weder den Kopf noch die Navigation.
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { borderWidths, cssVars, fontSizesMd3 } from '../design-tokens';
import { BottomNavigation, BottomSheet, BottomSheetItem, Icons } from '../components/ui';
import type { BottomNavTab } from '../components/ui';
import type { Tournament } from '../types/tournament';
import { getLocationName, formatDateGerman } from '../utils/locationHelpers';
import type { TournamentTab } from '../features/tournament-management/utils/tournamentTabUtils';
import { AuthSection } from '../components/layout/AuthSection';
import { OwnTournamentsMoreItem } from '../features/helpers/components/OwnTournamentsMoreItem';
import { EngineOutboxHeaderStatus } from '../features/tournament-management/components/EngineOutboxHeaderStatus';
import { joinMeta } from '../core/view';
import { KlaerungslisteEinstieg } from '../features/klaerungsliste/KlaerungslisteEinstieg';

export interface ManagementHeaderProps {
  tournament: Tournament;
  isMobile: boolean;
  activeTab: TournamentTab;
  isSettingsDirty: boolean;
  onBack?: () => void;
  onTabChange: (tab: TournamentTab) => void;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings?: () => void;
}

const headerStyle: CSSProperties = {
  padding: cssVars.spacing.lg,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  background: cssVars.colors.surface,
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const headerContentStyle: CSSProperties = { flex: 1, minWidth: 0 };
const backButtonStyle: CSSProperties = {
  padding: cssVars.spacing.sm,
  background: 'transparent',
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
  fontSize: fontSizesMd3.headlineMedium,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: cssVars.touchTargets.minimum,
  height: cssVars.touchTargets.minimum,
  transition: 'all 0.2s ease',
  flexShrink: 0,
  marginRight: cssVars.spacing.md,
};
const titleStyle: CSSProperties = {
  fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textPrimary,
  marginBottom: cssVars.spacing.xs,
  // @OB-025 / Gestaltungsregel 1 und 2: der Turniername bricht an Leerzeichen um, nie „…“ und nie getrennt;
  // passt er nicht, wird die Schrift stufenweise kleiner (zwischen zwei Token-Stufen)
  fontSize: `clamp(${cssVars.fontSizes.lg}, 5vw, ${cssVars.fontSizes.xxl})`,
  overflowWrap: 'break-word',
  hyphens: 'manual',
};
const subtitleStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textSecondary,
  overflowWrap: 'break-word',
  hyphens: 'manual',
};
const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.xs,
  padding: `0 ${cssVars.spacing.lg}`,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  background: cssVars.colors.surface,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};
const adminButtonStyle: CSSProperties = {
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  background: cssVars.colors.primarySubtle,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.primaryBorder}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.primary,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.medium,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  marginRight: cssVars.spacing.md,
  transition: 'all 0.15s ease',
  flexShrink: 0,
  // @OB-022: Tippfläche mindestens 44 Bildpunkte
  justifyContent: 'center',
  minHeight: cssVars.touchTargets.minimum,
  minWidth: cssVars.touchTargets.minimum,
};

export function ManagementHeader(p: ManagementHeaderProps): ReactElement {
  const navigate = useNavigate();
  const { tournament, isMobile, activeTab, isSettingsDirty, onTabChange } = p;
  return (
    <>
      <header style={headerStyle}>
        {p.onBack && (
          <button onClick={p.onBack} style={backButtonStyle} title="Zurück zum Dashboard">←</button>
        )}
        <div style={headerContentStyle}>
          <div style={titleStyle}>{tournament.title}</div>
          <div style={subtitleStyle}>
            {joinMeta([tournament.ageClass, formatDateGerman(tournament.date), getLocationName(tournament)], ' · ')}
          </div>
        </div>
        <button onClick={() => { void navigate(`/tournament/${tournament.id}/admin`); }} style={adminButtonStyle} title="Admin Center öffnen">
          <span>⚙️</span>
          {!isMobile && <span>Admin Center</span>}
        </button>
        {/* A-08f3e3 (M-1): wartende/nicht übernommene Einträge; im Live-Tab zeigt sie das Cockpit selbst */}
        {activeTab !== 'management' && <EngineOutboxHeaderStatus tournament={tournament} />}
        {/* B-50: Klärungsliste der Turnierleitung (Zähler offener Einträge, Liste über ?klaerung=1) */}
        <KlaerungslisteEinstieg tournament={tournament} compact={isMobile} />
        <AuthSection
          onNavigateToLogin={p.onNavigateToLogin}
          onNavigateToRegister={p.onNavigateToRegister}
          onNavigateToProfile={p.onNavigateToProfile}
          onNavigateToSettings={p.onNavigateToSettings}
        />
      </header>

      {!isMobile && (
        <nav style={tabBarStyle}>
          <TabButton label="Spielplan" isActive={activeTab === 'schedule'} onClick={() => onTabChange('schedule')} />
          <TabButton label="Tabellen" isActive={activeTab === 'tabellen'} onClick={() => onTabChange('tabellen')} />
          <TabButton label="Live" isActive={activeTab === 'management'} onClick={() => onTabChange('management')} />
          <TabButton label="Monitor" isActive={activeTab === 'monitor'} onClick={() => onTabChange('monitor')} />
          <TabButton label="Teams" isActive={activeTab === 'teams'} onClick={() => onTabChange('teams')} />
          <TabButton label="Einstellungen" isActive={activeTab === 'settings'} onClick={() => onTabChange('settings')} isDirty={isSettingsDirty} />
        </nav>
      )}
    </>
  );
}

export interface ManagementMobileNavProps {
  /** Für „Meine Turniere auf diesem Handy“ (Helfer-Gerät, @HE-110). */
  tournamentId?: string;
  activeTab: TournamentTab;
  onTabChange: (tab: TournamentTab) => void;
}

export function ManagementMobileNav({ activeTab, onTabChange, tournamentId }: ManagementMobileNavProps): ReactElement {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const wechsle = (tab: BottomNavTab) => {
    if (tab === 'more') { setShowMoreMenu(true); } else { onTabChange(tab); }
  };
  const ausMehr = (tab: TournamentTab) => { setShowMoreMenu(false); onTabChange(tab); };
  return (
    <>
      <BottomNavigation activeTab={activeTab} onTabChange={wechsle} />
      <BottomSheet isOpen={showMoreMenu} onClose={() => setShowMoreMenu(false)} title="Mehr">
        <BottomSheetItem icon={<Icons.Users size={20} color="currentColor" />} label="Teams" description="Teams verwalten" onClick={() => ausMehr('teams')} isActive={activeTab === 'teams'} />
        <BottomSheetItem icon={<Icons.Settings size={20} color="currentColor" />} label="Einstellungen" description="Turnier konfigurieren" onClick={() => ausMehr('settings')} isActive={activeTab === 'settings'} />
        <BottomSheetItem icon={<Icons.Monitor size={20} color="currentColor" />} label="Monitor" description="Display-Konfiguration" onClick={() => ausMehr('monitor')} isActive={activeTab === 'monitor'} />
        {showMoreMenu && tournamentId && <OwnTournamentsMoreItem tournamentId={tournamentId} onBeforeNavigate={() => setShowMoreMenu(false)} />}
      </BottomSheet>
    </>
  );
}

interface TabButtonProps { label: string; isActive: boolean; onClick: () => void; isDirty?: boolean }

const TabButton = ({ label, isActive, onClick, isDirty }: TabButtonProps): ReactElement => {
  const [isHovered, setIsHovered] = useState(false);
  const buttonStyle: CSSProperties = {
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: 'transparent',
    border: 'none',
    borderBottom: `${borderWidths.strong} solid ${isActive ? cssVars.colors.primary : 'transparent'}`,
    color: isActive ? cssVars.colors.primary : (isHovered ? cssVars.colors.primary : cssVars.colors.textSecondary),
    fontSize: cssVars.fontSizes.md,
    fontWeight: isActive ? cssVars.fontWeights.semibold : cssVars.fontWeights.normal,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: cssVars.fontFamilies.body,
  };
  return (
    <button
      style={buttonStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`desktop-tab-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label}
      {isDirty && (
        <span
          style={{ marginLeft: cssVars.spacing.xs, width: cssVars.spacing.sm, height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.full, background: cssVars.colors.warning, display: 'inline-block' }}
          title="Ungespeicherte Änderungen"
        />
      )}
    </button>
  );
};
