import { useState, CSSProperties } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../ui/Button';
import { theme } from '../../styles/theme';
import { exportScheduleToPDF } from '../../lib/pdfExporter';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { Standing, Tournament } from '../../types/tournament';
import { getLocationName } from '../../utils/locationHelpers';

export interface PDFExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
}

export const PDFExportDialog = ({
  isOpen,
  onClose,
  tournament,
  schedule,
  standings,
}: PDFExportDialogProps) => {
  // Default: Include scores if any match has scores
  const hasScores = schedule.allMatches.some(m => m.scoreA !== undefined || m.scoreB !== undefined);
  const [includeScores, setIncludeScores] = useState(hasScores);
  const [includeStandings, setIncludeStandings] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  const handleExport = async () => {
    setIsGenerating(true);
    setError('');

    try {
      // Merge current scores from tournament.matches into schedule
      const updatedSchedule = {
        ...schedule,
        allMatches: schedule.allMatches.map(sm => {
          const tournamentMatch = tournament.matches.find(tm => tm.id === sm.id);
          if (tournamentMatch) {
            return {
              ...sm,
              scoreA: tournamentMatch.scoreA,
              scoreB: tournamentMatch.scoreB,
            };
          }
          return sm;
        }),
        phases: schedule.phases.map(phase => ({
          ...phase,
          matches: phase.matches.map(sm => {
            const tournamentMatch = tournament.matches.find(tm => tm.id === sm.id);
            if (tournamentMatch) {
              return {
                ...sm,
                scoreA: tournamentMatch.scoreA,
                scoreB: tournamentMatch.scoreB,
              };
            }
            return sm;
          }),
        })),
      };

      await exportScheduleToPDF(updatedSchedule, includeStandings ? standings : undefined, {
        locale: 'de',
        includeScores,
        includeStandings,
        // Only pass organizerName if it has a value, otherwise let pdfExporter use the fallback
        ...(tournament.organizer?.trim() ? { organizerName: tournament.organizer } : {}),
        hallName: getLocationName(tournament),
      });

      // Success - close dialog after short delay
      setTimeout(() => {
        onClose();
        setIsGenerating(false);
      }, 500);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError('Fehler beim Exportieren des PDFs. Bitte versuchen Sie es erneut.');
      setIsGenerating(false);
    }
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  };

  const optionsSectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  };

  const radioGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  };

  const labelStyle: CSSProperties = {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeights.medium,
    marginBottom: theme.spacing.sm,
  };

  const radioOptionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const radioInputStyle: CSSProperties = {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: theme.colors.primary,
  };

  const radioLabelTextStyle: CSSProperties = {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    flex: 1,
  };

  const radioDescStyle: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted,
    marginTop: theme.spacing.xs,
  };

  const checkboxSectionStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
  };

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    gap: theme.spacing.md,
  };

  const errorStyle: CSSProperties = {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    background: 'rgba(255, 82, 82, 0.1)',
    border: `1px solid ${theme.colors.error}`,
    color: theme.colors.error,
    fontSize: theme.fontSizes.sm,
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Als PDF exportieren" maxWidth="500px">
      <div style={containerStyle}>
        {/* Options Section */}
        <div style={optionsSectionStyle}>
          {/* Score Options */}
          <div>
            <div style={labelStyle}>Spielstände:</div>
            <div style={radioGroupStyle}>
              <label
                style={{
                  ...radioOptionStyle,
                  borderColor: includeScores ? theme.colors.primary : theme.colors.border,
                  background: includeScores ? 'rgba(0, 230, 118, 0.05)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="scoreOption"
                  checked={includeScores}
                  onChange={() => setIncludeScores(true)}
                  style={radioInputStyle}
                />
                <div style={radioLabelTextStyle}>
                  <div>Mit Spielstand</div>
                  <div style={radioDescStyle}>Zeigt aktuelle Ergebnisse im PDF</div>
                </div>
              </label>

              <label
                style={{
                  ...radioOptionStyle,
                  borderColor: !includeScores ? theme.colors.primary : theme.colors.border,
                  background: !includeScores ? 'rgba(0, 230, 118, 0.05)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="scoreOption"
                  checked={!includeScores}
                  onChange={() => setIncludeScores(false)}
                  style={radioInputStyle}
                />
                <div style={radioLabelTextStyle}>
                  <div>Ohne Spielstand</div>
                  <div style={radioDescStyle}>Leere Felder zum manuellen Ausfüllen</div>
                </div>
              </label>
            </div>
          </div>

          {/* Standings Checkbox */}
          <label
            style={{
              ...checkboxSectionStyle,
              borderColor: includeStandings ? theme.colors.primary : theme.colors.border,
              background: includeStandings ? 'rgba(0, 230, 118, 0.05)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={includeStandings}
              onChange={(e) => setIncludeStandings(e.target.checked)}
              style={radioInputStyle}
            />
            <div style={radioLabelTextStyle}>
              <div>Tabellen einschließen</div>
              <div style={radioDescStyle}>Zeigt Gruppen-Tabellen im PDF</div>
            </div>
          </label>
        </div>

        {/* Error Message */}
        {error && <div style={errorStyle}>{error}</div>}

        {/* Action Buttons */}
        <div style={buttonGroupStyle}>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isGenerating}
            fullWidth
          >
            Abbrechen
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleExport}
            disabled={isGenerating}
            fullWidth
          >
            {isGenerating ? 'Wird exportiert...' : 'Exportieren'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
