/**
 * DashboardScreen - Main Tournament Dashboard
 *
 * Three-tab structure:
 * 1. Turniere: Running, Upcoming, Draft (active tournaments)
 * 2. Archiv: Finished tournaments (grouped by year)
 * 3. Papierkorb: Soft-deleted tournaments (30-day retention)
 */

import { CSSProperties, useState, useMemo } from 'react';
import { Tournament, TRASH_RETENTION_DAYS } from '../types/tournament';
import { TournamentCard } from '../components/TournamentCard';
import { TrashTournamentCard } from '../components/TrashTournamentCard';
import { Button, CollapsibleSection } from '../components/ui';
import { Icons } from '../components/ui/Icons';
import { borderRadius, colors, fontFamilies, fontSizes, fontWeights, gradients, spacing } from '../design-tokens';
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
import { DashboardNav, DashboardTab } from '../components/dashboard';

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
  // Auth Navigation
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToProfile: () => void;
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
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToProfile,
}) => {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('turniere');
  const isMobile = useIsMobile();

  // Filter tournaments based on active tab
  const activeTournaments = useMemo(() => getActiveTournaments(tournaments), [tournaments]);
  const trashedTournaments = useMemo(() => getTrashedTournaments(tournaments), [tournaments]);
  const categorized: CategorizedTournaments = useMemo(
    () => categorizeTournaments(activeTournaments),
    [activeTournaments]
  );

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
    // Add bottom padding on mobile for fixed bottom nav (64px nav + safe area)
    paddingBottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 0px) + 20px)' : '40px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isMobile ? '24px' : '40px',
    flexWrap: 'wrap',
    gap: isMobile ? '12px' : '16px',
  };

  const titleStyle: CSSProperties = {
    fontFamily: fontFamilies.heading,
    fontSize: isMobile ? fontSizes.xxl : fontSizes.xxxl,
    margin: 0,
    background: gradients.primary,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  };

  const sectionStyle: CSSProperties = {
    marginBottom: isMobile ? '32px' : '48px',
  };

  const sectionHeaderStyle: CSSProperties = {
    fontSize: isMobile ? '18px' : '24px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
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
    borderRadius: borderRadius.md,
    border: `1px dashed ${colors.border}`,
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>{getAppTitle()}</h1>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? spacing.sm : spacing.md,
          flexDirection: isMobile ? 'column' : 'row',
          width: isMobile ? '100%' : 'auto',
        }}>
          {/* Auth Section */}
          <AuthSection
            onNavigateToLogin={onNavigateToLogin}
            onNavigateToRegister={onNavigateToRegister}
            onNavigateToProfile={onNavigateToProfile}
          />

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: isMobile ? spacing.sm : spacing.md,
            flexDirection: isMobile ? 'column' : 'row',
            width: isMobile ? '100%' : 'auto',
          }}>
            <Button
              variant="secondary"
              onClick={() => setShowImportDialog(true)}
              icon={<Icons.Upload />}
              style={{
                padding: isMobile ? `${spacing.sm} ${spacing.md}` : `${spacing.md} ${spacing.lg}`,
                fontSize: isMobile ? fontSizes.sm : fontSizes.md,
                fontWeight: fontWeights.medium,
              }}
            >
              Importieren
            </Button>
            <Button
              variant="primary"
              onClick={onCreateNew}
              style={{
                padding: isMobile ? `${spacing.sm} ${spacing.md}` : `${spacing.md} ${spacing.xl}`,
                fontSize: isMobile ? fontSizes.sm : fontSizes.md,
                fontWeight: fontWeights.bold,
              }}
            >
              + Neues Turnier
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Navigation Tabs */}
      {!isMobile && (
        <DashboardNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          trashedCount={trashedTournaments.length}
          expiringSoonCount={expiringSoonCount}
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
                background: colors.surface,
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ marginBottom: '16px', opacity: 0.6 }}>
                <Icons.Trophy size={isMobile ? 40 : 48} color={colors.textSecondary} />
              </div>
              <h2 style={{ fontSize: isMobile ? fontSizes.lg : fontSizes.xl, marginBottom: '8px' }}>
                Noch keine Turniere
              </h2>
              <p style={{ color: colors.textSecondary, marginBottom: '24px', fontSize: isMobile ? fontSizes.sm : fontSizes.md }}>
                Erstelle dein erstes Turnier mit dem Button oben
              </p>
            </div>
          )}

          {/* Sections with CollapsibleSection (only render if tournaments exist) */}
          {activeTournaments.length > 0 && (
            <>
              {/* 1. Aktuell laufende Turniere - Always open, highlighted */}
              {categorized.running.length > 0 && (
                <CollapsibleSection
                  title="Aktuell laufende Turniere"
                  icon={<Icons.Play size={20} color={colors.statusLive} />}
                  badge={categorized.running.length}
                  defaultOpen={true}
                  variant="live"
                  testId="section-running"
                >
                  <div style={gridStyle}>
                    {categorized.running.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        categoryLabel="Läuft"
                        onClick={() => onTournamentClick(tournament)}
                        // No delete for running tournaments
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* 2. Bevorstehende Turniere - Open if no running */}
              {categorized.upcoming.length > 0 && (
                <CollapsibleSection
                  title="Bevorstehende Turniere"
                  icon={<Icons.Calendar size={20} color={colors.statusUpcoming} />}
                  badge={categorized.upcoming.length}
                  defaultOpen={categorized.running.length === 0}
                  testId="section-upcoming"
                >
                  <div style={gridStyle}>
                    {categorized.upcoming.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        categoryLabel="Bevorstehend"
                        onClick={() => onTournamentClick(tournament)}
                        onDelete={onSoftDelete ? () => onSoftDelete(tournament.id, tournament.title) : () => onDeleteTournament(tournament.id, tournament.title)}
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* 3. Gespeicherte Turniere (Entwürfe) - Collapsed by default */}
              {categorized.draft.length > 0 && (
                <CollapsibleSection
                  title="Gespeicherte Entwürfe"
                  icon={<Icons.Save size={20} color={colors.statusDraft} />}
                  badge={categorized.draft.length}
                  defaultOpen={false}
                  testId="section-draft"
                >
                  <div style={gridStyle}>
                    {categorized.draft.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        categoryLabel="Entwurf"
                        onClick={() => onTournamentClick(tournament)}
                        onDelete={onSoftDelete ? () => onSoftDelete(tournament.id, tournament.title) : () => onDeleteTournament(tournament.id, tournament.title)}
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Empty state when all sections are empty */}
              {categorized.running.length === 0 && categorized.upcoming.length === 0 && categorized.draft.length === 0 && (
                <div style={emptyStateStyle}>Keine aktiven Turniere vorhanden</div>
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
            gap: spacing.sm,
            marginBottom: spacing.md,
          }}>
            <Icons.Archive size={24} color={colors.statusFinished} />
            <h2 style={{
              fontSize: isMobile ? fontSizes.lg : fontSizes.xl,
              fontWeight: fontWeights.bold,
              color: colors.textPrimary,
              margin: 0,
            }}>
              Archiv
            </h2>
            <span style={{
              fontSize: fontSizes.sm,
              color: colors.textSecondary,
            }}>
              ({categorized.finished.length} Turniere)
            </span>
          </div>

          {categorized.finished.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ marginBottom: spacing.sm, opacity: 0.5 }}>
                <Icons.Archive size={40} color={colors.textSecondary} />
              </div>
              <p>Keine archivierten Turniere</p>
              <p style={{ fontSize: fontSizes.sm, marginTop: spacing.xs }}>
                Abgeschlossene Turniere erscheinen hier automatisch.
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
                    icon={<Icons.Calendar size={18} color={colors.textSecondary} />}
                    badge={tournamentsForYear.length}
                    defaultOpen={index === 0} // Most recent year expanded
                    testId={`archive-year-${year}`}
                  >
                    <div style={gridStyle}>
                      {tournamentsForYear.map((tournament) => (
                        <TournamentCard
                          key={tournament.id}
                          tournament={tournament}
                          categoryLabel={`Archiviert ${year}`}
                          onClick={() => onTournamentClick(tournament)}
                          onDelete={onSoftDelete ? () => onSoftDelete(tournament.id, tournament.title) : undefined}
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
              <Icons.Trash size={22} color={colors.statusWarning} />
            </span>
            Papierkorb
            <span style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 'normal', color: colors.textSecondary }}>
              ({trashedTournaments.length})
            </span>
          </h2>
          <p style={{
            color: colors.textSecondary,
            fontSize: fontSizes.sm,
            marginBottom: spacing.md,
          }}>
            Turniere werden nach {TRASH_RETENTION_DAYS} Tagen automatisch gelöscht.
          </p>
          {trashedTournaments.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ marginBottom: spacing.sm, opacity: 0.5 }}>
                <Icons.Trash size={40} color={colors.textSecondary} />
              </div>
              <p style={{ margin: 0, marginBottom: spacing.xs }}>Der Papierkorb ist leer</p>
              <p style={{ fontSize: fontSizes.sm, margin: 0, color: colors.textMuted }}>
                Gelöschte Turniere können hier wiederhergestellt werden.
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
                <div style={{ marginTop: spacing.lg, textAlign: 'center' }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // This will be handled by a confirm dialog in Phase 8
                      // For now, we just show the button
                      if (window.confirm(`Alle ${trashedTournaments.length} Turniere endgültig löschen?`)) {
                        trashedTournaments.forEach(t => onPermanentDelete(t.id, t.title));
                      }
                    }}
                    icon={<Icons.Trash size={16} />}
                    style={{
                      color: colors.error,
                      borderColor: colors.errorBorder,
                    }}
                  >
                    Papierkorb leeren ({trashedTournaments.length})
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
          activeTab={activeTab}
          onTabChange={setActiveTab}
          trashedCount={trashedTournaments.length}
          expiringSoonCount={expiringSoonCount}
        />
      )}
    </div>
  );
};
