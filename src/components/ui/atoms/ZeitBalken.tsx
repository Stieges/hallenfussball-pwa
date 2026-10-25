/**
 * ZeitBalken – Balken unter der Uhr der Laptop-Tafel (@SL-180, Regeln des Hallenmonitors @ZM-145, @ZM-166).
 *
 * Reine Anzeige, für Bildschirmleser verborgen (die Zeit steht in der Uhr). Der gefüllte Anteil nimmt mit der Restzeit ab; die Farbe
 * sagt den Zustand: Grün läuft, Grau angehalten, Gedämpft Pause, Violett nur wenn das Modell es setzt (`BALKEN_TON_SCHLUSSPHASE`) – nie Rot (Rot gehört dem Live-Abzeichen).
 * Höhe aus dem Token der Stufe (`--cockpit-balken`), nur Farben und Maße aus Tokens.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import type { ScoreboardBalken } from '../molecules/scoreboardTypes';

export interface ZeitBalkenProps extends ScoreboardBalken { testId?: string }

const FARBE: Record<ScoreboardBalken['ton'], string> = {
  gruen: cssVars.colors.scoreboardOk,
  grau: cssVars.colors.scoreboardNeutral,
  gedaempft: cssVars.colors.scoreboardTextMuted,
  violett: cssVars.colors.scoreboardFinalPhase,
};

export function ZeitBalken({ anteil, ton, testId }: ZeitBalkenProps): ReactElement {
  const gefuellt = Math.max(0, Math.min(1, anteil));
  const spur: CSSProperties = {
    height: 'var(--cockpit-balken, var(--spacing-sm))', borderRadius: cssVars.borderRadius.full, overflow: 'hidden',
    background: cssVars.colors.scoreboardDivider,
  };
  const fuellung: CSSProperties = { height: '100%', width: `${(gefuellt * 100).toFixed(2)}%`, borderRadius: cssVars.borderRadius.full, background: FARBE[ton] };
  return (
    <div style={spur} aria-hidden="true" data-testid={testId} data-ton={ton} data-anteil={gefuellt.toFixed(3)}>
      <div style={fuellung} />
    </div>
  );
}
