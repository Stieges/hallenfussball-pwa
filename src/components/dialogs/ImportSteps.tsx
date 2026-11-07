/**
 * Import Steps - Step components for ImportDialog
 *
 * Contains the first two step components (the other two: ImportResultSteps.tsx):
 * - SelectStep: File selection with drag & drop
 * - WarningsStep: Display import warnings
 */

import { CSSProperties, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Icons } from '../ui/Icons';
import { cssVars } from '../../design-tokens'
import { ImportValidationResult } from '../../types/tournament';
import { downloadTemplate } from './ImportTemplates';

// =============================================================================
// SELECT STEP
// =============================================================================

export interface SelectStepProps {
  isDragging: boolean;
  error: string;
  selectedFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onButtonClick: () => void;
}

export const SelectStep = ({
  isDragging,
  error,
  selectedFile,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onButtonClick,
}: SelectStepProps) => {
  const { t } = useTranslation('dashboard');
  const dropZoneStyle: CSSProperties = {
    border: `2px dashed ${isDragging ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.xxl,
    textAlign: 'center',
    background: isDragging ? cssVars.colors.primaryLight : 'transparent',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };

  const iconStyle: CSSProperties = {
    fontSize: '48px',
    marginBottom: cssVars.spacing.md,
  };

  const hintStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginTop: cssVars.spacing.md,
  };

  const errorStyle: CSSProperties = {
    padding: cssVars.spacing.md,
    background: cssVars.colors.errorLight,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.error}`,
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.error,
    fontSize: cssVars.fontSizes.sm,
  };

  return (
    <>
      <div
        style={dropZoneStyle}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onButtonClick}
      >
        <div style={iconStyle}>
          {isDragging ? '📂' : '📁'}
        </div>
        <p style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.md, margin: 0 }}>
          {isDragging ? t('import.select.dropHere') : t('import.select.dragOrClick')}
        </p>
        <p style={hintStyle}>
          {t('import.select.supportedFormats')}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={onFileSelect}
        style={{ display: 'none' }}
        data-testid="import-file-input"
      />

      {selectedFile && !error && (
        <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
          {t('import.select.selected', { fileName: selectedFile.name })}
        </div>
      )}

      {error && (
        <div style={errorStyle} data-testid="import-error">
          {error}
        </div>
      )}

      <Button
        variant="secondary"
        size="md"
        icon={<Icons.Upload />}
        onClick={onButtonClick}
        fullWidth
      >
        {t('import.select.chooseFile')}
      </Button>

      {/* Template Downloads */}
      <div style={{
        marginTop: cssVars.spacing.lg,
        paddingTop: cssVars.spacing.lg,
        borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
      }}>
        <p style={{
          fontSize: cssVars.fontSizes.sm,
          color: cssVars.colors.textSecondary,
          margin: `0 0 ${cssVars.spacing.md} 0`,
          textAlign: 'center',
        }}>
          {t('import.select.downloadTemplate')}
        </p>
        <div style={{ display: 'flex', gap: cssVars.spacing.md }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Icons.Download />}
            onClick={() => downloadTemplate('json')}
            fullWidth
          >
            {t('import.select.jsonTemplate')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Icons.Download />}
            onClick={() => downloadTemplate('csv')}
            fullWidth
          >
            {t('import.select.csvTemplate')}
          </Button>
        </div>
        <p style={{
          fontSize: cssVars.fontSizes.xs,
          color: cssVars.colors.textMuted,
          margin: `${cssVars.spacing.sm} 0 0 0`,
          textAlign: 'center',
          lineHeight: '1.4',
        }}>
          {t('import.select.jsonDescription')}<br />
          {t('import.select.csvDescription')}
        </p>
      </div>
    </>
  );
};

// =============================================================================
// WARNINGS STEP
// =============================================================================

export interface WarningsStepProps {
  warnings: ImportValidationResult['warnings'];
  onBack: () => void;
  onContinue: () => void;
}

export const WarningsStep = ({ warnings, onBack, onContinue }: WarningsStepProps) => {
  const { t } = useTranslation('dashboard');
  const warningsContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    maxHeight: '300px',
    overflowY: 'auto',
  };

  const warningItemStyle = (severity: 'info' | 'warning'): CSSProperties => ({
    padding: cssVars.spacing.md,
    background: severity === 'warning' ? cssVars.colors.warningLight : cssVars.colors.infoLight,
    border: `${cssVars.borderWidth.thin} solid ${severity === 'warning' ? cssVars.colors.correctionBorder : cssVars.colors.secondaryLight}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    color: severity === 'warning' ? cssVars.colors.warning : cssVars.colors.secondary,
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
  });

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.md,
    marginTop: cssVars.spacing.md,
  };

  const infoWarnings = warnings.filter(w => w.severity === 'info');
  const realWarnings = warnings.filter(w => w.severity === 'warning');

  return (
    <>
      <p style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, margin: 0 }}>
        {t('import.warnings.intro')}
      </p>

      <div style={warningsContainerStyle}>
        {realWarnings.map((warning, index) => (
          <div key={`warning-${index}`} style={warningItemStyle('warning')}>
            <span>⚠️</span>
            <span>{warning.message}</span>
          </div>
        ))}
        {infoWarnings.map((warning, index) => (
          <div key={`info-${index}`} style={warningItemStyle('info')}>
            <span>ℹ️</span>
            <span>{warning.message}</span>
          </div>
        ))}
      </div>

      <div style={buttonGroupStyle}>
        <Button variant="secondary" size="md" onClick={onBack} fullWidth>
          {t('import.warnings.back')}
        </Button>
        <Button variant="primary" size="md" onClick={onContinue} fullWidth data-testid="import-warnings-continue">
          {t('import.warnings.continueAnyway')}
        </Button>
      </div>
    </>
  );
};


export { PreviewStep, SuccessStep } from './ImportResultSteps';
export type { PreviewStepProps, SuccessStepProps } from './ImportResultSteps';
