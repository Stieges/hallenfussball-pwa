/**
 * „Als PDF“ über dem gespeicherten Endstand (@DR-048 Z. 3, @DR-011): öffnet den PDF-Dialog, in dem „Endstand“ vorgewählt ist. Nur für
 * Turnierleitung und Co-Admin (Recht tournamentSettings aus rolePermissions.json über useCan); Helfer sehen den Knopf nicht. Das Recht
 * bleibt nach dem Abschluss offen (`openAfterClose`): der Knopf druckt nur den gespeicherten Endstand und schreibt nichts.
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
  const canPrint = useCan('tournamentSettings', tournament.id, { openAfterClose: true });
  const [open, setOpen] = useState(false);
  if (!canPrint) {
    return null;
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Button variant="secondary" size="md" icon={<Icons.Download />} onClick={() => setOpen(true)} data-testid="final-standings-pdf">
        {t('pdfExport.open')}
      </Button>
      <PDFExportDialog isOpen={open} onClose={() => setOpen(false)} tournament={tournament} schedule={schedule} standings={standings} canCreateNotice canCreateFinal />
    </div>
  );
}
