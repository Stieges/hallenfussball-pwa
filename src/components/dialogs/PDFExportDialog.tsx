/**
 * PDF-Dialog „Als PDF“ (B-28 C8, freigegebenes Mockup, @BM-051, @BM-028, @BM-032, @BM-057, @DR-011, @DR-012, @DR-013,
 * @DR-021, @DR-026, @DR-027, @ZM-064). Ablauf: Wahl der Fassung → Bauen → Hinweis vor dem Speichern (nur wenn es etwas
 * zu melden gibt) → Speichern → „PDF gespeichert“. Der Dialog folgt den Sichtbarkeits-Schaltern des Turniers; die freie
 * Wahl „Mit Spielstand“ und „Tabellen einschließen“ gibt es nicht mehr. Nur A4 hoch.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from './Dialog';
import { InlineNotice } from '../ui/molecules';
import { cssVars } from '../../design-tokens';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing, Tournament } from '../../types/tournament';
import { stempel } from '../../lib/pdf/standText';
import { viewerUrl } from '../../lib/qr/publicQr';
import type { PdfAudience } from '../../lib/pdf/visibility';
import { ExportDialogActions } from './pdfExport/ExportDialogActions';
import { PdfFormStep } from './pdfExport/PdfFormStep';
import { PdfHintStep } from './pdfExport/PdfHintStep';
import { usePdfExport } from './pdfExport/usePdfExport';

export interface PDFExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  /** Zielgruppe des PDFs: `viewer` bietet nur „Spielplan“ ohne Ergebnisse und Tabellen (@BM-057, G47). Vorgabe: Veranstalter. */
  audience?: PdfAudience;
  /** Weg zu den Sichtbarkeits-Schaltern („Online teilen“, „Sichtbarkeit ändern“); ohne Angabe nur der Hinweistext. */
  onOpenVisibility?: () => void;
}

export const PDFExportDialog = ({ isOpen, onClose, tournament, schedule, standings, audience = 'organizer', onOpenVisibility }: PDFExportDialogProps) => {
  const { t } = useTranslation('tournament');
  const { isOnline } = useOnlineStatus();
  const viewer = audience === 'viewer';
  const { state, now, select, save, saveAnyway, reset } = usePdfExport({ tournament, schedule, standings, audience, online: isOnline });

  // Beim Öffnen beginnt jeder Dialog bei der Wahl, mit frischem Stand (ein während des Bauens geschlossener Lauf ist verworfen)
  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const close = () => {
    reset();
    onClose();
  };
  const title = state.step === 'hint' ? t('pdfExport.hints.title') : viewer ? t('pdfExport.titleViewer') : t('pdfExport.title');

  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      title={title}
      footer={
        <ExportDialogActions
          step={state.step}
          busy={state.busy}
          failed={state.failed}
          onCancel={close}
          onSave={() => void save()}
          onBack={reset}
          onSaveAnyway={saveAnyway}
          onClose={close}
        />
      }
    >
      {state.step === 'form' ? (
        <PdfFormStep
          viewer={viewer}
          choice={state.choice}
          onChoice={select}
          shared={viewerUrl(tournament) !== null}
          // Der Endstand wird mit C10 freigeschaltet, sobald A-19/A-21a den Abschluss liefern
          finalAvailable={false}
          hideScores={tournament.hideScoresForPublic}
          hideTables={tournament.hideRankingsForPublic}
          offlineStamp={isOnline ? undefined : stempel(now)}
          failed={state.failed}
          notShared={state.notShared}
          onOpenVisibility={onOpenVisibility}
        />
      ) : null}
      {state.step === 'hint' && state.pending ? <PdfHintStep hints={state.pending.hints} /> : null}
      {state.step === 'done' ? (
        <InlineNotice tone="ok" data-testid="pdf-done">
          <strong>{t('pdfExport.done.title')}</strong>
          <span style={{ overflowWrap: 'anywhere', fontWeight: cssVars.fontWeights.semibold }}>{state.savedName}</span>
        </InlineNotice>
      ) : null}
    </Dialog>
  );
};
