/**
 * „Als PDF“ über dem gespeicherten Endstand (@DR-048 Z. 3, @DR-011): öffnet den PDF-Dialog, in dem „Endstand“ vorgewählt ist. Für
 * Turnierleitung, Co-Admin und Helfer (Daniel 07.11.: „Wenn sogar der Zuschauer die PDF sieht, kann sie der Helfer doch auch sehen“) –
 * das Recht writeMatchData aus rolePermissions.json über useCan haben genau sie (Eigentümer immer); Trainer, Zuschauer-Konten und
 * Fremde nicht. Es bleibt nach dem Abschluss offen (`openAfterClose`): der Knopf druckt nur den gespeicherten Endstand, schreibt nichts.
 * Den Aushang im Dialog gibt es weiter nur mit tournamentSettings.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GeneratedSchedule } from '../../../core/generators';
import type { Standing, Tournament } from '../../../types/tournament';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { PDFExportDialog } from '../../../components/dialogs/PDFExportDialog';
import { useCan } from '../../auth/hooks/useCan';

export interface FinalStandingsPdfButtonProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
}

export function FinalStandingsPdfButton({ tournament, schedule, standings }: FinalStandingsPdfButtonProps) {
  const { t } = useTranslation('tournament');
  const canPrint = useCan('writeMatchData', tournament.id, { openAfterClose: true });
  const canNotice = useCan('tournamentSettings', tournament.id, { openAfterClose: true });
  const [open, setOpen] = useState(false);
  if (!canPrint) {
    return null;
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Button variant="secondary" size="md" icon={<Icons.Download />} onClick={() => setOpen(true)} data-testid="final-standings-pdf">
        {t('pdfExport.open')}
      </Button>
      <PDFExportDialog isOpen={open} onClose={() => setOpen(false)} tournament={tournament} schedule={schedule} standings={standings} canCreateNotice={canNotice} canCreateFinal />
    </div>
  );
}
