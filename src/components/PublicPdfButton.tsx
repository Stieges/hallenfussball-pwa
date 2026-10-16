/**
 * PDF-Knopf der Zuschauer-Seite `/live/:code` (B-28 C8, @BM-028 Zeile „Mama Petra“, @BM-057): öffnet den PDF-Dialog mit
 * `audience="viewer"`, also nur „Spielplan“ ohne Ergebnisse und Tabellen. Noch nicht eingebunden: die Zuschauer-Seite
 * bindet ihn mit C11 (a6) ein; hier steht nur der Baustein.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Icons } from './ui/Icons';
import { PDFExportDialog } from './dialogs/PDFExportDialog';
import type { GeneratedSchedule } from '../core/generators';
import type { Standing, Tournament } from '../types/tournament';

export interface PublicPdfButtonProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
}

export const PublicPdfButton = ({ tournament, schedule, standings }: PublicPdfButtonProps) => {
  const { t } = useTranslation('tournament');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="md" icon={<Icons.Download />} onClick={() => setOpen(true)} data-testid="public-pdf-button">
        {t('pdfExport.open')}
      </Button>
      <PDFExportDialog isOpen={open} onClose={() => setOpen(false)} tournament={tournament} schedule={schedule} standings={standings} audience="viewer" />
    </>
  );
};
