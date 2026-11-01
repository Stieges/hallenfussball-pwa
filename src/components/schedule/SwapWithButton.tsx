/**
 * Taste „Tauschen mit …“ an einem Spiel im Bearbeiten-Modus (@ZP-100) – der Weg ohne Ziehen.
 * Angepfiffene Spiele (läuft, Halbzeit, beendet) bekommen keine Taste (@ZP-093).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui';
import { useSwapWith } from './swapWithContext';

interface SwapWithButtonProps {
  matchId: string;
  locked: boolean;
  /** Rahmen um die Taste (nur gezeichnet, wenn es die Taste gibt) */
  wrapperStyle?: CSSProperties;
}

export const SwapWithButton: React.FC<SwapWithButtonProps> = ({ matchId, locked, wrapperStyle }) => {
  const { t } = useTranslation('tournament');
  const swapWith = useSwapWith();
  if (!swapWith || locked) { return null; }
  const button = (
    <Button variant="secondary" size="sm" onClick={() => swapWith.request(matchId)} data-testid={`swap-with-${matchId}`}>
      {t('draft.swapWith')}
    </Button>
  );
  return wrapperStyle ? <div style={wrapperStyle}>{button}</div> : button;
};
