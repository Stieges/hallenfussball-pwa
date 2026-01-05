/**
 * DangerZoneCategory - Critical Actions
 *
 * Destructive operations requiring confirmation.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.11
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage } from '../shared';
import { DANGER_ACTIONS } from '../../constants/admin.constants';
import type { Tournament } from '../../../../types/tournament';
import type { DangerAction } from '../../types/admin.types';

// =============================================================================
// PROPS
// =============================================================================

interface DangerZoneCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  warning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.warningSubtle,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.lg,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.warning,
  } as CSSProperties,

  actionCard: {
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  actionCardDanger: {
    borderColor: cssVars.colors.errorBorder,
    background: cssVars.colors.dangerSubtle,
  } as CSSProperties,

  actionCardWarning: {
    borderColor: cssVars.colors.warningBorder,
    background: cssVars.colors.warningSubtle,
  } as CSSProperties,

  actionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,

  actionIcon: {
    fontSize: 24,
  } as CSSProperties,

  actionTitle: {
    fontSize: cssVars.fontSizes.titleSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  actionTitleDanger: {
    color: cssVars.colors.error,
  } as CSSProperties,

  actionTitleWarning: {
    color: cssVars.colors.warning,
  } as CSSProperties,

  actionDescription: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  consequencesList: {
    listStyle: 'none',
    padding: 0,
    margin: `0 0 ${cssVars.spacing.md} 0`,
  } as CSSProperties,

  consequenceItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  consequenceIcon: {
    color: cssVars.colors.error,
    flexShrink: 0,
  } as CSSProperties,

  button: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  buttonDanger: {
    background: cssVars.colors.error,
    color: cssVars.colors.onError,
  } as CSSProperties,

  buttonWarning: {
    background: cssVars.colors.warning,
    color: cssVars.colors.onWarning,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function DangerZoneCategory({
  tournament: _tournament,
}: DangerZoneCategoryProps) {
  const handleAction = (_action: DangerAction) => {
    // TODO: Implement confirmation dialog
    // Action will be handled when confirmation dialog is implemented
  };

  const renderActionCard = (action: DangerAction) => {
    const config = DANGER_ACTIONS[action];
    const isDanger = config.severity === 'danger';

    return (
      <div
        key={action}
        style={{
          ...styles.actionCard,
          ...(isDanger ? styles.actionCardDanger : styles.actionCardWarning),
        }}
      >
        <div style={styles.actionHeader}>
          <span style={styles.actionIcon}>
            {action === 'regenerate_schedule' && '🔄'}
            {action === 'reset_schedule' && '🗑️'}
            {action === 'end_tournament' && '🛑'}
            {action === 'archive_tournament' && '📦'}
            {action === 'delete_tournament' && '🗑️'}
          </span>
          <h3
            style={{
              ...styles.actionTitle,
              ...(isDanger ? styles.actionTitleDanger : styles.actionTitleWarning),
            }}
          >
            {config.title}
          </h3>
        </div>

        <p style={styles.actionDescription}>{config.description}</p>

        <ul style={styles.consequencesList}>
          {config.consequences.map((consequence, i) => (
            <li key={i} style={styles.consequenceItem}>
              <span style={styles.consequenceIcon}>•</span>
              <span>{consequence}</span>
            </li>
          ))}
        </ul>

        <button
          style={{
            ...styles.button,
            ...(isDanger ? styles.buttonDanger : styles.buttonWarning),
          }}
          onClick={() => handleAction(action)}
        >
          {config.buttonLabel}
        </button>
      </div>
    );
  };

  return (
    <CategoryPage
      icon="⚠️"
      title="Kritische Aktionen"
      description="Destruktive Operationen - mit Vorsicht verwenden"
    >
      {/* Warning */}
      <div style={styles.warning}>
        <span>⚠️</span>
        <div>
          <strong>Vorsicht!</strong> Die folgenden Aktionen können nicht oder nur teilweise
          rückgängig gemacht werden. Stelle sicher, dass du weißt, was du tust.
        </div>
      </div>

      {/* Regenerate Schedule (Warning) */}
      {renderActionCard('regenerate_schedule')}

      {/* Reset Schedule (Danger) */}
      {renderActionCard('reset_schedule')}

      {/* End Tournament (Warning) */}
      {renderActionCard('end_tournament')}

      {/* Archive Tournament (Warning) */}
      {renderActionCard('archive_tournament')}

      {/* Delete Tournament (Danger) */}
      {renderActionCard('delete_tournament')}
    </CategoryPage>
  );
}

export default DangerZoneCategory;
