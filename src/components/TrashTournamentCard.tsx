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
import { cssVars } from '../design-tokens'
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
        return cssVars.colors.error;
      case 'warning':
        return cssVars.colors.warning;
      default:
        return cssVars.colors.textSecondary;
    }
  };

  const getCountdownBg = (): string => {
    switch (countdownStyle) {
      case 'danger':
        return cssVars.colors.errorLight;
      case 'warning':
        return cssVars.colors.warningLight;
      default:
        return cssVars.colors.surface;
    }
  };

  const cardStyle: CSSProperties = {
    cursor: onClick ? 'pointer' : 'default',
    opacity: 0.9,
    border: `1px solid ${cssVars.colors.border}`,
    position: 'relative',
  };

  const contentStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'stretch' : 'flex-start',
    gap: cssVars.spacing.md,
  };

  const infoStyle: CSSProperties = {
    flex: 1,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.xs,
  };

  const metaStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  };

  const countdownContainerStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    background: getCountdownBg(),
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: getCountdownColor(),
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'row' : 'column',
    gap: cssVars.spacing.sm,
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
              color: cssVars.colors.error,
              borderColor: cssVars.colors.errorBorder,
            }}
          >
            Endgültig löschen
          </Button>
        </div>
      </div>
    </Card>
  );
};
