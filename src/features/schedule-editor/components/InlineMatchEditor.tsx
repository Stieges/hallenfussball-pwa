/**
 * US-SCHEDULE-EDITOR: InlineMatchEditor Component
 *
 * Provides inline editing capabilities for matches:
 * - Referee selection with conflict checking
 * - Field selection with availability checking
 * - Visual feedback for invalid options
 */

import React, { useState, useCallback } from 'react';
import { Match, Team, RefereeConfig } from '../../../types/tournament';
import { colors, spacing, borderRadius, fontSizes, fontWeights } from '../../../design-tokens';
import { ScheduleConflict } from '../types';

// ============================================================================
// Types
// ============================================================================

interface InlineMatchEditorProps {
  /** The match being edited */
  match: Match;
  /** Teams for referee names */
  teams: Team[];
  /** Referee configuration */
  refereeConfig?: RefereeConfig;
  /** Number of fields available */
  numberOfFields: number;
  /** Callback when referee is changed */
  onRefereeChange: (matchId: string, newReferee: number | undefined) => void;
  /** Callback when field is changed */
  onFieldChange: (matchId: string, newField: number) => void;
  /** Whether editing is enabled */
  enabled?: boolean;
  /** Validate and return conflicts for a proposed change */
  validateChange?: (change: {
    matchId: string;
    field: 'referee' | 'field';
    newValue: number | undefined;
  }) => ScheduleConflict[];
}

interface SelectOption {
  value: number | undefined;
  label: string;
  hasConflict: boolean;
  conflictMessage?: string;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  flexWrap: 'wrap',
};

const fieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
};

const labelStyle: React.CSSProperties = {
  fontSize: fontSizes.xs,
  color: colors.textSecondary,
  fontWeight: fontWeights.medium,
  minWidth: '30px',
};

const selectContainerStyle: React.CSSProperties = {
  position: 'relative',
};

const selectStyle = (hasConflict: boolean, isOpen: boolean): React.CSSProperties => ({
  appearance: 'none',
  padding: `${spacing.xs} ${spacing.md} ${spacing.xs} ${spacing.sm}`,
  fontSize: fontSizes.sm,
  fontWeight: fontWeights.medium,
  color: hasConflict ? colors.error : colors.textPrimary,
  backgroundColor: hasConflict ? 'rgba(239, 83, 80, 0.1)' : colors.surface,
  border: `1px solid ${hasConflict ? colors.error : isOpen ? colors.primary : colors.border}`,
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
  minWidth: '80px',
  outline: 'none',
  transition: 'border-color 0.15s ease',
});

const selectArrowStyle: React.CSSProperties = {
  position: 'absolute',
  right: spacing.xs,
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  fontSize: fontSizes.xs,
  color: colors.textSecondary,
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.6,
  cursor: 'not-allowed',
};

// ============================================================================
// Component
// ============================================================================

