/**
 * Tasten des PDF-Dialogs (B-28 C8, @OB-061): je Schritt „Abbrechen“ und die Haupttaste; Anordnung und Größe kommen vom Baustein `DialogActions`. Wahl: „Als PDF speichern“,
 * beim Bauen „Wird erstellt …“, nach einem Fehler „Erneut versuchen“; Hinweis: „Trotzdem speichern“; danach „Schließen“.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogActions } from '../../ui/molecules';
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

export const ExportDialogActions = ({ step, busy, failed, onCancel, onSave, onBack, onSaveAnyway, onClose }: ExportDialogActionsProps) => {
  const { t } = useTranslation('tournament');
  const closeRef = useRef<HTMLButtonElement>(null);
  // Nach dem Speichern liegt der Fokus auf „Schließen“, nicht auf dem Knopf, der gerade gespeichert hat
  useEffect(() => {
    if (step === 'done') {
      closeRef.current?.focus();
    }
  }, [step]);
  if (step === 'done') {
    return <DialogActions primary={{ label: t('pdfExport.close'), onClick: onClose, buttonRef: closeRef, 'data-testid': 'pdf-close' }} />;
  }
  if (step === 'hint') {
    return (
      <DialogActions
        secondary={[{ label: t('pdfExport.cancel'), onClick: onBack, 'data-testid': 'pdf-back' }]}
        primary={{ label: t('pdfExport.saveAnyway'), onClick: onSaveAnyway, 'data-testid': 'pdf-save-anyway' }}
      />
    );
  }
  return (
    <DialogActions
      secondary={[{ label: t('pdfExport.cancel'), onClick: onCancel, disabled: busy, 'data-testid': 'pdf-cancel' }]}
      primary={{ label: busy ? t('pdfExport.creating') : failed ? t('pdfExport.retry') : t('pdfExport.save'), onClick: onSave, disabled: busy, 'data-testid': 'pdf-save' }}
    />
  );
};
