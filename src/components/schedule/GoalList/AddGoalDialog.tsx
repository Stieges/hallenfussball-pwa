/**
 * AddGoalDialog - Dialog to add a new goal
 *
 * Modal dialog with fields:
 * - Team selection (toggle Home/Away)
 * - Player number (optional, numpad)
 * - Time in match (optional)
 *
 * @example
 * ```tsx
 * <AddGoalDialog
 *   isOpen={showAddGoal}
 *   onClose={() => setShowAddGoal(false)}
 *   homeTeam={{ id: '1', name: 'Team A' }}
 *   awayTeam={{ id: '2', name: 'Team B' }}
 *   currentTimeSeconds={195}
 *   onAdd={(goal) => addGoal(goal)}
 * />
 * ```
 */

import { type CSSProperties, useState, useEffect } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
import { Dialog } from '../../dialogs/Dialog';
import { Button } from '../../ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
}

export interface NewGoal {
  teamId: string;
  playerNumber?: number;
  timestampSeconds: number;
}

export interface AddGoalDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Callback to close dialog */
  onClose: () => void;
  /** Home team info */
  homeTeam: Team;
  /** Away team info */
  awayTeam: Team;
  /** Current match time in seconds */
  currentTimeSeconds?: number;
  /** Callback when goal is added */
  onAdd: (goal: NewGoal) => void;
  /** Whether the match is live */
  isLive?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseTime(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  if (isNaN(mins) || isNaN(secs) || secs >= 60) {
    return null;
  }
  return mins * 60 + secs;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AddGoalDialog: React.FC<AddGoalDialogProps> = ({
  isOpen,
  onClose,
  homeTeam,
  awayTeam,
  currentTimeSeconds = 0,
  onAdd,
  isLive = false,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(homeTeam.id);
  const [playerNumber, setPlayerNumber] = useState<string>('');
  const [timeInput, setTimeInput] = useState<string>('');

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTeamId(homeTeam.id);
      setPlayerNumber('');
      setTimeInput(formatTime(currentTimeSeconds));
    }
  }, [isOpen, homeTeam.id, currentTimeSeconds]);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const formStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  };

  const fieldStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  };

  const teamToggleStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
  };

  const teamButtonStyle = (isSelected: boolean): CSSProperties => ({
    flex: 1,
    padding: spacing.md,
    backgroundColor: isSelected ? colors.primary : colors.surface,
    color: isSelected ? colors.onPrimary : colors.textPrimary,
    border: `2px solid ${isSelected ? colors.primary : colors.border}`,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'center',
  });

  const inputStyle: CSSProperties = {
    padding: spacing.md,
    backgroundColor: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontVariantNumeric: 'tabular-nums',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  };

  const hintStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTop: `1px solid ${colors.border}`,
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAdd = () => {
    const parsedTime = parseTime(timeInput);
    const time = parsedTime ?? currentTimeSeconds;
    const number = playerNumber ? parseInt(playerNumber, 10) : undefined;

    const goal: NewGoal = {
      teamId: selectedTeamId,
      playerNumber: number && !isNaN(number) ? number : undefined,
      timestampSeconds: time,
    };

    onAdd(goal);
    onClose();
  };

  const handlePlayerNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers 0-99
    if (value === '' || (/^\d{1,2}$/.test(value) && parseInt(value, 10) <= 99)) {
      setPlayerNumber(value);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeInput(e.target.value);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Tor hinzufügen"
      maxWidth="400px"
    >
      <div style={formStyle}>
        {/* Team Selection */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Team</label>
          <div style={teamToggleStyle}>
            <button
              type="button"
              style={teamButtonStyle(selectedTeamId === homeTeam.id)}
              onClick={() => setSelectedTeamId(homeTeam.id)}
            >
              {homeTeam.name}
            </button>
            <button
              type="button"
              style={teamButtonStyle(selectedTeamId === awayTeam.id)}
              onClick={() => setSelectedTeamId(awayTeam.id)}
            >
              {awayTeam.name}
            </button>
          </div>
        </div>

        {/* Player Number */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Trikotnummer (optional)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={playerNumber}
            onChange={handlePlayerNumberChange}
            placeholder="10"
            style={inputStyle}
            autoComplete="off"
          />
          <span style={hintStyle}>
            Kann später nachgetragen werden
          </span>
        </div>

        {/* Time */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Spielminute</label>
          <input
            type="text"
            value={timeInput}
            onChange={handleTimeChange}
            placeholder="MM:SS"
            style={inputStyle}
            autoComplete="off"
          />
          <span style={hintStyle}>
            {isLive ? 'Aktuelle Zeit wird vorgeschlagen' : 'Format: MM:SS'}
          </span>
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            Abbrechen
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleAdd}
          >
            Tor hinzufügen
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default AddGoalDialog;
