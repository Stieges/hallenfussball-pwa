/**
 * TournamentHeader - Tournament metadata header matching MeinTurnierplan style
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontWeights } from '../../design-tokens';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { getFullLocationAddress, formatDateGerman } from '../../utils/locationHelpers';

interface TournamentHeaderProps {
  schedule: GeneratedSchedule;
  logoUrl?: string;
  qrCodeUrl?: string;
}

export const TournamentHeader: React.FC<TournamentHeaderProps> = ({
  schedule,
  logoUrl,
  qrCodeUrl,
}) => {
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const firstMatch = groupPhase?.matches[0];
  const matchDuration = firstMatch?.duration || 10;
  const numberOfTeams = schedule.teams.length;
  const numberOfMatches = schedule.allMatches.length;

  const containerStyle: CSSProperties = {
    marginBottom: '32px',
    borderBottom: `2px solid ${colors.primary}`,
    paddingBottom: '24px',
  };

  const headerFlexStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: fontWeights.bold,
    color: colors.primary,
    margin: 0,
    textAlign: 'center',
    flex: 1,
  };

  const logoStyle: CSSProperties = {
    width: '60px',
    height: '60px',
    objectFit: 'contain',
  };

  const qrCodeStyle: CSSProperties = {
    width: '60px',
    height: '60px',
    objectFit: 'contain',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: '14px',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: '16px',
  };

  const metaGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    padding: '16px',
    background: 'rgba(37, 99, 235, 0.05)',
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
  };

  const metaItemStyle: CSSProperties = {
    fontSize: '13px',
    color: colors.textPrimary,
    wordBreak: 'break-word', // Umbrechen bei langen Wörtern
  };

  const metaLabelStyle: CSSProperties = {
    fontWeight: fontWeights.semibold,
    marginRight: '8px',
  };

  return (
    <div style={containerStyle} className="tournament-header">
      <div style={headerFlexStyle}>
        {logoUrl && (
          <img src={logoUrl} alt="Logo" style={logoStyle} />
        )}
        <h1 style={titleStyle}>{schedule.tournament.title}</h1>
        {qrCodeUrl && (
          <div style={{ textAlign: 'center' }}>
            <img src={qrCodeUrl} alt="QR Code" style={qrCodeStyle} />
            <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '4px' }}>
              Live Ergebnisse
            </div>
          </div>
        )}
      </div>

      <div style={subtitleStyle}>
        {schedule.tournament.ageClass} • {formatDateGerman(schedule.tournament.date)}
      </div>

      <div style={metaGridStyle}>
        {schedule.tournament.organizer && (
          <div style={metaItemStyle}>
            <span style={metaLabelStyle}>Veranstalter:</span>
            {schedule.tournament.organizer}
          </div>
        )}
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Datum:</span>
          {formatDateGerman(schedule.tournament.date)}
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Beginn:</span>
          {formatTime(schedule.startTime)} Uhr
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Ende (ca.):</span>
          {formatTime(schedule.endTime)} Uhr
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Spieldauer:</span>
          {matchDuration} Minuten
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Teilnehmer:</span>
          {numberOfTeams} Teams
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Spiele gesamt:</span>
          {numberOfMatches}
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>Veranstaltungsort:</span>
          {getFullLocationAddress(schedule.tournament)}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .tournament-header h1 {
            font-size: 24px !important;
          }
        }

        @media print {
          .tournament-header {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
