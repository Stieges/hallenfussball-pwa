/**
 * TournamentPreview - Vorschau des generierten Turniers vor der Freigabe
 *
 * Zeigt:
 * - Turnier-Metadaten
 * - Generierter Spielplan mit Zeiten (ScheduleDisplay)
 * - Aktionen: "Bearbeiten" oder "Freigeben"
 */

import { CSSProperties, useState } from 'react';
import { Tournament, FinalsConfig } from '../../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../../lib/scheduleGenerator';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';
import { Button, Card } from '../../components/ui';
import { borderRadius, colors, fontWeights } from '../../design-tokens';
import { exportScheduleToPDF } from '../../lib/pdfExporter';
import { getLocationName, getLocationAddressLine } from '../../utils/locationHelpers';

interface TournamentPreviewProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  onEdit: () => void;
  onPublish: () => void;
  onTournamentChange?: (tournament: Tournament) => void;
}

export const TournamentPreview: React.FC<TournamentPreviewProps> = ({
  tournament,
  schedule: initialSchedule,
  onEdit,
  onPublish,
  onTournamentChange,
}) => {
  const [currentTournament, setCurrentTournament] = useState(tournament);
  const [schedule, setSchedule] = useState(initialSchedule);

  const handleFinalsConfigChange = (config: FinalsConfig) => {
    const updatedTournament = { ...currentTournament, finalsConfig: config };
    setCurrentTournament(updatedTournament);

    // Regenerate schedule with new finals config
    const newSchedule = generateFullSchedule(updatedTournament);
    setSchedule(newSchedule);

    // Notify parent if callback provided
    if (onTournamentChange) {
      onTournamentChange(updatedTournament);
    }
  };

  const handleRefereeAssignment = (matchId: string, refereeNumber: number | null) => {
    const updatedTournament = { ...currentTournament };

    // Update manual assignments
    if (!updatedTournament.refereeConfig) {
      return;
    }

    const manualAssignments = { ...(updatedTournament.refereeConfig.manualAssignments || {}) };

    if (refereeNumber === null) {
      delete manualAssignments[matchId];
    } else {
      manualAssignments[matchId] = refereeNumber;
    }

    updatedTournament.refereeConfig = {
      ...updatedTournament.refereeConfig,
      manualAssignments,
    };

    setCurrentTournament(updatedTournament);

    // Regenerate schedule with new referee assignments
    const newSchedule = generateFullSchedule(updatedTournament);
    setSchedule(newSchedule);

    // Notify parent if callback provided
    if (onTournamentChange) {
      onTournamentChange(updatedTournament);
    }
  };

  const handleResetRefereeAssignments = () => {
    const updatedTournament = { ...currentTournament };

    if (updatedTournament.refereeConfig) {
      updatedTournament.refereeConfig = {
        ...updatedTournament.refereeConfig,
        manualAssignments: {},
      };

      setCurrentTournament(updatedTournament);

      // Regenerate schedule with automatic assignments
      const newSchedule = generateFullSchedule(updatedTournament);
      setSchedule(newSchedule);

      // Notify parent if callback provided
      if (onTournamentChange) {
        onTournamentChange(updatedTournament);
      }
    }
  };

  const handleFieldChange = (matchId: string, fieldNumber: number) => {
    const updatedTournament = { ...currentTournament };

    // Update field assignments
    if (!updatedTournament.fieldAssignments) {
      updatedTournament.fieldAssignments = {};
    }

    updatedTournament.fieldAssignments[matchId] = fieldNumber;

    setCurrentTournament(updatedTournament);

    // Regenerate schedule with new field assignments
    const newSchedule = generateFullSchedule(updatedTournament);
    setSchedule(newSchedule);

    // Notify parent if callback provided
    if (onTournamentChange) {
      onTournamentChange(updatedTournament);
    }
  };

  const handleExportPDF = async () => {
    await exportScheduleToPDF(schedule, schedule.initialStandings, {
      locale: 'de',
      includeStandings: true,
      // organizerName wird automatisch aus schedule.tournament.organizer gezogen
      hallName: getLocationName(currentTournament),
    });
  };

  const containerStyle: CSSProperties = {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '24px',
  };

  const headerStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
    padding: '32px',
    borderRadius: borderRadius.lg,
    marginBottom: '24px',
    color: colors.background,
  };

  const titleStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: fontWeights.bold,
    margin: '0 0 8px 0',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: '16px',
    opacity: 0.9,
    margin: 0,
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: `1px solid ${colors.border}`,
    flexWrap: 'wrap',
  };

  const infoGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginTop: '16px',
  };

  const infoItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const labelStyle: CSSProperties = {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.7,
  };

  const valueStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: fontWeights.semibold,
  };

  return (
    <div style={containerStyle} className="tournament-preview-container">
      {/* Header mit Status-Badge */}
      <div style={headerStyle} className="tournament-preview-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span
            style={{
              padding: '6px 12px',
              background: 'rgba(255,215,0,0.9)',
              color: '#000',
              borderRadius: borderRadius.sm,
              fontSize: '12px',
              fontWeight: fontWeights.bold,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Entwurf - Vorschau
          </span>
        </div>
        <h1 style={titleStyle}>{currentTournament.title}</h1>
        <p style={subtitleStyle}>
          {currentTournament.ageClass} • {currentTournament.date} • {getLocationName(currentTournament)}
        </p>
        {getLocationAddressLine(currentTournament) && (
          <p style={{ ...subtitleStyle, fontSize: '14px', marginTop: '4px', opacity: 0.8 }}>
            {getLocationAddressLine(currentTournament)}
          </p>
        )}

        {/* Turnier-Infos Grid */}
        <div style={infoGridStyle} className="tournament-info-grid">
          <div style={infoItemStyle}>
            <span style={labelStyle}>Sportart</span>
            <span style={valueStyle}>
              {currentTournament.sport === 'football' ? 'Fußball' : 'Andere'}
            </span>
          </div>
          <div style={infoItemStyle}>
            <span style={labelStyle}>Modus</span>
            <span style={valueStyle}>
              {currentTournament.groupSystem === 'roundRobin' ? 'Jeder gegen Jeden' : 'Gruppen + Finale'}
            </span>
          </div>
          <div style={infoItemStyle}>
            <span style={labelStyle}>Teams</span>
            <span style={valueStyle}>{currentTournament.teams.length}</span>
          </div>
          <div style={infoItemStyle}>
            <span style={labelStyle}>Spiele</span>
            <span style={valueStyle}>{schedule.allMatches.length}</span>
          </div>
          <div style={infoItemStyle}>
            <span style={labelStyle}>Start</span>
            <span style={valueStyle}>{currentTournament.timeSlot}</span>
          </div>
          <div style={infoItemStyle}>
            <span style={labelStyle}>Spieldauer</span>
            <span style={valueStyle}>{currentTournament.groupPhaseGameDuration} Min.</span>
          </div>
        </div>
      </div>

      {/* Spielplan-Vorschau */}
      <Card>
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: fontWeights.semibold,
              color: colors.primary,
              margin: '0 0 8px 0',
            }}
          >
            Generierter Spielplan
          </h2>
          <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>
            Überprüfe den Spielplan und gib das Turnier frei, um es in der Übersicht sichtbar zu
            machen.
          </p>
        </div>

        {/* Finals Configuration (if applicable) */}
        {currentTournament.groupSystem === 'groupsAndFinals' &&
         currentTournament.finalsConfig?.preset &&
         currentTournament.finalsConfig.preset !== 'none' && (
          <div className="finals-config-box" style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,215,0,0.08)', borderRadius: borderRadius.md, border: '1px solid rgba(255,215,0,0.2)' }}>
            <h3 style={{ color: colors.accent, fontSize: '14px', margin: '0 0 12px 0', fontWeight: fontWeights.semibold }}>
              Finalrunden-Einstellungen
            </h3>
            <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '0 0 12px 0' }}>
              Preset: <strong>{
                currentTournament.finalsConfig.preset === 'final-only' ? 'Nur Finale' :
                currentTournament.finalsConfig.preset === 'top-4' ? 'Top 4 (Halbfinale + Finale)' :
                currentTournament.finalsConfig.preset === 'top-8' ? 'Top 8 (mit Viertelfinale)' :
                currentTournament.finalsConfig.preset === 'all-places' ? 'Alle Plätze' :
                currentTournament.finalsConfig.preset
              }</strong>
            </p>

            {/* Warnung: Top-8 benötigt mindestens 4 Gruppen */}
            {currentTournament.finalsConfig.preset === 'top-8' && (currentTournament.numberOfGroups || 2) < 4 && (
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(255,165,0,0.12)', borderRadius: borderRadius.sm, border: '1px solid rgba(255,165,0,0.3)' }}>
                <p style={{ fontSize: '11px', color: colors.textPrimary, margin: 0, lineHeight: '1.5' }}>
                  ⚠️ <strong>Hinweis:</strong> Top-8 mit Viertelfinale benötigt mindestens 4 Gruppen (8 Teams).
                  Mit {currentTournament.numberOfGroups || 2} Gruppen wird automatisch Top-4 (Halbfinale) verwendet.
                </p>
              </div>
            )}

            {/* Info: Alle Plätze */}
            {currentTournament.finalsConfig.preset === 'all-places' && (
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(0,176,255,0.12)', borderRadius: borderRadius.sm, border: '1px solid rgba(0,176,255,0.3)' }}>
                <p style={{ fontSize: '11px', color: colors.textPrimary, margin: 0, lineHeight: '1.5' }}>
                  ℹ️ <strong>Info:</strong> Es werden alle möglichen Platzierungen ausgespielt.
                  {(currentTournament.numberOfGroups || 2) === 2 && ' Bei 2 Gruppen: Halbfinale + Plätze 3, 5 und 7.'}
                  {(currentTournament.numberOfGroups || 2) >= 4 && ' Bei 4+ Gruppen: Viertelfinale + alle Platzierungen.'}
                </p>
              </div>
            )}

            {['top-4', 'top-8', 'all-places'].includes(currentTournament.finalsConfig.preset) && currentTournament.numberOfFields > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={currentTournament.finalsConfig.parallelSemifinals ?? true}
                    onChange={(e) => {
                      handleFinalsConfigChange({
                        ...currentTournament.finalsConfig!,
                        parallelSemifinals: e.target.checked,
                      });
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.accent }}
                  />
                  <span style={{ color: colors.textPrimary, fontSize: '13px' }}>
                    Halbfinale gleichzeitig austragen
                  </span>
                </label>

                {['top-8', 'all-places'].includes(currentTournament.finalsConfig.preset) && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={currentTournament.finalsConfig.parallelQuarterfinals ?? true}
                      onChange={(e) => {
                        handleFinalsConfigChange({
                          ...currentTournament.finalsConfig!,
                          parallelQuarterfinals: e.target.checked,
                        });
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.accent }}
                    />
                    <span style={{ color: colors.textPrimary, fontSize: '13px' }}>
                      Viertelfinale gleichzeitig austragen
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        <ScheduleDisplay
          schedule={schedule}
          editable={true}
          onRefereeChange={handleRefereeAssignment}
          onFieldChange={handleFieldChange}
        />

        {/* Manuelle SR-Zuweisung (wenn SR aktiv) */}
        {currentTournament.refereeConfig && currentTournament.refereeConfig.mode !== 'none' && (
          <RefereeAssignmentEditor
            matches={schedule.allMatches}
            refereeConfig={currentTournament.refereeConfig}
            onAssignmentChange={handleRefereeAssignment}
            onResetAssignments={handleResetRefereeAssignments}
          />
        )}

        {/* Aktionen */}
        <div style={actionsStyle} className="tournament-actions">
          <Button variant="secondary" onClick={onEdit}>
            Bearbeiten
          </Button>
          <Button variant="secondary" onClick={handleExportPDF}>
            PDF Exportieren
          </Button>
          <Button
            variant="primary"
            onClick={onPublish}
            style={{
              fontSize: '16px',
              padding: '14px 32px',
              fontWeight: fontWeights.bold,
            }}
          >
            Turnier freigeben
          </Button>
        </div>
      </Card>

      {/* Info-Box */}
      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          background: 'rgba(0,176,255,0.08)',
          border: '1px solid rgba(0,176,255,0.2)',
          borderRadius: borderRadius.md,
        }}
      >
        <p
          style={{
            fontSize: '13px',
            color: colors.textSecondary,
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          <strong>Hinweis:</strong> Dies ist eine Vorschau deines Turniers. Solange das Turnier
          nicht freigegeben ist, wird es nicht in der Übersicht angezeigt. Du kannst den Spielplan
          jetzt als PDF exportieren oder zurück zur Bearbeitung gehen.
        </p>
      </div>

      {/* Mobile-first responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          /* Container padding for mobile */
          .tournament-preview-container {
            padding: 16px 12px !important;
          }

          /* Header adjustments for mobile */
          .tournament-preview-header {
            padding: 24px 16px !important;
            border-radius: ${borderRadius.md} !important;
          }

          .tournament-preview-header h1 {
            font-size: 22px !important;
          }

          .tournament-preview-header p {
            font-size: 14px !important;
          }

          /* Info grid - stack on mobile */
          .tournament-info-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }

          /* Action buttons - full width on mobile */
          .tournament-actions {
            flex-direction: column !important;
            gap: 12px !important;
          }

          .tournament-actions button {
            width: 100% !important;
            min-height: 48px !important;
            font-size: 16px !important;
          }

          /* Finals config box */
          .finals-config-box {
            padding: 12px !important;
          }

          .finals-config-box h3 {
            font-size: 13px !important;
          }

          .finals-config-box p {
            font-size: 12px !important;
          }

          .finals-config-box label {
            font-size: 12px !important;
          }

          .finals-config-box input[type="checkbox"] {
            min-width: 20px !important;
            min-height: 20px !important;
          }
        }

        @media (max-width: 480px) {
          /* Extra small screens */
          .tournament-preview-container {
            padding: 12px 8px !important;
          }

          .tournament-preview-header {
            padding: 20px 12px !important;
          }

          .tournament-preview-header h1 {
            font-size: 20px !important;
          }

          .tournament-preview-header p {
            font-size: 13px !important;
          }

          /* Stack info grid vertically on very small screens */
          .tournament-info-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
