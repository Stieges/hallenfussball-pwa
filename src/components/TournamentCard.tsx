/**
 * TournamentCard Component
 *
 * Displays tournament summary in dashboard:
 * - Titel
 * - Datum (Beginn)
 * - Ort
 * - Altersklasse
 */

import { CSSProperties } from 'react';
import { Tournament } from '../types/tournament';
import { Card } from './ui';
import { theme } from '../styles/theme';
import { getLocationName } from '../utils/locationHelpers';
import { formatTournamentDate } from '../utils/tournamentCategories';

interface TournamentCardProps {
  tournament: Tournament;
  onClick?: () => void;
  categoryLabel?: string; // Optional: "Läuft", "Bevorstehend", etc.
  onDelete?: () => void; // Optional: Delete callback
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onClick,
  categoryLabel,
  onDelete,
}) => {
  const cardStyle: CSSProperties = {
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    border: `1px solid ${theme.colors.border}`,
    position: 'relative',
  };

  const cardHoverStyle: CSSProperties = {
    ...cardStyle,
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    margin: 0,
    flex: 1,
  };

  const badgeStyle: CSSProperties = {
    padding: '4px 10px',
    borderRadius: theme.borderRadius.sm,
    fontSize: '11px',
    fontWeight: theme.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginLeft: '12px',
  };

  const getBadgeColor = () => {
    if (tournament.status === 'draft') {
      return {
        background: 'rgba(255,165,0,0.15)',
        color: '#ff8c00',
      };
    }
    switch (categoryLabel) {
      case 'Läuft':
        return {
          background: 'rgba(0,176,255,0.15)',
          color: '#00b0ff',
        };
      case 'Bevorstehend':
        return {
          background: 'rgba(76,175,80,0.15)',
          color: '#4caf50',
        };
      case 'Beendet':
        return {
          background: 'rgba(158,158,158,0.15)',
          color: '#9e9e9e',
        };
      default:
        return {
          background: 'rgba(0,0,0,0.05)',
          color: theme.colors.text.secondary,
        };
    }
  };

  const infoGridStyle: CSSProperties = {
    display: 'grid',
    gap: '12px',
  };

  const infoItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const labelStyle: CSSProperties = {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeights.medium,
  };

  const valueStyle: CSSProperties = {
    fontSize: '14px',
    color: theme.colors.text.primary,
    fontWeight: theme.fontWeights.medium,
  };

  const deleteButtonStyle: CSSProperties = {
    marginTop: '12px',
    width: '100%',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.sm,
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: theme.fontWeights.bold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  };

  const badgeColors = getBadgeColor();

  return (
    <Card
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          Object.assign(e.currentTarget.style, cardHoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          Object.assign(e.currentTarget.style, cardStyle);
        }
      }}
    >
      <div style={headerStyle}>
        <h3 style={titleStyle}>{tournament.title}</h3>
        {categoryLabel && (
          <span style={{ ...badgeStyle, ...badgeColors }}>{categoryLabel}</span>
        )}
      </div>

      <div style={infoGridStyle}>
        <div style={infoItemStyle}>
          <span style={labelStyle}>Datum & Uhrzeit</span>
          <span style={valueStyle}>{formatTournamentDate(tournament)}</span>
        </div>

        <div style={infoItemStyle}>
          <span style={labelStyle}>Ort</span>
          <span style={valueStyle}>{getLocationName(tournament)}</span>
        </div>

        <div style={infoItemStyle}>
          <span style={labelStyle}>Altersklasse</span>
          <span style={valueStyle}>{tournament.ageClass}</span>
        </div>

        {tournament.status === 'draft' && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 12px',
              background: 'rgba(255,165,0,0.08)',
              borderRadius: theme.borderRadius.sm,
              fontSize: '12px',
              color: theme.colors.text.secondary,
            }}
          >
            Entwurf - Noch nicht veröffentlicht
          </div>
        )}
      </div>

      {/* Delete Button - Only show if onDelete is provided - At the bottom */}
      {onDelete && (
        <button
          style={deleteButtonStyle}
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click
            onDelete();
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#dc2626';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ef4444';
          }}
          title="Turnier löschen"
        >
          <span>🗑️</span>
          <span>Löschen</span>
        </button>
      )}
    </Card>
  );
};
