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
import { cssVars } from '../../design-tokens'
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
    border: `2px dashed ${isDragging ? cssVars.colors.primary : cssVars.colors.border}`,
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
    border: `1px solid ${cssVars.colors.error}`,
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
        <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
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
        marginTop: cssVars.spacing.lg,
        paddingTop: cssVars.spacing.lg,
        borderTop: `1px solid ${cssVars.colors.border}`,
      }}>
        <p style={{
          fontSize: cssVars.fontSizes.sm,
          color: cssVars.colors.textSecondary,
          margin: `0 0 ${cssVars.spacing.md} 0`,
          textAlign: 'center',
        }}>
          Vorlage herunterladen:
        </p>
        <div style={{ display: 'flex', gap: cssVars.spacing.md }}>
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
          fontSize: cssVars.fontSizes.xs,
          color: cssVars.colors.textMuted,
          margin: `${cssVars.spacing.sm} 0 0 0`,
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
    gap: cssVars.spacing.sm,
    maxHeight: '300px',
    overflowY: 'auto',
  };

  const warningItemStyle = (severity: 'info' | 'warning'): CSSProperties => ({
    padding: cssVars.spacing.md,
    background: severity === 'warning' ? cssVars.colors.warningLight : cssVars.colors.infoLight,
    border: `1px solid ${severity === 'warning' ? cssVars.colors.correctionBorder : cssVars.colors.secondaryLight}`,
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
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.lg,
    border: `1px solid ${cssVars.colors.border}`,
  };

  const previewGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: cssVars.spacing.md,
  };

  const previewItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
  };

  const valueStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
  };

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.md,
    marginTop: cssVars.spacing.md,
  };

  return (
    <>
      <div style={previewContainerStyle}>
        <h3 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.lg, margin: `0 0 ${cssVars.spacing.lg} 0` }}>
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
            <span style={{ ...valueStyle, color: cssVars.colors.statusExternal }}>
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
    padding: cssVars.spacing.xl,
  };

  const iconStyle: CSSProperties = {
    fontSize: '64px',
    marginBottom: cssVars.spacing.lg,
  };

  const messageStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.md,
  };

  const subMessageStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
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
