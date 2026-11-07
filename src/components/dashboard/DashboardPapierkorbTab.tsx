/**
 * Reiter „Papierkorb“ der Startseite (aus `DashboardScreen.tsx` herausgelöst).
 * „Papierkorb leeren“ (@LZ-094): eine Rückfrage, dann löscht die App alle Turniere im Papierkorb; Fehler meldet die App je
 * Turnier mit Namen (`onEmptyTrash`, `useTournaments.emptyTrash`).
 */
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../types/tournament';
import { TRASH_RETENTION_DAYS } from '../../types/tournament';
import { TrashTournamentCard } from '../TrashTournamentCard';
import { Button } from '../ui';
import { Icons } from '../ui/Icons';
import { ConfirmDialog, useConfirmDialog } from '../ui/ConfirmDialog';
import { cssVars, iconSizeValues } from '../../design-tokens';
import { getRemainingDays } from '../../utils/tournamentCategories';
import { useIsMobile } from '../../hooks/useIsMobile';
import { emptyStateStyle, gridStyle } from './dashboardStyles';

interface DashboardPapierkorbTabProps {
  trashedTournaments: Tournament[];
  onTournamentClick: (tournament: Tournament) => void;
  onRestore?: (id: string, title: string) => void;
  onPermanentDelete?: (id: string, title: string) => void;
  onEmptyTrash?: () => void;
}

export const DashboardPapierkorbTab: React.FC<DashboardPapierkorbTabProps> = ({
  trashedTournaments, onTournamentClick, onRestore, onPermanentDelete, onEmptyTrash,
}) => {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const emptyTrashDialog = useConfirmDialog({
    title: t('trash.emptyTrashTitle'),
    message: t('trash.emptyTrashMessage'),
    variant: 'danger',
    confirmText: t('trash.emptyTrashConfirm'),
  });

  const handleEmptyTrash = () => {
    void (async () => {
      const confirmed = await emptyTrashDialog.confirm({
        message: t('trash.emptyTrashMessageCount', { count: trashedTournaments.length }),
      });
      if (confirmed) {
        onEmptyTrash?.();
      }
    })();
  };

  return (
    <div style={{ marginBottom: isMobile ? cssVars.spacing.xl : cssVars.spacing.xxl }}>
      <h2 style={{
        fontSize: isMobile ? cssVars.fontSizes.xl : cssVars.fontSizes.xxl,
        fontWeight: cssVars.fontWeights.bold,
        color: cssVars.colors.textPrimary,
        marginBottom: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
      }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <Icons.Trash size={iconSizeValues.md} color={cssVars.colors.statusWarning} />
        </span>
        {t('sections.trash')}
        <span style={{ fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.normal, color: cssVars.colors.textSecondary }}>
          ({trashedTournaments.length})
        </span>
      </h2>
      <p style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, marginBottom: cssVars.spacing.md }}>
        {t('trash.retentionInfo', { days: TRASH_RETENTION_DAYS })}
      </p>
      {trashedTournaments.length === 0 ? (
        <div style={emptyStateStyle}>
          <div style={{ marginBottom: cssVars.spacing.sm }}>
            <Icons.Trash size={iconSizeValues.xl} color={cssVars.colors.textSecondary} />
          </div>
          <p style={{ margin: 0, marginBottom: cssVars.spacing.xs }}>{t('emptyState.trashEmpty')}</p>
          <p style={{ fontSize: cssVars.fontSizes.sm, margin: 0, color: cssVars.colors.textMuted }}>{t('emptyState.trashHint')}</p>
        </div>
      ) : (
        <>
          <div style={gridStyle(isMobile)}>
            {trashedTournaments.map((tournament) => (
              <TrashTournamentCard
                key={tournament.id}
                tournament={tournament}
                remainingDays={getRemainingDays(tournament) ?? 0}
                onClick={() => onTournamentClick(tournament)}
                onRestore={() => onRestore?.(tournament.id, tournament.title)}
                onPermanentDelete={() => onPermanentDelete?.(tournament.id, tournament.title)}
              />
            ))}
          </div>
          {/* Papierkorb leeren: erst ab zwei Turnieren (bei einem genügt „Endgültig löschen“) */}
          {trashedTournaments.length > 1 && onEmptyTrash && (
            <div style={{ marginTop: cssVars.spacing.lg, textAlign: 'center' }}>
              <Button
                variant="secondary"
                onClick={handleEmptyTrash}
                icon={<Icons.Trash size={iconSizeValues.xs} />}
                style={{ color: cssVars.colors.error, borderColor: cssVars.colors.errorBorder }}
                data-testid="trash-empty-button"
              >
                {t('trash.emptyTrashButton', { count: trashedTournaments.length })}
              </Button>
            </div>
          )}
        </>
      )}
      <ConfirmDialog {...emptyTrashDialog.dialogProps} />
    </div>
  );
};