export const InlineMatchEditor: React.FC<InlineMatchEditorProps> = ({
  match,
  teams,
  refereeConfig,
  numberOfFields,
  onRefereeChange,
  onFieldChange,
  enabled = true,
  validateChange,
}) => {
  const [activeSelect, setActiveSelect] = useState<'referee' | 'field' | null>(null);

  // Get referee options
  const getRefereeOptions = useCallback((): SelectOption[] => {
    const options: SelectOption[] = [
      { value: undefined, label: '— Kein SR —', hasConflict: false },
    ];

    if (!refereeConfig || refereeConfig.mode === 'none') {
      return options;
    }

    if (refereeConfig.mode === 'organizer' && refereeConfig.numberOfReferees) {
      // Organizer-provided referees
      for (let i = 1; i <= refereeConfig.numberOfReferees; i++) {
        const name = refereeConfig.refereeNames?.[i] || `SR ${i}`;
        let hasConflict = false;
        let conflictMessage: string | undefined;

        // Check for conflicts if validateChange is provided
        if (validateChange) {
          const conflicts = validateChange({
            matchId: match.id,
            field: 'referee',
            newValue: i,
          });
          const refereeConflicts = conflicts.filter(
            c => c.type === 'referee_double_booking'
          );
          hasConflict = refereeConflicts.length > 0;
          conflictMessage = refereeConflicts[0]?.message;
        }

        options.push({
          value: i,
          label: name,
          hasConflict,
          conflictMessage,
        });
      }
    } else if (refereeConfig.mode === 'teams') {
      // Teams as referees - find teams not playing in this match
      const playingTeamIds = [match.teamA, match.teamB];
      const eligibleTeams = teams.filter(
        t => !playingTeamIds.includes(t.id) && t.name !== 'Freilos'
      );

      for (const team of eligibleTeams) {
        // Use team index + 1 as referee number
        const teamIndex = teams.findIndex(t => t.id === team.id) + 1;
        let hasConflict = false;
        let conflictMessage: string | undefined;

        if (validateChange) {
          const conflicts = validateChange({
            matchId: match.id,
            field: 'referee',
            newValue: teamIndex,
          });
          const refereeConflicts = conflicts.filter(
            c => c.type === 'referee_double_booking'
          );
          hasConflict = refereeConflicts.length > 0;
          conflictMessage = refereeConflicts[0]?.message;
        }

        options.push({
          value: teamIndex,
          label: team.name,
          hasConflict,
          conflictMessage,
        });
      }
    }

    return options;
  }, [match, teams, refereeConfig, validateChange]);

  // Get field options
  const getFieldOptions = useCallback((): SelectOption[] => {
    const options: SelectOption[] = [];

    for (let i = 1; i <= numberOfFields; i++) {
      let hasConflict = false;
      let conflictMessage: string | undefined;

      if (validateChange) {
        const conflicts = validateChange({
          matchId: match.id,
          field: 'field',
          newValue: i,
        });
        const fieldConflicts = conflicts.filter(c => c.type === 'field_overlap');
        hasConflict = fieldConflicts.length > 0;
        conflictMessage = fieldConflicts[0]?.message;
      }

      options.push({
        value: i,
        label: `Feld ${i}`,
        hasConflict,
        conflictMessage,
      });
    }

    return options;
  }, [match, numberOfFields, validateChange]);

  const refereeOptions = getRefereeOptions();
  const fieldOptions = getFieldOptions();

  // Current values
  const currentReferee = match.referee;
  const currentField = match.field;

  // Check if current values have conflicts
  const currentRefereeOption = refereeOptions.find(o => o.value === currentReferee);
  const currentFieldOption = fieldOptions.find(o => o.value === currentField);

  const handleRefereeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newReferee = value === '' ? undefined : parseInt(value, 10);
    onRefereeChange(match.id, newReferee);
    setActiveSelect(null);
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newField = parseInt(e.target.value, 10);
    onFieldChange(match.id, newField);
    setActiveSelect(null);
  };

  // Don't show referee selector if mode is 'none'
  const showRefereeSelector = refereeConfig && refereeConfig.mode !== 'none';

  if (!enabled) {
    return (
      <div style={{ ...containerStyle, ...disabledStyle }}>
        {showRefereeSelector && (
          <div style={fieldGroupStyle}>
            <span style={labelStyle}>SR:</span>
            <span style={{ fontSize: fontSizes.sm }}>
              {currentRefereeOption?.label ?? '—'}
            </span>
          </div>
        )}
        <div style={fieldGroupStyle}>
          <span style={labelStyle}>Feld:</span>
          <span style={{ fontSize: fontSizes.sm }}>
            {currentFieldOption?.label ?? `Feld ${currentField}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Referee Selector */}
      {showRefereeSelector && (
        <div style={fieldGroupStyle}>
          <span style={labelStyle}>SR:</span>
          <div style={selectContainerStyle}>
            <select
              value={currentReferee ?? ''}
              onChange={handleRefereeChange}
              onFocus={() => setActiveSelect('referee')}
              onBlur={() => setActiveSelect(null)}
              style={selectStyle(
                currentRefereeOption?.hasConflict ?? false,
                activeSelect === 'referee'
              )}
              title={currentRefereeOption?.conflictMessage}
            >
              {refereeOptions.map(option => (
                <option
                  key={option.value ?? 'none'}
                  value={option.value ?? ''}
                  style={{
                    color: option.hasConflict ? colors.error : 'inherit',
                    backgroundColor: option.hasConflict
                      ? 'rgba(239, 83, 80, 0.1)'
                      : 'inherit',
                  }}
                >
                  {option.label}
                  {option.hasConflict ? ' ⚠️' : ''}
                </option>
              ))}
            </select>
            <span style={selectArrowStyle}>▼</span>
          </div>
        </div>
      )}

      {/* Field Selector */}
      <div style={fieldGroupStyle}>
        <span style={labelStyle}>Feld:</span>
        <div style={selectContainerStyle}>
          <select
            value={currentField}
            onChange={handleFieldChange}
            onFocus={() => setActiveSelect('field')}
            onBlur={() => setActiveSelect(null)}
            style={selectStyle(
              currentFieldOption?.hasConflict ?? false,
              activeSelect === 'field'
            )}
            title={currentFieldOption?.conflictMessage}
          >
            {fieldOptions.map(option => (
              <option
                key={option.value}
                value={option.value}
                style={{
                  color: option.hasConflict ? colors.error : 'inherit',
                  backgroundColor: option.hasConflict
                    ? 'rgba(239, 83, 80, 0.1)'
                    : 'inherit',
                }}
              >
                {option.label}
                {option.hasConflict ? ' ⚠️' : ''}
              </option>
            ))}
          </select>
          <span style={selectArrowStyle}>▼</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Compact Inline Editor (for grid cells)
// ============================================================================

interface CompactInlineEditorProps {
  options: SelectOption[];
  currentValue: number | undefined;
  onChange: (value: number | undefined) => void;
  enabled?: boolean;
  size?: 'sm' | 'md';
  hasConflict?: boolean;
}

export const CompactInlineEditor: React.FC<CompactInlineEditorProps> = ({
  options,
  currentValue,
  onChange,
  enabled = true,
  size = 'sm',
  hasConflict = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentOption = options.find(o => o.value === currentValue);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newValue = value === '' ? undefined : parseInt(value, 10);
    onChange(newValue);
    setIsOpen(false);
  };

  const showConflict = hasConflict || currentOption?.hasConflict;

  const compactSelectStyle: React.CSSProperties = {
    appearance: 'none',
    padding: size === 'sm' ? '2px 16px 2px 4px' : `${spacing.xs} ${spacing.md} ${spacing.xs} ${spacing.sm}`,
    fontSize: size === 'sm' ? fontSizes.xs : fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: showConflict ? colors.error : colors.textPrimary,
    backgroundColor: showConflict ? 'rgba(239, 83, 80, 0.1)' : 'transparent',
    border: `1px solid ${showConflict ? colors.error : isOpen ? colors.primary : colors.border}`,
    borderRadius: borderRadius.sm,
    cursor: enabled ? 'pointer' : 'not-allowed',
    minWidth: size === 'sm' ? '50px' : '70px',
    outline: 'none',
    opacity: enabled ? 1 : 0.6,
  };

  if (!enabled) {
    return (
      <span
        style={{
          fontSize: size === 'sm' ? fontSizes.xs : fontSizes.sm,
          color: showConflict ? colors.error : colors.textSecondary,
        }}
      >
        {currentOption?.label ?? '—'}
      </span>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={currentValue ?? ''}
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        style={compactSelectStyle}
        disabled={!enabled}
        title={currentOption?.conflictMessage}
      >
        {options.map(option => (
          <option key={option.value ?? 'none'} value={option.value ?? ''}>
            {option.label}
            {option.hasConflict ? ' ⚠️' : ''}
          </option>
        ))}
      </select>
      <span
        style={{
          position: 'absolute',
          right: '4px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          fontSize: '8px',
          color: colors.textSecondary,
        }}
      >
        ▼
      </span>
    </div>
  );
};

export default InlineMatchEditor;
