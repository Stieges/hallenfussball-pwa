/**
 * DashboardScreen - Main Tournament Dashboard
 *
 * Three-tab structure:
 * 1. Turniere: Running, Upcoming, Draft (active tournaments)
 * 2. Archiv: Finished tournaments (grouped by year)
 * 3. Papierkorb: Soft-deleted tournaments (30-day retention)
 */

import { CSSProperties, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Tournament, TRASH_RETENTION_DAYS } from '../types/tournament';
import { TournamentCard } from '../components/TournamentCard';
import { TrashTournamentCard } from '../components/TrashTournamentCard';
import { Button, CollapsibleSection } from '../components/ui';
import { Icons } from '../components/ui/Icons';
import { ConfirmDialog, useConfirmDialog } from '../components/ui/ConfirmDialog';
import { cssVars } from '../design-tokens';
import {
  categorizeTournaments,
  CategorizedTournaments,
  getActiveTournaments,
  getTrashedTournaments,
  getRemainingDays,
  getExtendedCategories,
} from '../utils/tournamentCategories';
import { ImportDialog } from '../components/dialogs/ImportDialog';
import { getAppTitle } from '../config/app';
import { useIsMobile } from '../hooks/useIsMobile';
import { AuthSection } from '../components/layout/AuthSection';
import { DashboardNav, SearchFilterBar, FilterChip, getTabFromPath } from '../components/dashboard';
import { OfflineModeIndicator } from '../components/OfflineModeIndicator';
import { useTournamentLimit } from '../features/auth/hooks/useTournamentLimit';
import { TournamentLimitModal, GuestBanner } from '../features/auth/components';

