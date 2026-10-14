/**
 * Filterleiste der Zuschauer-Seite (B-13d2, aus LiveViewScreen ausgelagert):
 * Gruppe, Phase, Status. Werte und Handler kommen als Props aus usePublicViewFilters;
 * kein Hook hier (ausser der Übersetzung). Texte wörtlich übernommen.
 */
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { PhaseFilter, StatusFilter } from '../publicScheduleFilters';

export interface PublicFilterBarProps {
  groups: string[];
  selectedGroup: string | null;
  selectedPhase: PhaseFilter;
  selectedStatus: StatusFilter;
  onGroupChange: (group: string | null) => void;
  onPhaseChange: (phase: PhaseFilter) => void;
  onStatusChange: (status: StatusFilter) => void;
}

const filterBarStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.md,
  padding: cssVars.spacing.md,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.lg,
  marginBottom: cssVars.spacing.lg,
};

const filterRowStyle: CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.sm,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const filterLabelStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textMuted,
  minWidth: '60px',
};

const chipStyle = (active: boolean): CSSProperties => ({
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.full,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: active ? cssVars.fontWeights.semibold : cssVars.fontWeights.normal,
  background: active ? cssVars.colors.primary : cssVars.colors.surfaceElevated,
  color: active ? cssVars.colors.background : cssVars.colors.textSecondary,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

export const PublicFilterBar: React.FC<PublicFilterBarProps> = ({
  groups,
  selectedGroup,
  selectedPhase,
  selectedStatus,
  onGroupChange,
  onPhaseChange,
  onStatusChange,
}) => {
  const { t: tSport } = useTranslation('sport');
  const { t } = useTranslation('publicView');

  return (
    <div style={filterBarStyle} data-testid="public-filter-bar">
      {/* Group Filter */}
      {groups.length > 1 && (
        <div style={filterRowStyle}>
          <span style={filterLabelStyle}>{t('filter.group')}</span>
          <button
            style={chipStyle(selectedGroup === null)}
            onClick={() => onGroupChange(null)}
          >
            {t('filter.all')}
          </button>
          {groups.map((group) => (
            <button
              key={group}
              style={chipStyle(selectedGroup === group)}
              onClick={() => onGroupChange(group)}
            >
              {t('filter.groupChip', { group })}
            </button>
          ))}
        </div>
      )}

      {/* Phase Filter */}
      <div style={filterRowStyle}>
        <span style={filterLabelStyle}>{t('filter.phase')}</span>
        <button
          style={chipStyle(selectedPhase === 'all')}
          onClick={() => onPhaseChange('all')}
        >
          {t('filter.all')}
        </button>
        <button
          style={chipStyle(selectedPhase === 'groupStage')}
          onClick={() => onPhaseChange('groupStage')}
        >
          {tSport('tournament.groupStage')}
        </button>
        <button
          style={chipStyle(selectedPhase === 'final')}
          onClick={() => onPhaseChange('final')}
        >
          {t('filter.finalRound')}
        </button>
      </div>

      {/* Status Filter */}
      <div style={filterRowStyle}>
        <span style={filterLabelStyle}>{t('filter.status')}</span>
        <button
          style={chipStyle(selectedStatus === 'all')}
          onClick={() => onStatusChange('all')}
        >
          {t('filter.all')}
        </button>
        <button
          style={chipStyle(selectedStatus === 'scheduled')}
          onClick={() => onStatusChange('scheduled')}
        >
          {t('filter.scheduled')}
        </button>
        <button
          style={chipStyle(selectedStatus === 'live')}
          onClick={() => onStatusChange('live')}
        >
          {t('filter.live')}
        </button>
        <button
          style={chipStyle(selectedStatus === 'finished')}
          onClick={() => onStatusChange('finished')}
        >
          {t('filter.finished')}
        </button>
      </div>
    </div>
  );
};
