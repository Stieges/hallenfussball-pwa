import { useState, CSSProperties } from 'react';
import { Button } from './ui/Button';
import { Icons } from './ui/Icons';
import { ShareDialog } from './dialogs/ShareDialog';
import { PDFExportDialog } from './dialogs/PDFExportDialog';
import { theme } from '../styles/theme';
import { Tournament, Standing } from '../types/tournament';
import { GeneratedSchedule } from '../lib/scheduleGenerator';

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
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPDFDialog, setShowPDFDialog] = useState(false);

  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  };

  // Responsive styles for mobile FAB buttons
  const fabContainerStyle: CSSProperties = {
    position: 'fixed',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    zIndex: 100,
  };

  const isMobile = variant === 'public'; // Public view uses FAB style on mobile

  return (
    <>
      {/* Action Buttons */}
      <div
        style={isMobile ? fabContainerStyle : containerStyle}
        className="schedule-action-buttons"
      >
        <Button
          variant="secondary"
          size="md"
          icon={<Icons.Share />}
          onClick={() => setShowShareDialog(true)}
        >
          Teilen
        </Button>

        <Button
          variant="secondary"
          size="md"
          icon={<Icons.Download />}
          onClick={() => setShowPDFDialog(true)}
        >
          Als PDF
        </Button>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        tournamentId={tournament.id}
        tournamentTitle={tournament.title}
      />

      {/* PDF Export Dialog */}
      <PDFExportDialog
        isOpen={showPDFDialog}
        onClose={() => setShowPDFDialog(false)}
        tournament={tournament}
        schedule={schedule}
        standings={standings}
      />

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 767px) {
          .schedule-action-buttons {
            position: fixed !important;
            bottom: ${theme.spacing.lg} !important;
            right: ${theme.spacing.lg} !important;
            flex-direction: column !important;
            z-index: 100 !important;
          }

          .schedule-action-buttons button {
            min-width: 120px;
            box-shadow: ${theme.shadows.lg};
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
