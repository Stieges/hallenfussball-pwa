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
import { cssVars } from '../../../design-tokens'
import { Tournament, Standing } from '../../../types/tournament';
import { GeneratedSchedule } from '../../../core/generators';

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
    padding: cssVars.spacing.lg,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
  };

  const leftSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
  };

  const editModeBadgeStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.primary,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    backgroundColor: cssVars.colors.editorDragActiveBg,
    borderRadius: cssVars.borderRadius.sm,
  };

  const viewToggleContainerStyle: CSSProperties = {
    display: 'flex',
    backgroundColor: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.xs,
    border: `1px solid ${cssVars.colors.border}`,
    marginLeft: isEditing ? cssVars.spacing.md : 0,
    gap: cssVars.spacing.xs,
  };

  const getViewToggleButtonStyle = (mode: ScheduleViewMode): CSSProperties => ({
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    minHeight: cssVars.touchTargets.minimum,
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    fontFamily: cssVars.fontFamilies.body,
    fontWeight: viewMode === mode ? cssVars.fontWeights.semibold : cssVars.fontWeights.medium,
    backgroundColor: viewMode === mode ? cssVars.colors.primary : 'transparent',
    color: viewMode === mode ? cssVars.colors.background : cssVars.colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 150ms ease',
    touchAction: 'manipulation',
    outline: 'none',
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
        <div style={viewToggleContainerStyle} role="tablist" aria-label="Ansicht wechseln">
          <button
            onClick={() => onViewModeChange('table')}
            style={getViewToggleButtonStyle('table')}
            aria-pressed={viewMode === 'table'}
            data-testid="schedule-view-table"
          >
            Tabelle
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            style={getViewToggleButtonStyle('grid')}
            aria-pressed={viewMode === 'grid'}
            data-testid="schedule-view-grid"
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
