/**
 * TrashTournamentCard Component
 *
 * Displays a tournament in the trash/Papierkorb with:
 * - Tournament title and deletion date
 * - Countdown to permanent deletion (color-coded)
 * - Restore button
 * - Permanent delete button
 */

import { CSSProperties } from 'react';
import { Tournament } from '../types/tournament';
import { Card, Button, Icons } from './ui';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../design-tokens';
import { getCountdownStyle } from '../utils/tournamentCategories';
import { useIsMobile } from '../hooks/useIsMobile';

interface TrashTournamentCardProps {
  tournament: Tournament;
  remainingDays: number;
  onRestore: () => void;
  onPermanentDelete: () => void;
  onClick?: () => void;
}

export const TrashTournamentCard: React.FC<TrashTournamentCardProps> = ({
  tournament,
  remainingDays,
  onRestore,
  onPermanentDelete,
  onClick,
}) => {
  const isMobile = useIsMobile();
  const countdownStyle = getCountdownStyle(remainingDays);

  const deletedDate = tournament.deletedAt
    ? new Date(tournament.deletedAt).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  // Get countdown color based on remaining days
  const getCountdownColor = (): string => {
    switch (countdownStyle) {
      case 'danger':
        return colors.error;
      case 'warning':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const getCountdownBg = (): string => {
    switch (countdownStyle) {
      case 'danger':
        return colors.errorLight;
      case 'warning':
        return colors.warningLight;
      default:
        return colors.surface;
    }
  };

  const cardStyle: CSSProperties = {
    cursor: onClick ? 'pointer' : 'default',
    opacity: 0.9,
    border: `1px solid ${colors.border}`,
    position: 'relative',
  };

  const contentStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'stretch' : 'flex-start',
    gap: spacing.md,
  };

  const infoStyle: CSSProperties = {
    flex: 1,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    margin: 0,
    marginBottom: spacing.xs,
  };

  const metaStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    margin: 0,
    marginBottom: spacing.sm,
  };

  const countdownContainerStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: borderRadius.sm,
    background: getCountdownBg(),
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: getCountdownColor(),
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'row' : 'column',
    gap: spacing.sm,
    minWidth: isMobile ? 'auto' : '160px',
  };

  // Format countdown text
  const getCountdownText = (): string => {
    if (remainingDays === 0) {
      return 'Wird heute gelöscht';
    }
    if (remainingDays === 1) {
      return 'Noch 1 Tag';
    }
    return `Noch ${remainingDays} Tage`;
  };

  return (
    <Card style={cardStyle} onClick={onClick}>
      <div style={contentStyle}>
        <div style={infoStyle}>
          <h3 style={titleStyle}>{tournament.title}</h3>
          <p style={metaStyle}>Gelöscht am {deletedDate}</p>
          <div style={countdownContainerStyle}>
            {countdownStyle !== 'normal' && (
              <Icons.AlertTriangle size={14} color={getCountdownColor()} />
            )}
            <span>{getCountdownText()}</span>
          </div>
        </div>

        <div
          style={actionsStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="primary"
            size="sm"
            onClick={onRestore}
            icon={<Icons.Restore size={16} />}
            style={{ flex: isMobile ? 1 : 'none' }}
          >
            Wiederherstellen
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onPermanentDelete}
            icon={<Icons.Trash size={16} />}
            style={{
              flex: isMobile ? 1 : 'none',
              color: colors.error,
              borderColor: colors.errorBorder,
            }}
          >
            Endgültig löschen
          </Button>
        </div>
      </div>
    </Card>
  );
};
