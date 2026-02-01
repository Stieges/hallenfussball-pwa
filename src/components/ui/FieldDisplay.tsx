import React, { CSSProperties } from 'react';
import { TournamentField, Tournament } from '../../types/tournament';
import { getFieldDisplayName, getFieldShortCode } from '../../utils/displayNames';
import { cssVars } from '../../design-tokens'
export type FieldDisplayVariant = 'full' | 'badge' | 'short';

interface FieldDisplayProps {
  /** Feld als TournamentField-Objekt, Feld-Nummer oder Feld-ID */
  field: TournamentField | number | string;
  /** Tournament für Lookup */
  tournament?: Tournament;
  /** Anzeigevariante: full = "Halle Nord", badge = farbiges Badge, short = nur Kürzel */
  variant?: FieldDisplayVariant;
  /** Custom Styles */
  style?: CSSProperties;
  /** CSS Klasse */
  className?: string;
}

/**
 * US-GROUPS-AND-FIELDS: Gekapselte Komponente für Feldanzeige
 *
 * Zeigt Feldnamen konsistent überall in der App:
 * - Wizard
 * - Spielplan
 * - Live-Anzeige
 * - PDF-Export
 *
 * Akzeptiert TournamentField-Objekte, Feld-Nummern (1, 2, 3) oder Feld-IDs ('field-1')
 * für einfache Migration bestehender Stellen.
 */
export const FieldDisplay: React.FC<FieldDisplayProps> = ({
  field,
  tournament,
  variant = 'full',
  style,
  className,
}) => {
  const displayName = getFieldDisplayName(field, tournament);
  const shortCode = getFieldShortCode(field, tournament);

  switch (variant) {
    case 'short':
      return (
        <span style={style} className={className}>
          {shortCode}
        </span>
      );

    case 'badge':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
            borderRadius: cssVars.borderRadius.sm,
            backgroundColor: cssVars.colors.accentLight,
            color: cssVars.colors.accent,
            fontSize: cssVars.fontSizes.sm,
            fontWeight: 600,
            minWidth: '2rem',
            ...style,
          }}
          className={className}
        >
          {shortCode}
        </span>
      );

    default: // 'full'
      return (
        <span style={style} className={className}>
          {displayName}
        </span>
      );
  }
};

export default FieldDisplay;
