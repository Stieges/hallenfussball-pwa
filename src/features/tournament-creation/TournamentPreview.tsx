/**
 * TournamentPreview - Vorschau des generierten Turniers vor der Freigabe
 *
 * Zeigt:
 * - Turnier-Metadaten
 * - Generierter Spielplan mit Zeiten (ScheduleDisplay)
 * - Aktionen: "Bearbeiten" oder "Freigeben"
 */

import { CSSProperties, useState } from 'react';
import { Tournament, PlayoffConfig } from '../../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../../lib/scheduleGenerator';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { Button, Card } from '../../components/ui';
import { theme } from '../../styles/theme';
import { exportScheduleAsPDF } from '../../lib/pdfExporter';
import { PlayoffParallelConfigurator } from '../../components/PlayoffParallelConfigurator';

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

  const handlePlayoffConfigChange = (config: PlayoffConfig) => {
    const updatedTournament = { ...currentTournament, playoffConfig: config };
    setCurrentTournament(updatedTournament);

    // Regenerate schedule with new playoff config
    const newSchedule = generateFullSchedule(updatedTournament);
    setSchedule(newSchedule);

    // Notify parent if callback provided
    if (onTournamentChange) {
      onTournamentChange(updatedTournament);
    }
  };

  const handleExportPDF = async () => {
    await exportScheduleAsPDF(schedule, {
      filename: `${currentTournament.title}_Spielplan`,
      showRefereeColumn: false,
    });
  };

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
  };

  const headerStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
    padding: '32px',
    borderRadius: theme.borderRadius.lg,
    marginBottom: '24px',
    color: theme.colors.background,
  };

  const titleStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: theme.fontWeights.bold,
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
    borderTop: `1px solid ${theme.colors.border}`,
  };

  const infoGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
    fontWeight: theme.fontWeights.semibold,
  };

  return (
    <div style={containerStyle}>
      {/* Header mit Status-Badge */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span
            style={{
              padding: '6px 12px',
              background: 'rgba(255,215,0,0.9)',
              color: '#000',
              borderRadius: theme.borderRadius.sm,
              fontSize: '12px',
              fontWeight: theme.fontWeights.bold,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Entwurf - Vorschau
          </span>
        </div>
        <h1 style={titleStyle}>{currentTournament.title}</h1>
        <p style={subtitleStyle}>
          {currentTournament.ageClass} • {currentTournament.date} • {currentTournament.location}
        </p>

        {/* Turnier-Infos Grid */}
        <div style={infoGridStyle}>
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
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.primary,
              margin: '0 0 8px 0',
            }}
          >
            Generierter Spielplan
          </h2>
          <p style={{ fontSize: '14px', color: theme.colors.text.secondary, margin: 0 }}>
            Überprüfe den Spielplan und gib das Turnier frei, um es in der Übersicht sichtbar zu
            machen.
          </p>
        </div>

        {/* Playoff Configuration (if applicable) */}
        {currentTournament.groupSystem === 'groupsAndFinals' &&
         Object.values(currentTournament.finals).some(Boolean) && (
          <div style={{ marginBottom: '24px' }}>
            <PlayoffParallelConfigurator
              numberOfFields={currentTournament.numberOfFields}
              numberOfGroups={currentTournament.numberOfGroups || 2}
              finals={currentTournament.finals}
              playoffConfig={currentTournament.playoffConfig}
              onUpdate={handlePlayoffConfigChange}
            />
          </div>
        )}

        <ScheduleDisplay schedule={schedule} />

        {/* Aktionen */}
        <div style={actionsStyle}>
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
              fontWeight: theme.fontWeights.bold,
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
          borderRadius: theme.borderRadius.md,
        }}
      >
        <p
          style={{
            fontSize: '13px',
            color: theme.colors.text.secondary,
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          <strong>Hinweis:</strong> Dies ist eine Vorschau deines Turniers. Solange das Turnier
          nicht freigegeben ist, wird es nicht in der Übersicht angezeigt. Du kannst den Spielplan
          jetzt als PDF exportieren oder zurück zur Bearbeitung gehen.
        </p>
      </div>
    </div>
  );
};
