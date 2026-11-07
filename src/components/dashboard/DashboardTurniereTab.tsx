/**
 * Reiter „Turniere“ der Startseite (aus `DashboardScreen.tsx` herausgelöst).
 *
 * Abschnitte von oben (@OB-078, @LZ-001): „Heute“ (offen, klappt nie von selbst zu) · Läuft · Kommende Turniere · Entwürfe.
 * Die Aufteilung steht rein in `utils/startseiteAbschnitte.ts`. Suche und Filter kommen aus der Adresse (@OB-030).
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../types/tournament';
import { TournamentCard } from '../TournamentCard';
import { CollapsibleSection } from '../ui';
import { Icons } from '../ui/Icons';
import { cssVars, iconSizeValues } from '../../design-tokens';
import { baueStartseiteAbschnitte, type FilterChip } from '../../utils/startseiteAbschnitte';
import { categorizeTournament } from '../../utils/tournamentCategories';
import { useIsMobile } from '../../hooks/useIsMobile';
import { emptyStateStyle, gridStyle } from './dashboardStyles';

interface DashboardTurniereTabProps {
  activeTournaments: Tournament[];
  searchQuery: string;
  activeFilters: FilterChip[];
  onTournamentClick: (tournament: Tournament) => void;
  onCopyTournament?: (tournament: Tournament) => void;
  /** Ohne diese Funktion gilt `onDeleteTournament`. */
  onSoftDelete?: (id: string, title: string) => void;
  onDeleteTournament: (id: string, title: string) => void;
}

export const DashboardTurniereTab: React.FC<DashboardTurniereTabProps> = ({
  activeTournaments, searchQuery, activeFilters, onTournamentClick, onCopyTournament, onSoftDelete, onDeleteTournament,
}) => {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();

  if (activeTournaments.length === 0) {
    return (
      <div style={{ ...emptyStateStyle, padding: isMobile ? `${cssVars.spacing.xl} ${cssVars.spacing.md}` : `${cssVars.spacing.xxl} ${cssVars.spacing.lg}` }}>
        <div style={{ marginBottom: cssVars.spacing.md }}>
          <Icons.Trophy size={iconSizeValues.xl} color={cssVars.colors.textSecondary} />
        </div>
        <h2 style={{ fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl, marginBottom: cssVars.spacing.sm }}>
          {t('emptyState.noTournaments')}
        </h2>
        <p style={{ color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.lg, fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md }}>
          {t('emptyState.noTournamentsHint')}
        </p>
      </div>
    );
  }

  const abschnitte = baueStartseiteAbschnitte(activeTournaments, { now: new Date(), search: searchQuery, filters: activeFilters });
  const keinTreffer = abschnitte.heute.length === 0 && abschnitte.running.length === 0
    && abschnitte.upcoming.length === 0 && abschnitte.draft.length === 0;
  const gefiltert = searchQuery !== '' || activeFilters.length > 0;

  const karten = (list: Tournament[], inToday = false): ReactNode =>
    list.map((tournament) => {
      // Das Wort auf der Karte folgt dem Zustand des Turniers, nicht dem Abschnitt (@LZ-001)
      const kategorie = categorizeTournament(tournament);
      const categoryLabel = kategorie === 'running' ? 'running' : kategorie === 'draft' ? 'draft' : 'upcoming';
      return (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          categoryLabel={categoryLabel}
          inToday={inToday}
          onClick={() => onTournamentClick(tournament)}
          onCopy={onCopyTournament ? () => onCopyTournament(tournament) : undefined}
          // Laufende Turniere lassen sich nicht löschen
          onSoftDelete={categoryLabel === 'running' ? undefined : onSoftDelete ? () => onSoftDelete(tournament.id, tournament.title) : () => onDeleteTournament(tournament.id, tournament.title)}
        />
      );
    });

  return (
    <>
      {gefiltert && keinTreffer && (
        <div style={{ ...emptyStateStyle, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` }} data-testid="search-empty">
          <div style={{ marginBottom: cssVars.spacing.sm }}>
            <Icons.Search size={iconSizeValues.xl} color={cssVars.colors.textSecondary} />
          </div>
          <p style={{ margin: 0 }}>{t('emptyState.noSearchResults')}</p>
          {searchQuery && (
            <p style={{ margin: `${cssVars.spacing.xs} 0 0`, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textMuted }}>
              {t('emptyState.noSearchResultsFor', { query: searchQuery })}
            </p>
          )}
        </div>
      )}

      {abschnitte.heute.length > 0 && (
        <CollapsibleSection
          title={t('sections.today')}
          icon={<Icons.Calendar size={iconSizeValues.sm} color={cssVars.colors.primary} />}
          badge={abschnitte.heute.length}
          defaultOpen
          compact={isMobile}
          overflowWhenOpen="visible"
          testId="section-heute"
        >
          <div style={gridStyle(isMobile)}>{karten(abschnitte.heute, true)}</div>
        </CollapsibleSection>
      )}

      {abschnitte.running.length > 0 && (
        <CollapsibleSection
          title={t('sections.runningTournaments')}
          icon={<Icons.Play size={iconSizeValues.sm} color={cssVars.colors.statusLive} />}
          badge={abschnitte.running.length}
          defaultOpen
          variant="live"
          compact={isMobile}
          overflowWhenOpen="visible"
          testId="section-running"
        >
          <div style={gridStyle(isMobile)}>{karten(abschnitte.running)}</div>
        </CollapsibleSection>
      )}

      {abschnitte.upcoming.length > 0 && (
        <CollapsibleSection
          title={t('sections.upcomingTournaments')}
          icon={<Icons.Calendar size={iconSizeValues.sm} color={cssVars.colors.statusUpcoming} />}
          badge={abschnitte.upcoming.length}
          defaultOpen
          compact={isMobile}
          overflowWhenOpen="visible"
          testId="section-upcoming"
        >
          <div style={gridStyle(isMobile)}>{karten(abschnitte.upcoming)}</div>
        </CollapsibleSection>
      )}

      {abschnitte.draft.length > 0 && (
        <CollapsibleSection
          title={t('sections.savedDrafts')}
          icon={<Icons.Save size={iconSizeValues.sm} color={cssVars.colors.statusDraft} />}
          badge={abschnitte.draft.length}
          defaultOpen={false}
          compact={isMobile}
          overflowWhenOpen="visible"
          testId="section-draft"
        >
          <div style={gridStyle(isMobile)}>{karten(abschnitte.draft)}</div>
        </CollapsibleSection>
      )}

      {!gefiltert && keinTreffer && <div style={emptyStateStyle}>{t('emptyState.noActiveTournaments')}</div>}
    </>
  );
};
