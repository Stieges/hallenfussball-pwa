/**
 * DashboardScreen - Main Tournament Dashboard
 *
 * Three-tab structure (jeder Reiter in `components/dashboard/`):
 * 1. Turniere: Heute, Läuft, Kommende Turniere, Entwürfe (@OB-078)
 * 2. Archiv: Abgeschlossene und Abgebrochene (nach Jahr)
 * 3. Papierkorb: Soft-deleted tournaments (30-day retention)
 * Suche und Filter stehen in der Adresse (`?q=`, `?s=`, @OB-030).
 */

import { CSSProperties, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Tournament } from '../types/tournament';
import { Button } from '../components/ui';
import { Icons } from '../components/ui/Icons';
import { cssVars } from '../design-tokens';
import { getActiveTournaments, getTrashedTournaments, getRemainingDays } from '../utils/tournamentCategories';
import { ImportDialog } from '../components/dialogs/ImportDialog';
import { getAppTitle } from '../config/app';
import { useIsMobile } from '../hooks/useIsMobile';
import { useStartseiteFilter } from '../hooks/useStartseiteFilter';
import { AuthSection } from '../components/layout/AuthSection';
import { DashboardNav, SearchFilterBar, getTabFromPath } from '../components/dashboard';
import { DashboardTurniereTab } from '../components/dashboard/DashboardTurniereTab';
import { DashboardArchivTab } from '../components/dashboard/DashboardArchivTab';
import { DashboardPapierkorbTab } from '../components/dashboard/DashboardPapierkorbTab';
import { LegacyTournamentNotice } from '../components/dashboard/LegacyTournamentNotice';
import { useTournamentLimit } from '../features/auth/hooks/useTournamentLimit';
import { TournamentLimitModal, GuestBanner } from '../features/auth/components';

