/**
 * DashboardScreen - Main Tournament Dashboard
 *
 * Displays tournaments in 4 categories:
 * 1. Aktuell laufende Turniere (published + today + time > start)
 * 2. Bevorstehende Turniere (published + future date/time)
 * 3. Beendete Turniere (published + past date/time)
 * 4. Gespeicherte Turniere (draft status)
 */

import { CSSProperties, useState } from 'react';
import { Tournament } from '../types/tournament';
import { TournamentCard } from '../components/TournamentCard';
import { Button } from '../components/ui';
import { Icons } from '../components/ui/Icons';
import { theme } from '../styles/theme';
import { categorizeTournaments, CategorizedTournaments } from '../utils/tournamentCategories';
import { ImportDialog } from '../components/dialogs/ImportDialog';

interface DashboardScreenProps {
  tournaments: Tournament[];
  onCreateNew: () => void;
  onTournamentClick: (tournament: Tournament) => void;
  onDeleteTournament: (id: string, title: string) => void;
  onImportTournament: (tournament: Tournament) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  tournaments,
  onCreateNew,
  onTournamentClick,
  onDeleteTournament,
  onImportTournament,
}) => {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const categorized: CategorizedTournaments = categorizeTournaments(tournaments);

  const containerStyle: CSSProperties = {
    padding: '40px 20px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
    flexWrap: 'wrap',
    gap: '16px',
  };

  const titleStyle: CSSProperties = {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxxl,
    margin: 0,
    background: theme.gradients.primary,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  };

  const sectionStyle: CSSProperties = {
    marginBottom: '48px',
  };

  const sectionHeaderStyle: CSSProperties = {
    fontSize: '24px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  };

  const emptyStateStyle: CSSProperties = {
    padding: '40px 20px',
    textAlign: 'center',
    background: 'rgba(0,0,0,0.02)',
    borderRadius: theme.borderRadius.md,
    border: `1px dashed ${theme.colors.border}`,
    color: theme.colors.text.secondary,
    fontSize: '14px',
  };

  const renderSection = (
    title: string,
    icon: string,
    tournaments: Tournament[],
    categoryLabel: string,
    emptyMessage: string,
    allowDelete: boolean = false
  ) => {
    if (tournaments.length === 0) {
      return (
        <div style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>
            <span>{icon}</span>
            {title}
            <span style={{ fontSize: '14px', fontWeight: 'normal', color: theme.colors.text.secondary }}>
              ({tournaments.length})
            </span>
          </h2>
          <div style={emptyStateStyle}>{emptyMessage}</div>
        </div>
      );
    }

    return (
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>
          <span>{icon}</span>
          {title}
          <span style={{ fontSize: '14px', fontWeight: 'normal', color: theme.colors.text.secondary }}>
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
        <h1 style={titleStyle}>HALLENFUSSBALL PWA</h1>
        <div style={{ display: 'flex', gap: theme.spacing.md }}>
          <Button
            variant="secondary"
            onClick={() => setShowImportDialog(true)}
            icon={<Icons.Upload />}
            style={{
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              fontSize: theme.fontSizes.md,
              fontWeight: theme.fontWeights.medium,
            }}
          >
            Importieren
          </Button>
          <Button
            variant="primary"
            onClick={onCreateNew}
            style={{
              padding: `${theme.spacing.md} ${theme.spacing.xl}`,
              fontSize: theme.fontSizes.md,
              fontWeight: theme.fontWeights.bold,
            }}
          >
            + Neues Turnier
          </Button>
        </div>
      </div>

      {/* Check if user has any tournaments at all */}
      {tournaments.length === 0 && (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚽</div>
          <h2 style={{ fontSize: theme.fontSizes.xl, marginBottom: '8px' }}>
            Noch keine Turniere
          </h2>
          <p style={{ color: theme.colors.text.secondary, marginBottom: '24px' }}>
            Erstelle dein erstes Turnier mit dem Button oben
          </p>
        </div>
      )}

      {/* Sections (only render if tournaments exist) */}
      {tournaments.length > 0 && (
        <>
          {/* 1. Aktuell laufende Turniere - NO DELETE */}
          {renderSection(
            'Aktuell laufende Turniere',
            '🏃',
            categorized.running,
            'Läuft',
            'Keine laufenden Turniere',
            false // NO delete for running tournaments
          )}

          {/* 2. Bevorstehende Turniere - ALLOW DELETE */}
          {renderSection(
            'Bevorstehende Turniere',
            '📅',
            categorized.upcoming,
            'Bevorstehend',
            'Keine bevorstehenden Turniere',
            true // Allow delete
          )}

          {/* 3. Beendete Turniere - ALLOW DELETE */}
          {renderSection(
            'Beendete Turniere',
            '✅',
            categorized.finished,
            'Beendet',
            'Keine beendeten Turniere',
            true // Allow delete
          )}

          {/* 4. Gespeicherte Turniere (Entwürfe) - ALLOW DELETE */}
          {renderSection(
            'Gespeicherte Turniere',
            '💾',
            categorized.draft,
            'Entwurf',
            'Keine gespeicherten Entwürfe',
            true // Allow delete
          )}
        </>
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
    </div>
  );
};
