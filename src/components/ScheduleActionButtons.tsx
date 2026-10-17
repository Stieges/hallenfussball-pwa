import { useEffect, useRef, useState, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';
import { Icons } from './ui/Icons';
import { ShareDialog } from './dialogs/ShareDialog';
import { PDFExportDialog } from './dialogs/PDFExportDialog';
import { cssVars, mediaQueries, layoutHeights } from '../design-tokens'
import { Tournament, Standing } from '../types/tournament';
import { GeneratedSchedule } from '../core/generators';

export interface ScheduleActionButtonsProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  variant?: 'organizer' | 'public';
}

export const ScheduleActionButtons = ({
  tournament,
  schedule,
  standings,
  variant = 'organizer',
}: ScheduleActionButtonsProps) => {
  const { t } = useTranslation('tournament');
  const navigate = useNavigate();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPDFDialog, setShowPDFDialog] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Die Höhe der Leiste steht als CSS-Variable bereit; die Spielplan-Karte reserviert damit den Platz unten (ScheduleTab)
  useEffect(() => {
    const leiste = barRef.current;
    if (variant !== 'organizer' || !leiste || typeof ResizeObserver === 'undefined') { return; }
    const wurzel = document.documentElement;
    const beobachter = new ResizeObserver(() => wurzel.style.setProperty('--schedule-action-bar-h', `${leiste.offsetHeight}px`));
    beobachter.observe(leiste);
    return () => {
      beobachter.disconnect();
      wurzel.style.removeProperty('--schedule-action-bar-h');
    };
  }, [variant]);

  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
  };

  // Responsive styles for mobile FAB buttons - positioned above bottom nav
  const fabContainerStyle: CSSProperties = {
    position: 'fixed',
    bottom: `calc(${layoutHeights.bottomNav} + ${cssVars.spacing.lg} + env(safe-area-inset-bottom, 0px))`,
    right: cssVars.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
    zIndex: 100,
  };

  const isMobile = variant === 'public'; // Public view uses FAB style on mobile
  // Über die alte Zuschauer-Adresse gibt es kein PDF (@BM-057); das PDF der Zuschauer-Seite kommt über `PublicPdfButton`
  const withPdf = variant === 'organizer';

  return (
    <>
      {/* Action Buttons */}
      <div
        ref={barRef}
        style={isMobile ? fabContainerStyle : containerStyle}
        className="schedule-action-buttons"
      >
        <Button
          variant="secondary"
          size="md"
          icon={<Icons.Share />}
          onClick={() => setShowShareDialog(true)}
        >
          {t('scheduleActions.share')}
        </Button>

        {withPdf ? (
          <Button
            variant="secondary"
            size="md"
            icon={<Icons.Download />}
            onClick={() => setShowPDFDialog(true)}
            data-testid="schedule-action-pdf"
          >
            {t('pdfExport.open')}
          </Button>
        ) : null}
      </div>

      {/* Share Dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        tournamentId={tournament.id}
        tournamentTitle={tournament.title}
        shareCode={tournament.shareCode}
        isPublic={tournament.isPublic}
      />

      {/* PDF-Dialog (Veranstalter); die Wege „Online teilen“ und „Sichtbarkeit ändern“ führen zu den Schaltern der Verwaltung */}
      {withPdf ? (
        <PDFExportDialog
          isOpen={showPDFDialog}
          onClose={() => setShowPDFDialog(false)}
          tournament={tournament}
          schedule={schedule}
          standings={standings}
          onOpenVisibility={() => {
            setShowPDFDialog(false);
            void navigate(`/tournament/${tournament.id}/admin/visibility`);
          }}
        />
      ) : null}

      {/* Responsive Styles */}
      <style>{`
        ${mediaQueries.tabletDown} {
          .schedule-action-buttons {
            position: fixed !important;
            bottom: calc(${layoutHeights.bottomNav} + ${cssVars.spacing.lg} + env(safe-area-inset-bottom, 0px)) !important;
            right: ${cssVars.spacing.lg} !important;
            flex-direction: column !important;
            z-index: 100 !important;
          }

          .schedule-action-buttons button {
            min-width: 120px;
            box-shadow: ${cssVars.shadows.lg};
          }
        }

        @media (min-width: 768px) {
          .schedule-action-buttons {
            ${variant === 'organizer' ? '' : 'justify-content: flex-end;'}
          }
        }
      `}</style>
    </>
  );
};
