/**
 * ScheduleToolbar - Toolbar for Schedule editing controls
 *
 * Contains:
 * - Edit mode toggle button
 * - Undo/Redo buttons
 * - Redistribution buttons (SR, Fields)
 * - Save/Cancel buttons
 * - View mode toggle (Table/Grid)
 * - Export action buttons
 */

import { CSSProperties } from 'react';
import { Button } from '../../../components/ui';
import { ScheduleActionButtons } from '../../../components/ScheduleActionButtons';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../design-tokens';
import { Tournament, Standing } from '../../../types/tournament';
import { GeneratedSchedule } from '../../../lib/scheduleGenerator';

export type ScheduleViewMode = 'table' | 'grid';

export interface ScheduleToolbarProps {
  // Edit mode state
  isEditing: boolean;
  onStartEditing: () => void;
  onSave: () => void;
  onCancel: () => void;
  hasUnsavedChanges: boolean;

  // Undo/Redo
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Redistribution
  onRedistributeSR: () => void;
  onRedistributeFields: () => void;
  showSRButton: boolean;
  showFieldsButton: boolean;

  // View mode
  viewMode: ScheduleViewMode;
  onViewModeChange: (mode: ScheduleViewMode) => void;

  // Export buttons data
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
}

export const ScheduleToolbar: React.FC<ScheduleToolbarProps> = ({
  isEditing,
  onStartEditing,
  onSave,
  onCancel,
  hasUnsavedChanges,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRedistributeSR,
  onRedistributeFields,
  showSRButton,
  showFieldsButton,
  viewMode,
  onViewModeChange,
  tournament,
  schedule,
  standings,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
    gap: spacing.md,
    flexWrap: 'wrap',
  };

  const leftSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  };

  const editModeBadgeStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: colors.editorDragActiveBg,
    borderRadius: borderRadius.sm,
  };

  const viewToggleContainerStyle: CSSProperties = {
    display: 'flex',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: '2px',
    border: `1px solid ${colors.border}`,
    marginLeft: isEditing ? spacing.md : 0,
  };

  const getViewToggleButtonStyle = (mode: ScheduleViewMode): CSSProperties => ({
    padding: `${spacing.xs} ${spacing.md}`,
    border: 'none',
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.sm,
    fontWeight: viewMode === mode ? fontWeights.semibold : fontWeights.medium,
    backgroundColor: viewMode === mode ? colors.primary : 'transparent',
    color: viewMode === mode ? colors.background : colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  });

  return (
    <div style={containerStyle}>
      {/* Left side: Edit mode controls + View toggle */}
      <div style={leftSectionStyle}>
        {/* Edit Mode Controls */}
        {!isEditing ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onStartEditing}
          >
            ✏️ Spielplan bearbeiten
          </Button>
        ) : (
          <>
            <span style={editModeBadgeStyle}>
              Bearbeitungsmodus
            </span>

            {/* Undo/Redo buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
            >
              ↩️ Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
            >
              ↪️ Redo
            </Button>

            {/* Redistribution buttons */}
            {showSRButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedistributeSR}
              >
                🔄 SR verteilen
              </Button>
            )}
            {showFieldsButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedistributeFields}
              >
                🔄 Felder verteilen
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={onSave}
              disabled={!hasUnsavedChanges && !canUndo}
            >
              💾 Speichern
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              Abbrechen
            </Button>
          </>
        )}

        {/* View Mode Toggle */}
        <div style={viewToggleContainerStyle}>
          <button
            onClick={() => onViewModeChange('table')}
            style={getViewToggleButtonStyle('table')}
          >
            Tabelle
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            style={getViewToggleButtonStyle('grid')}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Right side: Export buttons */}
      <ScheduleActionButtons
        tournament={tournament}
        schedule={schedule}
        standings={standings}
        variant="organizer"
      />
    </div>
  );
};
