/**
 * ConflictResolutionDialog - P0-4 Task 4.1
 *
 * Handles user resolution of sync conflicts when cloud and local data diverge.
 * Shows side-by-side comparison and allows user to choose resolution strategy.
 *
 * WCAG 4.1.3 Compliant:
 * - Focus trap (useFocusTrap)
 * - ESC key support
 * - Focus restoration
 * - Proper ARIA attributes
 */

import React, { useMemo } from 'react';
import { SyncConflict } from '../../../core/sync/types';
import { Tournament } from '../../../types/tournament';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface ConflictResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: SyncConflict;
  onResolve: (strategy: 'local' | 'remote' | 'merge') => void;
}

interface Difference {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  isOpen,
  onClose,
  conflict,
  onResolve,
}) => {
  const { containerRef } = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
  });

  const differences = useMemo(() => {
    return computeDifferences(conflict.localVersion, conflict.remoteVersion);
  }, [conflict]);

  if (!isOpen) {
    return null;
  }

  const handleResolve = (strategy: 'local' | 'remote' | 'merge') => {
    onResolve(strategy);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={containerRef}
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        data-testid="conflict-dialog"
      >
        <div style={styles.header}>
          <h2 id="conflict-title" style={styles.title}>
            ⚠️ Synchronisierungskonflikt
          </h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Schließen"
            data-testid="conflict-close-button"
          >
            ×
          </button>
        </div>

        <div style={styles.content}>
          <p style={styles.description}>
            Das Turnier „{conflict.localVersion.title}" wurde sowohl lokal als auch
            in der Cloud geändert. Wähle, welche Version behalten werden soll:
          </p>

          {/* Comparison View */}
          <div style={styles.comparison}>
            <div style={styles.versionCard} data-testid="local-version-card">
              <h3 style={styles.versionTitle}>📱 Lokale Version</h3>
              <p style={styles.timestamp}>
                Zuletzt geändert: {formatDate(conflict.localVersion.updatedAt)}
              </p>
              <DifferencesList
                differences={differences}
                highlightVersion="local"
              />
            </div>

            <div style={styles.versionCard} data-testid="remote-version-card">
              <h3 style={styles.versionTitle}>☁️ Cloud Version</h3>
              <p style={styles.timestamp}>
                Zuletzt geändert: {formatDate(conflict.remoteVersion.updatedAt)}
              </p>
              <DifferencesList
                differences={differences}
                highlightVersion="remote"
              />
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <Button
            variant="secondary"
            onClick={() => handleResolve('local')}
            data-testid="resolve-local-button"
          >
            Lokale behalten
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleResolve('remote')}
            data-testid="resolve-remote-button"
          >
            Cloud behalten
          </Button>
          <Button
            variant="primary"
            onClick={() => handleResolve('merge')}
            data-testid="resolve-merge-button"
          >
            Zusammenführen
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Compute differences between local and remote tournament versions
 * Focuses on key fields that users care about
 */
function computeDifferences(local: Tournament, remote: Tournament): Difference[] {
  const diffs: Difference[] = [];

  // Compare tournament title
  if (local.title !== remote.title) {
    diffs.push({ field: 'Name', localValue: local.title, remoteValue: remote.title });
  }

  // Compare number of teams
  if (local.numberOfTeams !== remote.numberOfTeams) {
    diffs.push({
      field: 'Anzahl Teams',
      localValue: local.numberOfTeams,
      remoteValue: remote.numberOfTeams,
    });
  }

  // Compare number of matches
  if (local.matches.length !== remote.matches.length) {
    diffs.push({
      field: 'Anzahl Spiele',
      localValue: local.matches.length,
      remoteValue: remote.matches.length,
    });
  }

  // Compare completed matches
  const localCompleted = local.matches.filter((m) => m.matchStatus === 'finished').length;
  const remoteCompleted = remote.matches.filter((m) => m.matchStatus === 'finished').length;
  if (localCompleted !== remoteCompleted) {
    diffs.push({
      field: 'Abgeschlossene Spiele',
      localValue: localCompleted,
      remoteValue: remoteCompleted,
    });
  }

  // Compare tournament status
  if (local.status !== remote.status) {
    diffs.push({
      field: 'Status',
      localValue: local.status === 'draft' ? 'Entwurf' : 'Veröffentlicht',
      remoteValue: remote.status === 'draft' ? 'Entwurf' : 'Veröffentlicht',
    });
  }

  // Compare start date
  if (local.startDate !== remote.startDate) {
    diffs.push({
      field: 'Startdatum',
      localValue: formatDate(local.startDate),
      remoteValue: formatDate(remote.startDate),
    });
  }

  return diffs;
}

/**
 * Sub-component for displaying list of differences
 */
interface DifferencesListProps {
  differences: Difference[];
  highlightVersion: 'local' | 'remote';
}

function DifferencesList({ differences, highlightVersion }: DifferencesListProps) {
  if (differences.length === 0) {
    return (
      <p style={styles.noDifferences}>
        Keine wesentlichen Unterschiede erkannt
      </p>
    );
  }

  return (
    <ul style={styles.diffList}>
      {differences.map((diff, index) => (
        <li key={index} style={styles.diffItem}>
          <span style={styles.diffField}>{diff.field}:</span>
          <span style={styles.diffValue}>
            {String(highlightVersion === 'local' ? diff.localValue : diff.remoteValue)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Format date/timestamp for display
 */
function formatDate(date: Date | string | undefined): string {
  if (!date) {
    return 'Unbekannt';
  }

  const d = date instanceof Date ? date : new Date(date);

  // Check if valid date
  if (isNaN(d.getTime())) {
    return 'Ungültig';
  }

  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Styles using design tokens (no hardcoded values!)
 */
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: cssVars.colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.lg,
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    boxShadow: cssVars.shadows.lg,
    maxWidth: '700px',
    width: '100%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.lg,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  },
  title: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.warning,
    margin: 0,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    background: 'none',
    border: 'none',
    fontSize: cssVars.fontSizes.xl,
    color: cssVars.colors.textSecondary,
    cursor: 'pointer',
    borderRadius: cssVars.borderRadius.sm,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: cssVars.spacing.lg,
  },
  description: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.lg,
    lineHeight: 1.5,
  },
  comparison: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: cssVars.spacing.md,
  },
  versionCard: {
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
  },
  versionTitle: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  },
  timestamp: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.md,
  },
  diffList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  diffItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: cssVars.spacing.xs,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  },
  diffField: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  diffValue: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },
  noDifferences: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    fontStyle: 'italic',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.lg,
    borderTop: `1px solid ${cssVars.colors.border}`,
    backgroundColor: cssVars.colors.background,
  },
};