interface DashboardScreenProps {
  tournaments: Tournament[];
  onCreateNew: () => void;
  onTournamentClick: (tournament: Tournament) => void;
  onDeleteTournament: (id: string, title: string) => void;
  /** Speichert das importierte Turnier (@W1-041); wirft, wenn das Speichern scheitert. */
  onImportTournament: (tournament: Tournament) => Promise<void>;
  /** Weiter zum Spielplan nach dem Import einer Datei ohne Spielplan. */
  onContinueImport: (tournament: Tournament) => void;
  // Soft Delete Functions
  onSoftDelete?: (id: string, title: string) => void;
  onRestore?: (id: string, title: string) => void;
  onPermanentDelete?: (id: string, title: string) => void;
  /** „Papierkorb leeren“ (@LZ-094): die Rückfrage stellt der Reiter, gelöscht wird hier. */
  onEmptyTrash?: () => void;
  // Copy Tournament
  onCopyTournament?: (tournament: Tournament) => void;
  // Auth Navigation
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  tournaments,
  onCreateNew,
  onTournamentClick,
  onDeleteTournament,
  onImportTournament,
  onContinueImport,
  onSoftDelete,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  onCopyTournament,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToProfile,
  onNavigateToSettings,
}) => {
  const { t } = useTranslation('dashboard');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const { searchQuery, activeFilters, setSearchQuery, toggleFilter } = useStartseiteFilter();
  const isMobile = useIsMobile();
  const location = useLocation();

  // Tournament limit for anonymous users
  const { canCreate, isAtLimit, isNearLimit, isLimited } = useTournamentLimit();

  // Get active tab from URL path
  const activeTab = getTabFromPath(location.pathname);

  // Handle create new tournament with limit check
  const handleCreateNewClick = () => {
    if (!canCreate) {
      setShowLimitModal(true);
      return;
    }
    onCreateNew();
  };

  const activeTournaments = useMemo(() => getActiveTournaments(tournaments), [tournaments]);
  const trashedTournaments = useMemo(() => getTrashedTournaments(tournaments), [tournaments]);

  // Count tournaments expiring within 7 days
  const expiringSoonCount = useMemo(() => {
    return trashedTournaments.filter(tr => {
      const remaining = getRemainingDays(tr);

      return remaining !== null && remaining <= 7;
    }).length;
  }, [trashedTournaments]);

  const containerStyle: CSSProperties = {
    padding: isMobile ? '20px 16px' : '40px 20px',
    // Den Platz über der festen unteren Leiste reserviert die Fußzeile (Footer, @OB-022), hier nur der normale Abstand
    paddingBottom: isMobile ? cssVars.spacing.lg : '40px',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: isMobile ? '100vh' : 'auto',
  };

  const titleStyle: CSSProperties = {
    fontFamily: cssVars.fontFamilies.heading,
    fontSize: isMobile ? cssVars.fontSizes.xxl : cssVars.fontSizes.xxxl,
    margin: 0,
    background: cssVars.gradients.primary,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    // @OB-021: Titel einzeilig und ohne Trennung (Daniel 16.10.); Platz schafft die kompakte Offline-Marke unter 400 px
    whiteSpace: 'nowrap',
  };

  return (
    <div style={containerStyle}>
      {/* Header Group */}
      <div style={{ marginBottom: isMobile ? '24px' : '40px' }}>
        {/* Top Row: Title + Auth */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: cssVars.spacing.md,
          marginBottom: isMobile ? '16px' : '24px',
        }}>
          <h1 style={{ ...titleStyle, margin: 0 }}>{getAppTitle()}</h1>

          <div style={{ flexShrink: 0 }}>
            <AuthSection
              onNavigateToLogin={onNavigateToLogin}
              onNavigateToRegister={onNavigateToRegister}
              onNavigateToProfile={onNavigateToProfile}
              onNavigateToSettings={onNavigateToSettings}
            />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div style={{
          display: 'flex',
          gap: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
          flexDirection: isMobile ? 'row' : 'row',
          flexWrap: 'wrap',
        }}>
          <Button
            variant="secondary"
            onClick={() => setShowImportDialog(true)}
            icon={<Icons.Upload />}
            style={{
              padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
              fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
              fontWeight: cssVars.fontWeights.medium,
              flex: isMobile ? 1 : undefined,
            }}
            data-testid="dashboard-import-trigger"
          >
            {t('buttons.import')}
          </Button>

          <Button
            variant="primary"
            onClick={handleCreateNewClick}
            icon={<Icons.Plus />}
            disabled={isAtLimit}
            style={{
              padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
              fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
              fontWeight: cssVars.fontWeights.medium,
              flex: isMobile ? 1 : undefined,
              minHeight: cssVars.touchTargets.primary,
              ...(isAtLimit ? { opacity: 0.6 } : {}),
            }}
            data-primary
          >
            {isAtLimit ? t('buttons.limitReached') : t('buttons.newTournament')}
          </Button>
        </div>
      </div>

      {/* Offline: nur die Marke im Kopf (AuthSection), kein zweiter Kasten (C-OFFLINE-GLOBAL) */}
      {/* A-05 (@FU-007): beiseitegelegte Altformat-Turniere */}
      <LegacyTournamentNotice />

      {/* Guest Banner with Limit Warning (only on Turniere tab) */}
      {activeTab === 'turniere' && isLimited && (isNearLimit || isAtLimit) && (
        <GuestBanner
          onRegisterClick={onNavigateToRegister}
          dismissible={!isAtLimit}
        />
      )}

      {/* Desktop Navigation Tabs */}
      {!isMobile && (
        <DashboardNav
          trashedCount={trashedTournaments.length}
          expiringSoonCount={expiringSoonCount}
        />
      )}

      {/* Search and Filter - Only on Turniere tab */}
      {activeTab === 'turniere' && activeTournaments.length > 0 && (
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilters={activeFilters}
          onFilterToggle={toggleFilter}
        />
      )}

      {/* Tab Content */}
      {activeTab === 'turniere' && (
        <DashboardTurniereTab
          activeTournaments={activeTournaments}
          searchQuery={searchQuery}
          activeFilters={activeFilters}
          onTournamentClick={onTournamentClick}
          onCopyTournament={onCopyTournament}
          onSoftDelete={onSoftDelete}
          onDeleteTournament={onDeleteTournament}
        />
      )}

      {activeTab === 'archiv' && (
        <DashboardArchivTab
          activeTournaments={activeTournaments}
          onTournamentClick={onTournamentClick}
          onCopyTournament={onCopyTournament}
          onSoftDelete={onSoftDelete}
        />
      )}

      {activeTab === 'papierkorb' && (
        <DashboardPapierkorbTab
          trashedTournaments={trashedTournaments}
          onTournamentClick={onTournamentClick}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          onEmptyTrash={onEmptyTrash}
        />
      )}

      {/* Import Dialog */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={onImportTournament}
        onContinue={onContinueImport}
      />

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <DashboardNav
          trashedCount={trashedTournaments.length}
          expiringSoonCount={expiringSoonCount}
        />
      )}

      {/* Tournament Limit Modal for Anonymous Users */}
      <TournamentLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        onRegisterClick={onNavigateToRegister}
        onLoginClick={onNavigateToLogin}
      />
    </div>
  );
};
