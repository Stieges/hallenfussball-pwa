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
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens'
import { useFocusTrap } from '../../hooks';
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
  const { t } = useTranslation('tournament');
  const { showWarning } = useToast();
  const [newScoreA, setNewScoreA] = useState<string>(String(originalScoreA));
  const [newScoreB, setNewScoreB] = useState<string>(String(originalScoreB));
  const [reason, setReason] = useState<CorrectionReason>('input_error');
  const [note, setNote] = useState<string>('');

  // WCAG 4.1.3: Focus trap for accessibility
  const focusTrap = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
  });

  if (!isOpen) { return null; }

  const handleConfirm = () => {
    const scoreA = parseInt(newScoreA) || 0;
    const scoreB = parseInt(newScoreB) || 0;

    // Validate: Score must be different from original
    if (scoreA === originalScoreA && scoreB === originalScoreB) {
      showWarning(t('correctionDialog.validation.mustDiffer'));
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
    backgroundColor: cssVars.colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: cssVars.spacing.lg,
  };

  const dialogStyle: CSSProperties = {
    backgroundColor: cssVars.colors.surfaceElevated,
    color: cssVars.colors.textPrimary,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.xl,
    maxWidth: '450px',
    width: '100%',
    boxShadow: cssVars.shadows.lg,
    border: `2px solid ${cssVars.colors.warning}`,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    marginBottom: cssVars.spacing.xl,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const sectionStyle: CSSProperties = {
    marginBottom: cssVars.spacing.lg,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.sm,
    display: 'block',
  };

  const matchInfoStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    backgroundColor: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.md,
    marginBottom: cssVars.spacing.lg,
  };

  const matchLabelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.sm,
  };

  const teamsStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.md,
  };

  const originalScoreStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const scoreInputContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.lg,
  };

  const scoreInputStyle: CSSProperties = {
    width: '80px',
    padding: cssVars.spacing.md,
    border: `2px solid ${cssVars.colors.primary}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    textAlign: 'center',
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
  };

  const separatorStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  };

  const selectStyle: CSSProperties = {
    width: '100%',
    height: cssVars.touchTargets.minimum,
    padding: `0 ${cssVars.spacing.xl} 0 ${cssVars.spacing.md}`,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
    // Fix: Prevent all options from rendering at once
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: cssVars.touchTargets.minimum,
  };

  const textareaStyle: CSSProperties = {
    width: '100%',
    padding: cssVars.spacing.md,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit',
  };

  const warningStyle: CSSProperties = {
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.editorDirtyBg,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.warning,
    marginBottom: cssVars.spacing.lg,
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.md,
    marginTop: cssVars.spacing.xl,
  };

  const buttonBaseStyle: CSSProperties = {
    flex: 1,
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const cancelButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    color: cssVars.colors.textSecondary,
  };

  const confirmButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: cssVars.colors.warning,
    border: 'none',
    color: cssVars.colors.onWarning,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        ref={focusTrap.containerRef}
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="correction-dialog-title"
      >
        <div style={headerStyle}>
          <span style={{ fontSize: cssVars.fontSizes.xxl }} aria-hidden="true">⚠️</span>
          <h2 id="correction-dialog-title" style={titleStyle}>{t('correctionDialog.title')}</h2>
        </div>

        {/* Match Info */}
        <div style={matchInfoStyle}>
          <div style={matchLabelStyle}>{matchLabel}</div>
          <div style={teamsStyle}>{teamA} vs {teamB}</div>
          <div style={originalScoreStyle}>
            <span>{t('correctionDialog.currentResult')}:</span>
            <strong>{originalScoreA} : {originalScoreB}</strong>
          </div>
        </div>

        {/* New Score Inputs */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{t('correctionDialog.correctedResult')}</label>
          <div style={scoreInputContainerStyle}>
            <input
              type="number"
              min="0"
              value={newScoreA}
              onChange={(e) => setNewScoreA(e.target.value)}
              style={scoreInputStyle}
              aria-label={t('correctionDialog.goalsFor', { team: teamA })}
            />
            <span style={separatorStyle}>:</span>
            <input
              type="number"
              min="0"
              value={newScoreB}
              onChange={(e) => setNewScoreB(e.target.value)}
              style={scoreInputStyle}
              aria-label={t('correctionDialog.goalsFor', { team: teamB })}
            />
          </div>
        </div>

        {/* Correction Reason Dropdown */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{t('correctionDialog.reason')}</label>
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
          <label style={labelStyle}>{t('correctionDialog.noteLabel')}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={textareaStyle}
            placeholder={t('correctionDialog.notePlaceholder')}
          />
        </div>

        {/* Warning */}
        <div style={warningStyle}>
          <strong>{t('correctionDialog.warningTitle')}:</strong> {t('correctionDialog.warningText')}
        </div>

        {/* Buttons */}
        <div style={buttonContainerStyle}>
          <button style={cancelButtonStyle} onClick={onClose}>
            {t('correctionDialog.cancel')}
          </button>
          <button style={confirmButtonStyle} onClick={handleConfirm}>
            {t('correctionDialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
