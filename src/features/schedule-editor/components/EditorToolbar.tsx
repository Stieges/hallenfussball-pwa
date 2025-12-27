/**
 * US-SCHEDULE-EDITOR: EditorToolbar Component
 *
 * Toolbar for the schedule editor providing:
 * - Edit mode toggle
 * - Undo/Redo buttons
 * - Save/Discard actions
 * - Conflict indicator
 */

import React from 'react';
import { Button } from '../../../components/ui';
import { colors, spacing, borderRadius, fontSizes, fontWeights } from '../../../design-tokens';
import { ScheduleConflict } from '../types';

interface EditorToolbarProps {
  /** Current mode */
  mode: 'view' | 'edit';
  /** Toggle mode callback */
  onToggleMode: () => void;
  /** Save callback */
  onSave: () => void;
  /** Discard callback */
  onDiscard: () => void;
  /** Undo callback */
  onUndo: () => void;
  /** Redo callback */
  onRedo: () => void;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Has unsaved changes */
  isDirty: boolean;
  /** Current conflicts */
  conflicts?: ScheduleConflict[];
  /** Read-only mode (hide edit button) */
  readOnly?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  mode,
  onToggleMode,
  onSave,
  onDiscard,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isDirty,
  conflicts = [],
  readOnly = false,
}) => {
  const isEditing = mode === 'edit';
  const errorCount = conflicts.filter(c => c.severity === 'error').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;

  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: isEditing ? colors.editorEditModeBg : colors.surface,
    borderRadius: borderRadius.md,
    border: `1px solid ${isEditing ? colors.success : colors.border}`,
    marginBottom: spacing.md,
  };

  const leftSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const rightSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const modeIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: borderRadius.sm,
    backgroundColor: isEditing ? colors.editorEditModeHover : 'transparent',
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: isEditing ? colors.success : colors.textSecondary,
  };

  const conflictBadgeStyle = (severity: 'error' | 'warning'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: borderRadius.sm,
    backgroundColor: severity === 'error' ? colors.errorLight : colors.editorDirtyBg,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: severity === 'error' ? colors.error : colors.warning,
  });

  const separatorStyle: React.CSSProperties = {
    width: '1px',
    height: '24px',
    backgroundColor: colors.border,
    margin: `0 ${spacing.xs}`,
  };

  const iconButtonStyle: React.CSSProperties = {
    minWidth: '36px',
    padding: spacing.sm,
  };

  return (
    <div style={toolbarStyle}>
      {/* Left Section: Mode & Toggle */}
      <div style={leftSectionStyle}>
        {!readOnly && (
          <>
            <div style={modeIndicatorStyle}>
              <span>{isEditing ? '✏️' : '👁️'}</span>
              <span>{isEditing ? 'Bearbeitungsmodus' : 'Ansichtsmodus'}</span>
            </div>

            <Button
              variant={isEditing ? 'secondary' : 'primary'}
              size="sm"
              onClick={onToggleMode}
            >
              {isEditing ? 'Bearbeitung beenden' : 'Spielplan bearbeiten'}
            </Button>
          </>
        )}

        {readOnly && (
          <div style={modeIndicatorStyle}>
            <span>🔒</span>
            <span>Nur Ansicht</span>
          </div>
        )}
      </div>

      {/* Right Section: Actions & Conflicts */}
      <div style={rightSectionStyle}>
        {/* Conflict Indicators */}
        {errorCount > 0 && (
          <span style={conflictBadgeStyle('error')}>
            <span>⚠️</span>
            <span>{errorCount} Fehler</span>
          </span>
        )}
        {warningCount > 0 && (
          <span style={conflictBadgeStyle('warning')}>
            <span>⚡</span>
            <span>{warningCount} Warnungen</span>
          </span>
        )}

        {isEditing && (
          <>
            {(errorCount > 0 || warningCount > 0) && <div style={separatorStyle} />}

            {/* Undo/Redo */}
            <div title="Rückgängig (Ctrl+Z)">
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                style={iconButtonStyle}
              >
                ↩️
              </Button>
            </div>
            <div title="Wiederholen (Ctrl+Y)">
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                style={iconButtonStyle}
              >
                ↪️
              </Button>
            </div>

            <div style={separatorStyle} />

            {/* Save/Discard */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDiscard}
              disabled={!isDirty}
            >
              Verwerfen
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || errorCount > 0}
            >
              Speichern
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Compact version for mobile
 */
interface EditorToolbarCompactProps {
  isEditing: boolean;
  onToggleMode: () => void;
  isDirty: boolean;
  errorCount: number;
  readOnly?: boolean;
}

export const EditorToolbarCompact: React.FC<EditorToolbarCompactProps> = ({
  isEditing,
  onToggleMode,
  isDirty,
  errorCount,
  readOnly = false,
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    backgroundColor: isEditing ? colors.editorEditModeBg : colors.surface,
    borderRadius: borderRadius.sm,
  };

  const statusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    fontSize: fontSizes.sm,
  };

  return (
    <div style={containerStyle}>
      <div style={statusStyle}>
        <span>{isEditing ? '✏️' : '👁️'}</span>
        {isDirty && <span style={{ color: colors.warning }}>●</span>}
        {errorCount > 0 && <span style={{ color: colors.error }}>⚠️ {errorCount}</span>}
      </div>

      {!readOnly && (
        <Button variant="ghost" size="sm" onClick={onToggleMode}>
          {isEditing ? 'Fertig' : 'Bearbeiten'}
        </Button>
      )}
    </div>
  );
};

export default EditorToolbar;
