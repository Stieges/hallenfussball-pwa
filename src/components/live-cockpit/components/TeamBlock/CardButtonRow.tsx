/**
 * CardButtonRow (C3b-2 F3b2): Gelb / Gelb-Rot / Rot Schnellwahl-Knoepfe in TeamBlock --
 * ausgelagert, damit TeamBlock/index.tsx beim dritten Knopf nicht ueber die
 * Komponenten-Grenze (300 Zeilen) waechst. Styles kommen fertig von TeamBlock (ein Ort fuer
 * Farbe/Breakpoint), hier nur die Buttons.
 *
 * Jeder Knopf setzt Kartentyp UND Team gleichzeitig (BUG-007 Quick-Mode in CardDialog) -- KEINE
 * automatische Umwandlung/Vorschlag (PO 30.09.): der Helfer waehlt Gelb-Rot explizit.
 */
import { type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

export interface CardButtonRowProps {
  teamName: string;
  teamSide: 'home' | 'away';
  disabled: boolean;
  yellowStyle: CSSProperties;
  yellowRedStyle: CSSProperties;
  redStyle: CSSProperties;
  onYellowCard: () => void;
  onYellowRedCard: () => void;
  onRedCard: () => void;
}

export function CardButtonRow({
  teamName,
  teamSide,
  disabled,
  yellowStyle,
  yellowRedStyle,
  redStyle,
  onYellowCard,
  onYellowRedCard,
  onRedCard,
}: CardButtonRowProps) {
  const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: cssVars.spacing.xs,
  };

  return (
    <div style={rowStyle}>
      <button style={yellowStyle} onClick={onYellowCard} disabled={disabled} type="button" aria-label={`Gelbe Karte für ${teamName}`} data-testid={`yellow-card-button-${teamSide}`}>
        🟨 Gelb
      </button>
      <button style={yellowRedStyle} onClick={onYellowRedCard} disabled={disabled} type="button" aria-label={`Gelb-Rote Karte für ${teamName}`} data-testid={`yellow-red-card-button-${teamSide}`}>
        🟨🟥 Gelb-Rot
      </button>
      <button style={redStyle} onClick={onRedCard} disabled={disabled} type="button" aria-label={`Rote Karte für ${teamName}`} data-testid={`red-card-button-${teamSide}`}>
        🟥 Rot
      </button>
    </div>
  );
}

export default CardButtonRow;
