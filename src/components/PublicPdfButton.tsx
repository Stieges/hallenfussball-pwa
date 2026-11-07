/**
 * PDF-Knopf der Zuschauer-Seite `/live/:code` (B-28 C8, @BM-028 Zeile „Mama Petra“, @BM-057, @BM-041): öffnet den PDF-Dialog mit
 * `audience="viewer"`, also „Spielplan“ ohne Ergebnisse und Tabellen; nach dem Abschluss dazu den Endstand (`final`, nur wenn die
 * Zuschauer-Seite ihn zeigen darf). Eingebunden über `PublicPdfRow`.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Icons } from './ui/Icons';
import { PDFExportDialog } from './dialogs/PDFExportDialog';
import type { GeneratedSchedule } from '../core/generators';
import type { Standing, Tournament } from '../types/tournament';
import type { FinalPdfSource } from './dialogs/pdfExport/finalPdfSource';

export interface PublicPdfButtonProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  /** Endstand der Zuschauer-Seite (@BM-041); ohne Angabe nur „Spielplan“. */
  final?: FinalPdfSource;
}

export const PublicPdfButton = ({ tournament, schedule, standings, final }: PublicPdfButtonProps) => {
  const { t } = useTranslation('tournament');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="md" icon={<Icons.Download />} onClick={() => setOpen(true)} data-testid="public-pdf-button">
        {t('pdfExport.open')}
      </Button>
      <PDFExportDialog isOpen={open} onClose={() => setOpen(false)} tournament={tournament} schedule={schedule} standings={standings} audience="viewer" viewerFinal={final} />
    </>
  );
};
