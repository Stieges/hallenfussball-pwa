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
import { Button } from '../components/ui';
import { Icons } from '../components/ui/Icons';
import { borderRadius, colors, fontFamilies, fontSizes, fontWeights, gradients, spacing } from '../design-tokens';
import {
  categorizeTournaments,
  CategorizedTournaments,
  getActiveTournaments,
  getTrashedTournaments,
  getRemainingDays,
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
  onRestore: _onRestore, // Will be used in Phase 5
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

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    tournaments: Tournament[],
    categoryLabel: string,
    emptyMessage: string,
    allowDelete: boolean = false,
    isHighlighted: boolean = false
  ) => {
    const highlightedSectionStyle: CSSProperties = isHighlighted && tournaments.length > 0
      ? {
          ...sectionStyle,
          padding: isMobile ? '16px' : '24px',
          background: `linear-gradient(135deg, ${colors.statusLiveBg} 0%, transparent 100%)`,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.statusLive}40`,
        }
      : sectionStyle;

    if (tournaments.length === 0) {
      return (
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
            {title}
            <span style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 'normal', color: colors.textSecondary }}>
              ({tournaments.length})
            </span>
          </h2>
          <div style={emptyStateStyle}>{emptyMessage}</div>
        </div>
      );
    }

    return (
      <div style={highlightedSectionStyle}>
        <h2 style={sectionHeaderStyle}>
          <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
          {title}
          <span style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 'normal', color: colors.textSecondary }}>
            ({tournaments.length})
          </span>
        </h2>
        <div style={gridStyle}>
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              categoryLabel={categoryLabel}
              onClick={() => onTournamentClick(tournament)}
              onDelete={allowDelete ? () => onDeleteTournament(tournament.id, tournament.title) : undefined}
            />
          ))}
        </div>
      </div>
    );
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

          {/* Sections (only render if tournaments exist) */}
          {activeTournaments.length > 0 && (
            <>
              {/* 1. Aktuell laufende Turniere - NO DELETE, HIGHLIGHTED */}
              {renderSection(
                'Aktuell laufende Turniere',
                <Icons.Play size={22} color={colors.statusLive} />,
                categorized.running,
                'Läuft',
                'Keine laufenden Turniere',
                false, // NO delete for running tournaments
                true   // isHighlighted
              )}

              {/* 2. Bevorstehende Turniere - SOFT DELETE */}
              {renderSection(
                'Bevorstehende Turniere',
                <Icons.Calendar size={22} color={colors.statusUpcoming} />,
                categorized.upcoming,
                'Bevorstehend',
                'Keine bevorstehenden Turniere',
                true // Allow soft delete
              )}

              {/* 3. Gespeicherte Turniere (Entwürfe) - SOFT DELETE */}
              {renderSection(
                'Gespeicherte Turniere',
                <Icons.Save size={22} color={colors.statusDraft} />,
                categorized.draft,
                'Entwurf',
                'Keine gespeicherten Entwürfe',
                true // Allow soft delete
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'archiv' && (
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <Icons.Archive size={22} color={colors.statusFinished} />
            </span>
            Archiv
            <span style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 'normal', color: colors.textSecondary }}>
              ({categorized.finished.length})
            </span>
          </h2>
          {categorized.finished.length === 0 ? (
            <div style={emptyStateStyle}>Keine archivierten Turniere</div>
          ) : (
            <div style={gridStyle}>
              {categorized.finished.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  categoryLabel="Archiviert"
                  onClick={() => onTournamentClick(tournament)}
                  onDelete={onSoftDelete ? () => onSoftDelete(tournament.id, tournament.title) : undefined}
                />
              ))}
            </div>
          )}
        </div>
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
            <div style={emptyStateStyle}>Der Papierkorb ist leer</div>
          ) : (
            <div style={gridStyle}>
              {trashedTournaments.map((tournament) => {
                const remainingDays = getRemainingDays(tournament);
                return (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                     
                    categoryLabel={remainingDays !== null ? `${remainingDays} Tage übrig` : 'Im Papierkorb'}
                    onClick={() => onTournamentClick(tournament)}
                    onDelete={onPermanentDelete ? () => onPermanentDelete(tournament.id, tournament.title) : undefined}
                    // TODO: Add restore button in Phase 5
                  />
                );
              })}
            </div>
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
