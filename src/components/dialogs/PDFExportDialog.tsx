/**
 * PDF-Dialog „Als PDF“ (B-28 C8, freigegebenes Mockup, @BM-051, @BM-028, @BM-032, @BM-057, @DR-011, @DR-012, @DR-013,
 * @DR-021, @DR-026, @DR-027, @ZM-064; Endstand nach dem Abschluss: @DR-009, @DR-011, @DR-048, @DR-049, @BM-041). Ablauf: Wahl der Fassung → Bauen → Hinweis vor dem Speichern (nur wenn es etwas
 * zu melden gibt) → Speichern → „PDF gespeichert“. Der Dialog folgt den Sichtbarkeits-Schaltern des Turniers; die freie
 * Wahl „Mit Spielstand“ und „Tabellen einschließen“ gibt es nicht mehr. Nur A4 hoch.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from './Dialog';
import { InlineNotice } from '../ui/molecules';
import { cssVars } from '../../design-tokens';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { tournamentGraphicsStore } from '../../core/storage/tournamentGraphicsStore';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing, Tournament } from '../../types/tournament';
import { stempel } from '../../lib/pdf/standText';
import { viewerUrl } from '../../lib/qr/publicQr';
import type { PdfAudience } from '../../lib/pdf/visibility';
import { ExportDialogActions } from './pdfExport/ExportDialogActions';
import { PdfFormStep } from './pdfExport/PdfFormStep';
import { PdfHintStep } from './pdfExport/PdfHintStep';
import { usePdfExport } from './pdfExport/usePdfExport';
import type { PdfChoice } from './pdfExport/buildChoice';
import { isFinished, type FinalPdfSource } from './pdfExport/finalPdfSource';
import { choiceAvailable, pdfOffers, preferredChoice } from './pdfExport/pdfOffers';
import { useStoredFinalPdfSource } from './pdfExport/useStoredFinalPdfSource';

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
  /** A-11 @ZM-019: „Aushang mit QR-Code“ anbieten (Recht tournamentSettings, vom Aufrufer über useCan). Vorgabe: nein. */
  canCreateNotice?: boolean;
  /**
   * @DR-048 „Endstand“ anbieten: nur Turnierleitung und Co-Admin (Recht tournamentSettings, nach dem Abschluss offen; der Aufrufer
   * fragt useCan mit `openAfterClose`). Helfer sehen die Karte nicht. Vorgabe: nein (jeder Aufrufer gibt es ausdrücklich an).
   */
  canCreateFinal?: boolean;
  /** Zuschauer (@BM-041): der Endstand der Zuschauer-Seite (`publicFinalSource`); ohne Angabe gibt es keinen. */
  viewerFinal?: FinalPdfSource;
}

export const PDFExportDialog = ({ isOpen, onClose, tournament, schedule, standings, audience = 'organizer', onOpenVisibility, canCreateNotice = false, canCreateFinal = false, viewerFinal }: PDFExportDialogProps) => {
  const { t } = useTranslation('tournament');
  const { isOnline } = useOnlineStatus();
  const viewer = audience === 'viewer';
  // Gespeicherter Endstand (@ET-045): Turnierleitung und Helfer lesen ihn beim Öffnen, Zuschauer bekommen ihn von der Zuschauer-Seite
  const storedFinal = useStoredFinalPdfSource(tournament, isOpen && !viewer);
  const final: FinalPdfSource = viewer ? (viewerFinal ?? { kind: 'open' }) : storedFinal;
  const shared = viewerUrl(tournament) !== null;
  const offers = pdfOffers({
    viewer, finished: isFinished(tournament), final, canFinal: canCreateFinal, canNotice: canCreateNotice, shared,
    hideScores: tournament.hideScoresForPublic, hideTables: tournament.hideRankingsForPublic,
  });
  // Grafiken dieses Geräts (@W3-030): bei jedem Speichern frisch aus dem Gerätespeicher gelesen (usePdfExport); ohne Eintrag geht es ohne Logo weiter (@DR-024)
  const loadGraphics = useCallback(() => tournamentGraphicsStore.load(tournament.id), [tournament.id]);
  const finalData = final.kind === 'ready' ? { ranking: final.ranking, closedAt: final.closedAt } : undefined;
  const { state, now, select, save, saveAnyway, reset } = usePdfExport({ tournament, schedule, standings, audience, online: isOnline, loadGraphics, final: finalData });

  // Beim Öffnen beginnt jeder Dialog bei der Wahl, mit frischem Stand (ein während des Bauens geschlossener Lauf ist verworfen)
  const [picked, setPicked] = useState<PdfChoice | null>(null);
  useEffect(() => {
    if (isOpen) {
      setPicked(null);
      reset();
    }
  }, [isOpen, reset]);
  // Vorwahl (@DR-048 Z. 2): nach dem Abschluss „Endstand“, sobald der gespeicherte Endstand gelesen ist; eine eigene Wahl gilt,
  // solange sie wählbar ist. Gerechnet im Zeichnen, damit Anzeige und Speichern nie auseinanderlaufen.
  const shown: PdfChoice = picked !== null && choiceAvailable(offers, picked) ? picked : preferredChoice(offers);
  const choose = (choice: PdfChoice): void => {
    setPicked(choice);
    select(choice);
  };

  const close = () => {
    reset();
    onClose();
  };
  const title = state.step === 'hint' ? t('pdfExport.hints.title') : viewer && offers.final === null ? t('pdfExport.titleViewer') : t('pdfExport.title');

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
          saveDisabled={!choiceAvailable(offers, shown)}
          onSave={() => void save(shown)}
          onBack={reset}
          onSaveAnyway={saveAnyway}
          onClose={close}
        />
      }
    >
      {state.step === 'form' ? (
        <PdfFormStep
          viewer={viewer}
          choice={shown}
          onChoice={choose}
          shared={shared}
          offers={offers}
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