interface DashboardScreenProps {
  tournaments: Tournament[];
  onCreateNew: () => void;
  onTournamentClick: (tournament: Tournament) => void;
  onDeleteTournament: (id: string, title: string) => void;
  onImportTournament: (tournament: Tournament) => void;
  // Soft Delete Functions
  onSoftDelete?: (id: string, title: string) => void;
  onRestore?: (id: string, title: string) => void;
  onPermanentDelete?: (id: string, title: string) => void;
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
  onSoftDelete,
  onRestore,
  onPermanentDelete,
  onCopyTournament,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToProfile,
  onNavigateToSettings,
}) => {
  const { t } = useTranslation('dashboard');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
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

  // Empty Trash Confirmation Dialog
  const emptyTrashDialog = useConfirmDialog({
    title: t('trash.emptyTrashTitle'),
    message: t('trash.emptyTrashMessage'),
    variant: 'danger',
    confirmText: t('trash.emptyTrashConfirm'),
  });

  // Filter tournaments based on active tab
  const activeTournaments = useMemo(() => getActiveTournaments(tournaments), [tournaments]);
  const trashedTournaments = useMemo(() => getTrashedTournaments(tournaments), [tournaments]);
  const categorized: CategorizedTournaments = useMemo(
    () => categorizeTournaments(activeTournaments),
    [activeTournaments]
  );

  // Handle filter toggle
  const handleFilterToggle = (filter: FilterChip) => {
    setActiveFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  // Filter tournaments by search query
  const filterBySearch = (tournament: Tournament): boolean => {
    if (!searchQuery.trim()) { return true; }
    const query = searchQuery.toLowerCase();
    return (
      tournament.title.toLowerCase().includes(query) ||
      (tournament.organizer?.toLowerCase().includes(query) ?? false) ||
      tournament.ageClass.toLowerCase().includes(query) ||
      (tournament.location.city?.toLowerCase().includes(query) ?? false) ||
      tournament.location.name.toLowerCase().includes(query)
    );
  };

  // Apply search and filter to categorized tournaments
  const filteredCategorized = useMemo(() => {
    const result: CategorizedTournaments = {
      running: categorized.running.filter(filterBySearch),
      upcoming: categorized.upcoming.filter(filterBySearch),
      finished: categorized.finished.filter(filterBySearch),
      draft: categorized.draft.filter(filterBySearch),
      trashed: categorized.trashed.filter(filterBySearch),
    };

    // If filters are active, only show matching categories
    if (activeFilters.length > 0) {
      if (!activeFilters.includes('running')) { result.running = []; }
      if (!activeFilters.includes('upcoming')) { result.upcoming = []; }
      if (!activeFilters.includes('finished')) { result.finished = []; }
      if (!activeFilters.includes('draft')) { result.draft = []; }
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterBySearch uses searchQuery
  }, [categorized, activeFilters, searchQuery]);

  // Extended categories with year grouping for archive
  const extendedCategories = useMemo(
    () => getExtendedCategories(activeTournaments),
    [activeTournaments]
  );

  // Get sorted years (most recent first)
  const sortedYears = useMemo(() => {
    return Object.keys(extendedCategories.archivedByYear)
      .map(Number)
      .sort((a, b) => b - a);
  }, [extendedCategories.archivedByYear]);

  // Count tournaments expiring within 7 days
  const expiringSoonCount = useMemo(() => {
    return trashedTournaments.filter(t => {
      const remaining = getRemainingDays(t);

      return remaining !== null && remaining <= 7;
    }).length;
  }, [trashedTournaments]);

  const containerStyle: CSSProperties = {
    padding: isMobile ? '20px 16px' : '40px 20px',
    // Add bottom padding on mobile for fixed bottom nav (64px nav + safe area + extra buffer)
    // Add extra bottom padding on mobile for fixed bottom nav (80px nav + safe area + 80px buffer)
    paddingBottom: isMobile ? 'calc(160px + env(safe-area-inset-bottom, 20px))' : '40px',
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
  };

  const sectionStyle: CSSProperties = {
    marginBottom: isMobile ? '32px' : '48px',
  };

  const sectionHeaderStyle: CSSProperties = {
    fontSize: isMobile ? '18px' : '24px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    marginBottom: isMobile ? '12px' : '20px',
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '8px' : '12px',
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: isMobile ? '12px' : '20px',
  };

  const emptyStateStyle: CSSProperties = {
    padding: '40px 20px',
    textAlign: 'center',
    background: 'rgba(0,0,0,0.02)',
    borderRadius: cssVars.borderRadius.md,
    border: `1px dashed ${cssVars.colors.border}`,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
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
              ...(isAtLimit ? { opacity: 0.6 } : {}),
            }}
          >
            {isAtLimit ? t('buttons.limitReached') : t('buttons.newTournament')}
          </Button>
        </div>
      </div>

      {/* Offline Mode Indicator */}
      <OfflineModeIndicator />

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
          onFilterToggle={handleFilterToggle}
        />
      )}

      {/* Tab Content */}
      {activeTab === 'turniere' && (
        <>
          {/* Check if user has any active tournaments */}
          {activeTournaments.length === 0 && (
            <div
              style={{
                padding: isMobile ? '40px 16px' : '60px 20px',
                textAlign: 'center',
                background: cssVars.colors.surface,
                borderRadius: cssVars.borderRadius.lg,
                border: `1px solid ${cssVars.colors.border}`,
              }}
            >
              <div style={{ marginBottom: '16px', opacity: 0.6 }}>
                <Icons.Trophy size={isMobile ? 40 : 48} color={cssVars.colors.textSecondary} />
              </div>
              <h2 style={{ fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl, marginBottom: '8px' }}>
                {t('emptyState.noTournaments')}
              </h2>
              <p style={{ color: cssVars.colors.textSecondary, marginBottom: '24px', fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md }}>
                {t('emptyState.noTournamentsHint')}
              </p>
            </div>
          )}

          {/* Sections with CollapsibleSection (only render if tournaments exist) */}
          {activeTournaments.length > 0 && (
            <>
              {/* Search results empty state */}
              {(searchQuery || activeFilters.length > 0) &&
                filteredCategorized.running.length === 0 &&
                filteredCategorized.upcoming.length === 0 &&
                filteredCategorized.draft.length === 0 && (
                  <div style={{
                    padding: isMobile ? '40px 16px' : '60px 20px',
                    textAlign: 'center',
                    background: cssVars.colors.surface,
                    borderRadius: cssVars.borderRadius.md,
                    border: `1px solid ${cssVars.colors.border}`,
                  }}>
                    <div style={{ marginBottom: cssVars.spacing.sm, opacity: 0.5 }}>
                      <Icons.Search size={40} color={cssVars.colors.textSecondary} />
                    </div>
                    <p style={{ margin: 0, color: cssVars.colors.textSecondary }}>
                      {t('emptyState.noSearchResults')}
                    </p>
                    {searchQuery && (
                      <p style={{ margin: `${cssVars.spacing.xs} 0 0`, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textMuted }}>
                        {t('emptyState.noSearchResultsFor', { query: searchQuery })}
                      </p>
                    )}
                  </div>
                )}

              {/* 1. Aktuell laufende Turniere - Always open, highlighted */}
              {filteredCategorized.running.length > 0 && (
                <CollapsibleSection
                  title={t('sections.runningTournaments')}
                  icon={<Icons.Play size={20} color={cssVars.colors.statusLive} />}
                  badge={filteredCategorized.running.length}
                  defaultOpen={true}
                  variant="live"
                  testId="section-running"
                >
                  <div style={gridStyle}>
                    {filteredCategorized.running.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        categoryLabel="running"
                        onClick={() => onTournamentClick(tournament)}
                        onCopy={onCopyTournament ? () => onCopyTournament(tournament) : undefined}
                      // No delete for running tournaments
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* 2. Bevorstehende Turniere - Open if no running */}
              {filteredCategorized.upcoming.length > 0 && (
                <CollapsibleSection
                  title={t('sections.upcomingTournaments')}
                  icon={<Icons.Calendar size={20} color={cssVars.colors.statusUpcoming} />}
                  badge={filteredCategorized.upcoming.length}
                  defaultOpen={filteredCategorized.running.length === 0}
                  testId="section-upcoming"
                >
                  <div style={gridStyle}>
                    {filteredCategorized.upcoming.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        categoryLabel="upcoming"
                        onClick={() => onTournamentClick(tournament)}
                        onCopy={onCopyTournament ? () => onCopyTournament(tournament) : undefined}
                        onSoftDelete={onSoftDelete ? () => onSoftDelete(tournament.id, tournament.title) : () => onDeleteTournament(tournament.id, tournament.title)}
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* 3. Gespeicherte Turniere (Entwürfe) - Collapsed by default */}
              {filteredCategorized.draft.length > 0 && (
                <CollapsibleSection
                  title={t('sections.savedDrafts')}
                  icon={<Icons.Save size={20} color={cssVars.colors.statusDraft} />}
                  badge={filteredCategorized.draft.length}
                  defaultOpen={false}
                  testId="section-draft"
                >
                  <div style={gridStyle}>
                    {filteredCategorized.draft.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        categoryLabel="draft"
                        onClick={() => onTournamentClick(tournament)}
                        onCopy={onCopyTournament ? () => onCopyTournament(tournament) : undefined}
                        onSoftDelete={onSoftDelete ? () => onSoftDelete(tournament.id, tournament.title) : () => onDeleteTournament(tournament.id, tournament.title)}
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Empty state when no filters/search active and all sections are empty */}
              {!searchQuery && activeFilters.length === 0 &&
                categorized.running.length === 0 && categorized.upcoming.length === 0 && categorized.draft.length === 0 && (
                  <div style={emptyStateStyle}>{t('emptyState.noActiveTournaments')}</div>
                )}
            </>
          )}
        </>
      )}

      {activeTab === 'archiv' && (
        <>
          {/* Archive Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: cssVars.spacing.sm,
            marginBottom: cssVars.spacing.md,
          }}>
            <Icons.Archive size={24} color={cssVars.colors.statusFinished} />
            <h2 style={{
              fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl,
              fontWeight: cssVars.fontWeights.bold,
              color: cssVars.colors.textPrimary,
              margin: 0,
            }}>
              {t('sections.archive')}
            </h2>
            <span style={{
              fontSize: cssVars.fontSizes.sm,
              color: cssVars.colors.textSecondary,
            }}>
              {t('sections.tournamentCount', { count: categorized.finished.length })}
            </span>
          </div>

          {categorized.finished.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ marginBottom: cssVars.spacing.sm, opacity: 0.5 }}>
                <Icons.Archive size={40} color={cssVars.colors.textSecondary} />
              </div>
              <p>{t('emptyState.noArchivedTournaments')}</p>
              <p style={{ fontSize: cssVars.fontSizes.sm, marginTop: cssVars.spacing.xs }}>
                {t('emptyState.archivedHint')}
              </p>
            </div>
          ) : (
            <>
              {sortedYears.map((year, index) => {
                const tournamentsForYear = extendedCategories.archivedByYear[year];
                return (
                  <CollapsibleSection
                    key={year}
                    title={`${year}`}
                    icon={<Icons.Calendar size={18} color={cssVars.colors.textSecondary} />}
                    badge={tournamentsForYear.length}
                    defaultOpen={index === 0} // Most recent year expanded
                    testId={`archive-year-${year}`}
                  >
                    <div style={gridStyle}>
                      {tournamentsForYear.map((tournament) => (
                        <TournamentCard
                          key={tournament.id}
                          tournament={tournament}
                          categoryLabel="archived"
                          onClick={() => onTournamentClick(tournament)}
                          onCopy={onCopyTournament ? () => onCopyTournament(tournament) : undefined}
                          onSoftDelete={onSoftDelete ? () => onSoftDelete(tournament.id, tournament.title) : undefined}
                        />
                      ))}
                    </div>
                  </CollapsibleSection>
                );
              })}
            </>
          )}
        </>
      )}

      {activeTab === 'papierkorb' && (
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <Icons.Trash size={22} color={cssVars.colors.statusWarning} />
            </span>
            {t('sections.trash')}
            <span style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 'normal', color: cssVars.colors.textSecondary }}>
              ({trashedTournaments.length})
            </span>
          </h2>
          <p style={{
            color: cssVars.colors.textSecondary,
            fontSize: cssVars.fontSizes.sm,
            marginBottom: cssVars.spacing.md,
          }}>
            {t('trash.retentionInfo', { days: TRASH_RETENTION_DAYS })}
          </p>
          {trashedTournaments.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ marginBottom: cssVars.spacing.sm, opacity: 0.5 }}>
                <Icons.Trash size={40} color={cssVars.colors.textSecondary} />
              </div>
              <p style={{ margin: 0, marginBottom: cssVars.spacing.xs }}>{t('emptyState.trashEmpty')}</p>
              <p style={{ fontSize: cssVars.fontSizes.sm, margin: 0, color: cssVars.colors.textMuted }}>
                {t('emptyState.trashHint')}
              </p>
            </div>
          ) : (
            <>
              <div style={gridStyle}>
                {trashedTournaments.map((tournament) => {
                  const remainingDays = getRemainingDays(tournament);
                  const handleRestore = () => {
                    if (onRestore) {
                      onRestore(tournament.id, tournament.title);
                    }
                  };
                  const handlePermanentDelete = () => {
                    if (onPermanentDelete) {
                      onPermanentDelete(tournament.id, tournament.title);
                    }
                  };
                  return (
                    <TrashTournamentCard
                      key={tournament.id}
                      tournament={tournament}
                      remainingDays={remainingDays ?? 0}
                      onClick={() => onTournamentClick(tournament)}
                      onRestore={handleRestore}
                      onPermanentDelete={handlePermanentDelete}
                    />
                  );
                })}
              </div>
              {/* Empty Trash Button - Only show if there are multiple items */}
              {trashedTournaments.length > 1 && onPermanentDelete && (
                <div style={{ marginTop: cssVars.spacing.lg, textAlign: 'center' }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void (async () => {
                        const confirmed = await emptyTrashDialog.confirm({
                          message: t('trash.emptyTrashMessageCount', { count: trashedTournaments.length }),
                        });
                        if (confirmed) {
                          trashedTournaments.forEach(t => onPermanentDelete(t.id, t.title));
                        }
                      })();
                    }}
                    icon={<Icons.Trash size={16} />}
                    style={{
                      color: cssVars.colors.error,
                      borderColor: cssVars.colors.errorBorder,
                    }}
                  >
                    {t('trash.emptyTrashButton', { count: trashedTournaments.length })}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Import Dialog */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={(tournament) => {
          onImportTournament(tournament);
          setShowImportDialog(false);
        }}
      />

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <DashboardNav
          trashedCount={trashedTournaments.length}
          expiringSoonCount={expiringSoonCount}
        />
      )}

      {/* Confirm Dialog for Empty Trash */}
      <ConfirmDialog {...emptyTrashDialog.dialogProps} />

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
