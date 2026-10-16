/**
 * „Mein Team“-Leiste der Zuschauer-Seite (B-13d2, aus LiveViewScreen ausgelagert).
 * Werte und Handler kommen als Props aus usePublicViewFilters; kein Hook hier.
 * Texte wörtlich übernommen.
 */
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';

export interface MyTeamBarProps {
  /** Name des gewählten Teams, sonst null */
  myTeamLabel: string | null;
  myTeamId: string | null;
  showOnlyMyTeam: boolean;
  onShowOnlyMyTeamChange: (value: boolean) => void;
  onOpenTeamSelector: () => void;
}

const myTeamBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: cssVars.spacing.md,
  background: cssVars.colors.surfaceElevated,
  borderRadius: cssVars.borderRadius.lg,
  marginBottom: cssVars.spacing.lg,
  gap: cssVars.spacing.md,
  flexWrap: 'wrap',
};

const toggleStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.md,
  fontSize: cssVars.fontSizes.sm,
  background: active ? cssVars.colors.primarySubtle : 'transparent',
  color: active ? cssVars.colors.primary : cssVars.colors.textMuted,
  border: `1px solid ${active ? cssVars.colors.primary : cssVars.colors.border}`,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

export const MyTeamBar: React.FC<MyTeamBarProps> = ({
  myTeamLabel,
  myTeamId,
  showOnlyMyTeam,
  onShowOnlyMyTeamChange,
  onOpenTeamSelector,
}) => {
  const { t } = useTranslation('publicView');
  return (
  <div style={myTeamBarStyle} data-testid="my-team-bar">
    <div>
      <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
        {t('myTeam.label')}
      </span>{' '}
      <strong style={{ color: cssVars.colors.textPrimary }}>
        {myTeamLabel ?? t('myTeam.none')}
      </strong>
    </div>
    <div style={{ display: 'flex', gap: cssVars.spacing.sm, alignItems: 'center' }}>
      {myTeamId && (
        <button
          style={toggleStyle(showOnlyMyTeam)}
          onClick={() => onShowOnlyMyTeamChange(!showOnlyMyTeam)}
        >
          <span>⭐</span>
          <span>{t('myTeam.onlyMine')}</span>
        </button>
      )}
      <Button
        variant={myTeamId ? 'secondary' : 'primary'}
        size="sm"
        onClick={onOpenTeamSelector}
      >
        {myTeamId ? t('myTeam.change') : t('myTeam.choose')}
      </Button>
    </div>
  </div>
  );
};
