/**
 * Import Steps (Ergebnis) - PreviewStep und SuccessStep des ImportDialog (aus ImportSteps.tsx herausgelöst, Datei unter 300 Zeilen).
 * Über `ImportSteps.tsx` weiter wie bisher importierbar.
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { cssVars } from '../../design-tokens';
import { Tournament } from '../../types/tournament';
import { formatTournamentDate } from '../../utils/tournamentCategories';
import { ageClassText } from '../../core/view';

// =============================================================================
// PREVIEW STEP
// =============================================================================

export interface PreviewStepProps {
  tournament: Tournament;
  onBack: () => void;
  onImport: () => void;
  /** Das Turnier wird gerade gespeichert: Tasten gesperrt (kein doppeltes Importieren). */
  isSaving?: boolean;
  /** Speichern ist gescheitert: nichts ist importiert, der Dialog bleibt in der Vorschau. */
  error?: string;
}

export const PreviewStep = ({ tournament, onBack, onImport, isSaving = false, error = '' }: PreviewStepProps) => {
  const { t } = useTranslation('dashboard');
  const previewContainerStyle: CSSProperties = {
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.lg,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
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
            <span style={labelStyle}>{t('import.preview.labels.date')}</span>
            <span style={valueStyle}>{formatTournamentDate(tournament)}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>{t('import.preview.labels.location')}</span>
            <span style={valueStyle}>{tournament.location.name || '-'}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>{t('import.preview.labels.teams')}</span>
            <span style={valueStyle}>{tournament.teams.length}</span>
          </div>
          <div style={previewItemStyle}>
            <span style={labelStyle}>{t('import.preview.labels.matches')}</span>
            <span style={valueStyle}>{tournament.matches.length}</span>
          </div>
          {ageClassText(tournament.ageClass) !== '' && (
            <div style={previewItemStyle}>
              <span style={labelStyle}>{t('import.preview.labels.ageClass')}</span>
              <span style={valueStyle}>{ageClassText(tournament.ageClass)}</span>
            </div>
          )}
          <div style={previewItemStyle}>
            <span style={labelStyle}>{t('import.preview.labels.source')}</span>
            <span style={{ ...valueStyle, color: cssVars.colors.statusExternal }}>
              {tournament.externalSource}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="import-save-error"
          style={{
            padding: cssVars.spacing.md,
            background: cssVars.colors.errorLight,
            border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.error}`,
            borderRadius: cssVars.borderRadius.sm,
            color: cssVars.colors.error,
            fontSize: cssVars.fontSizes.sm,
          }}
        >
          {error}
        </div>
      )}

      <div style={buttonGroupStyle}>
        <Button variant="secondary" size="md" onClick={onBack} fullWidth disabled={isSaving}>
          {t('import.preview.back')}
        </Button>
        <Button variant="primary" size="md" onClick={onImport} fullWidth disabled={isSaving} data-testid="import-confirm">
          {t('import.preview.import')}
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
  /** Die Datei bringt einen Spielplan mit: das Turnier steht „Bereit“ auf der Startseite. Sonst fehlt der Spielplan noch. */
  hasSchedule: boolean;
  onComplete: () => void;
}

export const SuccessStep = ({ tournament, hasSchedule, onComplete }: SuccessStepProps) => {
  const { t } = useTranslation('dashboard');
  const successContainerStyle: CSSProperties = {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
  };

  const iconStyle: CSSProperties = {
    fontSize: '64px', // Token fehlt (Symbol der Erfolgsmeldung; Frage an Daniel), unverändert aus ImportSteps übernommen
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
          {t('import.success.message', { title: tournament.title })}
        </p>
        <p style={subMessageStyle} data-testid="import-success-hint">
          {hasSchedule ? t('import.success.hintReady') : t('import.success.hintNoSchedule')}
        </p>
      </div>

      <Button variant="primary" size="md" onClick={onComplete} fullWidth data-testid="import-success-go">
        {hasSchedule ? t('import.success.done') : t('import.success.createSchedule')}
      </Button>
    </>
  );
};
