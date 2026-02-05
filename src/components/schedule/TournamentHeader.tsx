/**
 * TournamentHeader - Tournament metadata header matching MeinTurnierplan style
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, fontSizesMd3 } from '../../design-tokens'
import { GeneratedSchedule } from '../../core/generators';
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
  const { t } = useTranslation('tournament');
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const firstMatch = groupPhase?.matches[0];
  const matchDuration = firstMatch?.duration ?? 10;
  const numberOfTeams = schedule.teams.length;
  const numberOfMatches = schedule.allMatches.length;

  const containerStyle: CSSProperties = {
    marginBottom: cssVars.spacing.xl,
    borderBottom: `2px solid ${cssVars.colors.primary}`,
    paddingBottom: cssVars.spacing.lg,
  };

  const headerFlexStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizesMd3.displayMedium,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
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
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
    marginBottom: cssVars.spacing.md,
  };

  const metaGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    padding: cssVars.spacing.md,
    background: cssVars.colors.infoBannerBg,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
  };

  const metaItemStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    wordBreak: 'break-word', // Umbrechen bei langen Wörtern
  };

  const metaLabelStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.semibold,
    marginRight: cssVars.spacing.sm,
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
            <div style={{ fontSize: fontSizesMd3.statLabel, color: cssVars.colors.textSecondary, marginTop: cssVars.spacing.xs }}>
              {t('header.liveResults')}
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
            <span style={metaLabelStyle}>{t('header.organizer')}:</span>
            {schedule.tournament.organizer}
          </div>
        )}
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>{t('header.date')}:</span>
          {formatDateGerman(schedule.tournament.date)}
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>{t('header.startTime')}:</span>
          {t('header.timeValue', { time: formatTime(schedule.startTime) })}
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>{t('header.endTimeApprox')}:</span>
          {t('header.timeValue', { time: formatTime(schedule.endTime) })}
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>{t('header.matchDuration')}:</span>
          {t('header.minutesValue', { count: matchDuration })}
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>{t('header.participants')}:</span>
          {t('header.teamsValue', { count: numberOfTeams })}
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>{t('header.totalMatches')}:</span>
          {numberOfMatches}
        </div>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>{t('header.venue')}:</span>
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
