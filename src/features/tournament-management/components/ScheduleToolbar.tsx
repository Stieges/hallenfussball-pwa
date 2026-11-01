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
import { useTranslation } from 'react-i18next';
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
  /** Zahl der Änderungen im Entwurf (@ZP-101: „n Änderungen nicht gespeichert“) */
  changeCount: number;
  /** Speichern läuft: Taste gesperrt (kein zweites Speichern) */
  isSaving?: boolean;
  /** Konflikte im Spielplan: Hinweis in der Leiste (@ZP-105), nur für die Turnierleitung */
  conflictCount?: number;

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

  /** A-11 @ZP-040: „Spielplan bearbeiten“ nur mit manageSchedule (ScheduleTab fragt useCan). Vorgabe: ja. */
  canEditSchedule?: boolean;
  /** A-11 @ZM-019: Aushang im PDF-Dialog nur mit tournamentSettings. Vorgabe: ja. */
  canCreateNotice?: boolean;
  /** R3-4 (Review #394 m-2): abgeschlossen zeigt der Spielplan nur die Tabelle – die Umschaltung Tabelle/Grid entfällt. */
  hideViewToggle?: boolean;
}

export const ScheduleToolbar: React.FC<ScheduleToolbarProps> = ({
  isEditing,
  onStartEditing,
  onSave,
  onCancel,
  changeCount,
  isSaving = false,
  conflictCount = 0,
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
  canEditSchedule = true,
  canCreateNotice,
  hideViewToggle = false,
}) => {
  const { t } = useTranslation('tournament');

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
    border: `1px solid ${cssVars.colors.borderControl}`,
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
          canEditSchedule ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onStartEditing}
              data-testid="schedule-edit-start"
            >
              {t('toolbar.editSchedule')}
            </Button>
          ) : null
        ) : (
          <>
            <span style={editModeBadgeStyle} data-testid="schedule-unsaved-count" role="status">
              {changeCount > 0 ? t('draft.unsaved', { count: changeCount }) : t('toolbar.editMode')}
            </span>

            {/* Undo/Redo buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
              data-testid="schedule-edit-undo"
            >
              {t('toolbar.undo')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
              data-testid="schedule-edit-redo"
            >
              {t('toolbar.redo')}
            </Button>

            {/* Redistribution buttons */}
            {showSRButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedistributeSR}
                data-testid="schedule-redistribute-sr"
              >
                {t('toolbar.redistributeSR')}
              </Button>
            )}
            {showFieldsButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedistributeFields}
                data-testid="schedule-redistribute-fields"
              >
                {t('toolbar.redistributeFields')}
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={onSave}
              disabled={changeCount === 0 || isSaving}
              data-testid="schedule-edit-save"
            >
              {t('toolbar.save')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              data-testid="schedule-edit-cancel"
            >
              {t('toolbar.cancel')}
            </Button>
          </>
        )}

        {canEditSchedule && conflictCount > 0 && (
          <span style={{ ...editModeBadgeStyle, color: cssVars.colors.warning }} data-testid="schedule-conflict-hint">
            {t('draft.conflictHint', { count: conflictCount })}
          </span>
        )}

        {/* View Mode Toggle (nach dem Abschluss entfällt er: nur die Tabelle, R3-4 m-2) */}
        {!hideViewToggle && <div style={viewToggleContainerStyle} role="tablist" aria-label={t('toolbar.switchView')}>
          <button
            onClick={() => onViewModeChange('table')}
            style={getViewToggleButtonStyle('table')}
            aria-pressed={viewMode === 'table'}
            data-testid="schedule-view-table"
          >
            {t('toolbar.viewTable')}
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            style={getViewToggleButtonStyle('grid')}
            aria-pressed={viewMode === 'grid'}
            data-testid="schedule-view-grid"
          >
            {t('toolbar.viewGrid')}
          </button>
        </div>}
      </div>

      {/* Right side: Export buttons */}
      <ScheduleActionButtons
        tournament={tournament}
        schedule={schedule}
        standings={standings}
        variant="organizer"
        canCreateNotice={canCreateNotice}
      />
    </div>
  );
};
