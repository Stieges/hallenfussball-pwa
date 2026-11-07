/**
 * Reiter „Archiv“ der Startseite (aus `DashboardScreen.tsx` herausgelöst): Abgeschlossene und Abgebrochene
 * nach Jahr, das jüngste Jahr offen; heute abgeschlossene erst ab dem Folgetag (@OB-081, bis dahin unter „Heute“).
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../types/tournament';
import { TournamentCard } from '../TournamentCard';
import { CollapsibleSection } from '../ui';
import { Icons } from '../ui/Icons';
import { cssVars, iconSizeValues } from '../../design-tokens';
import { getExtendedCategories } from '../../utils/tournamentCategories';
import { istHeuteAbgeschlossen } from '../../utils/startseiteAbschnitte';
import { useIsMobile } from '../../hooks/useIsMobile';
import { emptyStateStyle, gridStyle } from './dashboardStyles';

interface DashboardArchivTabProps {
  activeTournaments: Tournament[];
  onTournamentClick: (tournament: Tournament) => void;
  onCopyTournament?: (tournament: Tournament) => void;
  onSoftDelete?: (id: string, title: string) => void;
}

export const DashboardArchivTab: React.FC<DashboardArchivTabProps> = ({
  activeTournaments, onTournamentClick, onCopyTournament, onSoftDelete,
}) => {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  // @OB-081: ein heute abgeschlossenes Turnier steht bis Tagesende nur unter „Heute“, ab dem Folgetag nur hier
  const extended = useMemo(() => {
    const jetzt = new Date();
    return getExtendedCategories(activeTournaments.filter((t) => !istHeuteAbgeschlossen(t, jetzt)));
  }, [activeTournaments]);
  const sortedYears = useMemo(
    () => Object.keys(extended.archivedByYear).map(Number).sort((a, b) => b - a),
    [extended.archivedByYear],
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.md }}>
        <Icons.Archive size={iconSizeValues.md} color={cssVars.colors.statusFinished} />
        <h2 style={{
          fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl,
          fontWeight: cssVars.fontWeights.bold,
          color: cssVars.colors.textPrimary,
          margin: 0,
        }}>
          {t('sections.archive')}
        </h2>
        <span style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
          {t('sections.tournamentCount', { count: extended.finished.length })}
        </span>
      </div>

      {extended.finished.length === 0 ? (
        <div style={emptyStateStyle}>
          <div style={{ marginBottom: cssVars.spacing.sm }}>
            <Icons.Archive size={iconSizeValues.xl} color={cssVars.colors.textSecondary} />
          </div>
          <p>{t('emptyState.noArchivedTournaments')}</p>
          <p style={{ fontSize: cssVars.fontSizes.sm, marginTop: cssVars.spacing.xs }}>{t('emptyState.archivedHint')}</p>
        </div>
      ) : (
        sortedYears.map((year, index) => {
          const tournamentsForYear = extended.archivedByYear[year];
          return (
            <CollapsibleSection
              key={year}
              title={`${year}`}
              icon={<Icons.Calendar size={iconSizeValues.xs} color={cssVars.colors.textSecondary} />}
              badge={tournamentsForYear.length}
              defaultOpen={index === 0} // jüngstes Jahr offen
              overflowWhenOpen="visible"
              testId={`archive-year-${year}`}
            >
              <div style={gridStyle(isMobile)}>
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
        })
      )}
    </>
  );
};
