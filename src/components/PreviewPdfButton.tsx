/**
 * PDF-Knopf der Wizard-Vorschau (B-28 C8-F, G63, @DR-012): öffnet den PDF-Dialog „Als PDF“ statt direkt zu speichern, damit
 * Hinweise zu Zeichen und Schrift VOR dem Speichern erscheinen. Das Turnier ist noch nicht online geteilt: der Aushang bleibt
 * ausgegraut, einen Weg zu den Schaltern gibt es hier nicht.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { PDFExportDialog } from './dialogs/PDFExportDialog';
import type { GeneratedSchedule } from '../core/generators';
import type { Tournament } from '../types/tournament';

export interface PreviewPdfButtonProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
}

export const PreviewPdfButton = ({ tournament, schedule }: PreviewPdfButtonProps) => {
  const { t } = useTranslation('tournament');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="preview-export-pdf">
        {t('pdfExport.open')}
      </Button>
      <PDFExportDialog isOpen={open} onClose={() => setOpen(false)} tournament={tournament} schedule={schedule} standings={schedule.initialStandings} />
    </>
  );
};
