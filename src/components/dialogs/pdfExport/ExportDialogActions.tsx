/**
 * Knopfleiste des PDF-Dialogs (B-28 C8): je Schritt „Abbrechen“ und der Hauptknopf (≥ 56 px). Wahl: „Als PDF speichern“,
 * beim Bauen „Wird erstellt …“, nach einem Fehler „Erneut versuchen“; Hinweis: „Trotzdem speichern“; danach „Schließen“.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import type { PdfStep } from './usePdfExport';

export interface ExportDialogActionsProps {
  step: PdfStep;
  busy: boolean;
  failed: boolean;
  /** Wahl abbrechen: schließt den Dialog. */
  onCancel: () => void;
  onSave: () => void;
  /** Hinweis abbrechen: zurück zur Wahl. */
  onBack: () => void;
  onSaveAnyway: () => void;
  onClose: () => void;
}

const row: CSSProperties = { display: 'flex', gap: cssVars.spacing.sm, marginTop: cssVars.spacing.lg };

export const ExportDialogActions = ({ step, busy, failed, onCancel, onSave, onBack, onSaveAnyway, onClose }: ExportDialogActionsProps) => {
  const { t } = useTranslation('tournament');
  if (step === 'done') {
    return (
      <div style={row}>
        <Button variant="primary" size="lg" fullWidth onClick={onClose} data-testid="pdf-close">{t('pdfExport.close')}</Button>
      </div>
    );
  }
  if (step === 'hint') {
    return (
      <div style={row}>
        <Button variant="secondary" size="lg" fullWidth onClick={onBack} data-testid="pdf-back">{t('pdfExport.cancel')}</Button>
        <Button variant="primary" size="lg" fullWidth onClick={onSaveAnyway} data-testid="pdf-save-anyway">{t('pdfExport.saveAnyway')}</Button>
      </div>
    );
  }
  return (
    <div style={row}>
      <Button variant="secondary" size="lg" fullWidth onClick={onCancel} disabled={busy} data-testid="pdf-cancel">{t('pdfExport.cancel')}</Button>
      <Button variant="primary" size="lg" fullWidth onClick={onSave} disabled={busy} data-testid="pdf-save">
        {busy ? t('pdfExport.creating') : failed ? t('pdfExport.retry') : t('pdfExport.save')}
      </Button>
    </div>
  );
};
