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
import { theme } from '../../styles/theme';
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
      alert('Das neue Ergebnis muss sich vom ursprünglichen unterscheiden.');
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: theme.spacing.lg,
  };

  const dialogStyle: CSSProperties = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    maxWidth: '450px',
    width: '100%',
    boxShadow: theme.shadows.lg,
    border: `2px solid #FFC107`,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    margin: 0,
  };

  const sectionStyle: CSSProperties = {
    marginBottom: theme.spacing.lg,
  };

  const labelStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
    display: 'block',
  };

  const matchInfoStyle: CSSProperties = {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  };

  const matchLabelStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  };

  const teamsStyle: CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  };

  const originalScoreStyle: CSSProperties = {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const scoreInputContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  };

  const scoreInputStyle: CSSProperties = {
    width: '80px',
    padding: theme.spacing.md,
    border: `2px solid ${theme.colors.primary}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold,
    textAlign: 'center',
    backgroundColor: theme.colors.background,
    color: theme.colors.text.primary,
  };

  const separatorStyle: CSSProperties = {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
  };

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSizes.md,
    backgroundColor: theme.colors.background,
    color: theme.colors.text.primary,
    cursor: 'pointer',
  };

  const textareaStyle: CSSProperties = {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSizes.md,
    backgroundColor: theme.colors.background,
    color: theme.colors.text.primary,
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit',
  };

  const warningStyle: CSSProperties = {
    padding: theme.spacing.md,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSizes.sm,
    color: '#FFC107',
    marginBottom: theme.spacing.lg,
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  };

  const buttonBaseStyle: CSSProperties = {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const cancelButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.text.secondary,
  };

  const confirmButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#FFC107',
    border: 'none',
    color: '#000',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontSize: '24px' }}>&#9888;&#65039;</span>
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
