/**
 * Import Steps - Step components for ImportDialog
 *
 * Contains all four step components:
 * - SelectStep: File selection with drag & drop
 * - WarningsStep: Display import warnings
 * - PreviewStep: Tournament preview before import
 * - SuccessStep: Success confirmation
 */

import { CSSProperties, DragEvent } from 'react';
import { Button } from '../ui/Button';
import { Icons } from '../ui/Icons';
import { borderRadius, colors, fontSizes, spacing } from '../../design-tokens';
import { Tournament, ImportValidationResult } from '../../types/tournament';
import { formatTournamentDate } from '../../utils/tournamentCategories';
import { downloadTemplate } from './ImportTemplates';

// =============================================================================
// SELECT STEP
// =============================================================================

export interface SelectStepProps {
  isDragging: boolean;
  error: string;
  selectedFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
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
  const dropZoneStyle: CSSProperties = {
    border: `2px dashed ${isDragging ? colors.primary : colors.border}`,
    borderRadius: borderRadius.md,
    padding: spacing.xxl,
    textAlign: 'center',
    background: isDragging ? colors.primaryLight : 'transparent',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };

  const iconStyle: CSSProperties = {
    fontSize: '48px',
    marginBottom: spacing.md,
  };

  const hintStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  };

  const errorStyle: CSSProperties = {
    padding: spacing.md,
    background: colors.errorLight,
    border: `1px solid ${colors.error}`,
    borderRadius: borderRadius.sm,
    color: colors.error,
    fontSize: fontSizes.sm,
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
        <p style={{ color: colors.textPrimary, fontSize: fontSizes.md, margin: 0 }}>
          {isDragging ? 'Datei hier ablegen' : 'Datei hierher ziehen oder klicken'}
        </p>
        <p style={hintStyle}>
          Unterstützte Formate: JSON, CSV
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={onFileSelect}
        style={{ display: 'none' }}
      />

      {selectedFile && !error && (
        <div style={{ fontSize: fontSizes.sm, color: colors.textSecondary }}>
          Ausgewählt: {selectedFile.name}
        </div>
      )}

      {error && (
        <div style={errorStyle}>
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
        Datei auswählen
      </Button>

      {/* Template Downloads */}
      <div style={{
        marginTop: spacing.lg,
        paddingTop: spacing.lg,
        borderTop: `1px solid ${colors.border}`,
      }}>
        <p style={{
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          margin: `0 0 ${spacing.md} 0`,
          textAlign: 'center',
        }}>
          Vorlage herunterladen:
        </p>
        <div style={{ display: 'flex', gap: spacing.md }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Icons.Download />}
            onClick={() => downloadTemplate('json')}
            fullWidth
          >
            JSON-Vorlage
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Icons.Download />}
            onClick={() => downloadTemplate('csv')}
            fullWidth
          >
            CSV-Vorlage
          </Button>
        </div>
        <p style={{
          fontSize: fontSizes.xs,
          color: colors.textMuted,
          margin: `${spacing.sm} 0 0 0`,
          textAlign: 'center',
          lineHeight: '1.4',
        }}>
          JSON: Komplettes Turnier mit Teams & Spielen<br />
          CSV: Einfache Team-Liste (Spielplan wird generiert)
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
  const warningsContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    maxHeight: '300px',
    overflowY: 'auto',
  };

  const warningItemStyle = (severity: 'info' | 'warning'): CSSProperties => ({
    padding: spacing.md,
    background: severity === 'warning' ? colors.warningLight : colors.infoLight,
    border: `1px solid ${severity === 'warning' ? colors.correctionBorder : colors.secondaryLight}`,
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.sm,
    color: severity === 'warning' ? colors.warning : colors.secondary,
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.sm,
  });

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.md,
    marginTop: spacing.md,
  };

  const infoWarnings = warnings.filter(w => w.severity === 'info');
  const realWarnings = warnings.filter(w => w.severity === 'warning');

  return (
    <>
      <p style={{ color: colors.textSecondary, fontSize: fontSizes.sm, margin: 0 }}>
        Beim Import wurden folgende Hinweise festgestellt:
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
          Zurück
        </Button>
        <Button variant="primary" size="md" onClick={onContinue} fullWidth>
          Trotzdem importieren
        </Button>
      </div>
    </>
  );
};

// =============================================================================
// PREVIEW STEP
// =============================================================================

export interface PreviewStepProps {
  tournament: Tournament;
  onBack: () => void;
  onImport: () => void;
}

export const PreviewStep = ({ tournament, onBack, onImport }: PreviewStepProps) => {
  const previewContainerStyle: CSSProperties = {
    background: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    border: `1px solid ${colors.border}`,
  };

  const previewGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.md,
  };

  const previewItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  };

  const valueStyle: CSSProperties = {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  };

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.md,
    marginTop: spacing.md,
  };

  return (
    <>
      <div style={previewContainerStyle}>
        <h3 style={{ color: colors.textPrimary, fontSize: fontSizes.lg, margin: `0 0 ${spacing.lg} 0` }}>
          {tournament.title}
        </h3>

        <div style={previewGridStyle}>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Datum</span>
            <span style={valueStyle}>{formatTournamentDate(tournament)}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Ort</span>
            <span style={valueStyle}>{tournament.location.name || '-'}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Teams</span>
            <span style={valueStyle}>{tournament.teams.length}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Spiele</span>
            <span style={valueStyle}>{tournament.matches.length}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Altersklasse</span>
            <span style={valueStyle}>{tournament.ageClass}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>Quelle</span>
            <span style={{ ...valueStyle, color: colors.statusExternal }}>
              {tournament.externalSource}
            </span>
          </div>
        </div>
      </div>

      <div style={buttonGroupStyle}>
        <Button variant="secondary" size="md" onClick={onBack} fullWidth>
          Zurück
        </Button>
        <Button variant="primary" size="md" onClick={onImport} fullWidth>
          Importieren
        </Button>
      </div>
    </>
  );
};

// =============================================================================
// SUCCESS STEP
// =============================================================================

export interface SuccessStepProps {
  tournament: Tournament;
  onComplete: () => void;
}

export const SuccessStep = ({ tournament, onComplete }: SuccessStepProps) => {
  const successContainerStyle: CSSProperties = {
    textAlign: 'center',
    padding: spacing.xl,
  };

  const iconStyle: CSSProperties = {
    fontSize: '64px',
    marginBottom: spacing.lg,
  };

  const messageStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  };

  const subMessageStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  };

  return (
    <>
      <div style={successContainerStyle}>
        <div style={iconStyle}>✅</div>
        <p style={messageStyle}>
          "{tournament.title}" wurde erfolgreich importiert!
        </p>
        <p style={subMessageStyle}>
          Das Turnier wurde als Entwurf gespeichert und kann jetzt bearbeitet werden.
        </p>
      </div>

      <Button variant="primary" size="md" onClick={onComplete} fullWidth>
        Zum Turnier
      </Button>
    </>
  );
};
