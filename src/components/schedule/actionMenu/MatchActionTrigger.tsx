/**
 * MatchActionTrigger (@SL-193): die Tippfläche der Finalrunde, die die Aktionsauswahl des Spiels öffnet.
 * - Die Spielnummer ist eine echte Taste (Tastatur, Screenreader, ≥ 44 px); `aria-label`: „Aktionen für Spiel 9“.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';

const triggerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.xs}`,
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 'inherit',
  cursor: 'pointer',
};

export interface MatchActionTriggerProps {
  matchId: string;
  matchNumber: number | undefined;
  onOpen: (matchId: string) => void;
  children: ReactNode;
}

export function MatchActionTrigger({ matchId, matchNumber, onOpen, children }: MatchActionTriggerProps) {
  const { t } = useTranslation('tournament');
  return (
    <button
      type="button"
      style={triggerStyle}
      aria-haspopup="dialog"
      aria-label={t('actionMenu.open', { number: matchNumber ?? '?' })}
      onClick={() => { onOpen(matchId); }}
      data-testid={`match-actions-open-${matchId}`}
    >
      {children}
    </button>
  );
}
