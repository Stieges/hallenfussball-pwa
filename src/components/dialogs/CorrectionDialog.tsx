/**
 * CorrectionDialog - Dialog für Ergebnis-Korrekturen
 *
 * Zeigt:
 * - Spielpaarung (Team A vs Team B)
 * - Ursprüngliches Ergebnis
 * - Eingabefelder für korrigiertes Ergebnis
 * - Dropdown für Korrekturgrund
 */

import { useState, CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, shadows, spacing } from '../../design-tokens';
import { useToast } from '../ui/Toast';
import { CorrectionReason, CORRECTION_REASONS } from '../../types/userProfile';

interface CorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scoreA: number, scoreB: number, reason: CorrectionReason, note?: string) => void;

  // Match info
  matchLabel: string;
  teamA: string;
  teamB: string;
  originalScoreA: number;
  originalScoreB: number;
}

export const CorrectionDialog: React.FC<CorrectionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  matchLabel,
  teamA,
  teamB,
  originalScoreA,
  originalScoreB,
}) => {
  const { showWarning } = useToast();
  const [newScoreA, setNewScoreA] = useState<string>(String(originalScoreA));
  const [newScoreB, setNewScoreB] = useState<string>(String(originalScoreB));
  const [reason, setReason] = useState<CorrectionReason>('input_error');
  const [note, setNote] = useState<string>('');

  if (!isOpen) {return null;}

  const handleConfirm = () => {
    const scoreA = parseInt(newScoreA) || 0;
    const scoreB = parseInt(newScoreB) || 0;

    // Validate: Score must be different from original
    if (scoreA === originalScoreA && scoreB === originalScoreB) {
      showWarning('Das neue Ergebnis muss sich vom ursprünglichen unterscheiden.');
      return;
    }

    onConfirm(scoreA, scoreB, reason, note || undefined);
  };

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: spacing.lg,
  };

  const dialogStyle: CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: '450px',
    width: '100%',
    boxShadow: shadows.lg,
    border: `2px solid ${colors.warning}`,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    margin: 0,
  };

  const sectionStyle: CSSProperties = {
    marginBottom: spacing.lg,
  };

  const labelStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    display: 'block',
  };

  const matchInfoStyle: CSSProperties = {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  };

  const matchLabelStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  };

  const teamsStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  };

  const originalScoreStyle: CSSProperties = {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const scoreInputContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  };

  const scoreInputStyle: CSSProperties = {
    width: '80px',
    padding: spacing.md,
    border: `2px solid ${colors.primary}`,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
    backgroundColor: colors.background,
    color: colors.textPrimary,
  };

  const separatorStyle: CSSProperties = {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  };

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: spacing.md,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.md,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    cursor: 'pointer',
  };

  const textareaStyle: CSSProperties = {
    width: '100%',
    padding: spacing.md,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.md,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit',
  };

  const warningStyle: CSSProperties = {
    padding: spacing.md,
    backgroundColor: colors.editorDirtyBg,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.sm,
    color: colors.warning,
    marginBottom: spacing.lg,
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.md,
    marginTop: spacing.xl,
  };

  const buttonBaseStyle: CSSProperties = {
    flex: 1,
    padding: `${spacing.md} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const cancelButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border}`,
    color: colors.textSecondary,
  };

  const confirmButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: colors.warning,
    border: 'none',
    color: colors.onWarning,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontSize: fontSizes.xxl }}>&#9888;&#65039;</span>
          <h2 style={titleStyle}>Ergebnis korrigieren</h2>
        </div>

        {/* Match Info */}
        <div style={matchInfoStyle}>
          <div style={matchLabelStyle}>{matchLabel}</div>
          <div style={teamsStyle}>{teamA} vs {teamB}</div>
          <div style={originalScoreStyle}>
            <span>Aktuelles Ergebnis:</span>
            <strong>{originalScoreA} : {originalScoreB}</strong>
          </div>
        </div>

        {/* New Score Inputs */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Korrigiertes Ergebnis</label>
          <div style={scoreInputContainerStyle}>
            <input
              type="number"
              min="0"
              value={newScoreA}
              onChange={(e) => setNewScoreA(e.target.value)}
              style={scoreInputStyle}
              aria-label={`Tore ${teamA}`}
            />
            <span style={separatorStyle}>:</span>
            <input
              type="number"
              min="0"
              value={newScoreB}
              onChange={(e) => setNewScoreB(e.target.value)}
              style={scoreInputStyle}
              aria-label={`Tore ${teamB}`}
            />
          </div>
        </div>

        {/* Correction Reason Dropdown */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Korrekturgrund *</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as CorrectionReason)}
            style={selectStyle}
          >
            {Object.entries(CORRECTION_REASONS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Optional Note */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Anmerkung (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={textareaStyle}
            placeholder="z.B. Protestentscheidung nach Videoanalyse..."
          />
        </div>

        {/* Warning */}
        <div style={warningStyle}>
          <strong>Hinweis:</strong> Die Korrektur wird protokolliert. Gruppentabellen und Playoff-Paarungen werden neu berechnet.
        </div>

        {/* Buttons */}
        <div style={buttonContainerStyle}>
          <button style={cancelButtonStyle} onClick={onClose}>
            Abbrechen
          </button>
          <button style={confirmButtonStyle} onClick={handleConfirm}>
            Korrektur speichern
          </button>
        </div>
      </div>
    </div>
  );
};
