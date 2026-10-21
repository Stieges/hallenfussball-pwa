/**
 * TiebreakChoiceSheet – Blatt „Wie wird entschieden?“ (Zustand `entscheidung`, @SL-053).
 *
 * Drei Wege: Verlängerung, Golden Goal, Strafstoßschießen (die Werte von `TIEBREAK_CHOICE`). Auf `DialogSurface`
 * (die Fläche ist modal), unter 600 px als Blatt von unten; geschlossen wird mit Esc, Zurück oder Tipp daneben.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import { DialogSurface } from '../../ui/molecules/DialogSurface';
import type { TiebreakWahl } from '../typesLeiste';

export interface TiebreakChoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onWaehle: (wahl: TiebreakWahl) => void;
}

const flaecheStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.lg };
const knopfStil: CSSProperties = { minHeight: cssVars.touchTargets.primary, width: '100%' };

const WEGE: ReadonlyArray<{ wahl: TiebreakWahl; key: 'entscheidung.verlaengerung' | 'entscheidung.goldenGoal' | 'entscheidung.strafstoss'; testId: string }> = [
  { wahl: 'overtime', key: 'entscheidung.verlaengerung', testId: 'tiebreak-overtime' },
  { wahl: 'goldenGoal', key: 'entscheidung.goldenGoal', testId: 'tiebreak-goldenGoal' },
  { wahl: 'shootout', key: 'entscheidung.strafstoss', testId: 'tiebreak-shootout' },
];

export function TiebreakChoiceSheet({ isOpen, onClose, onWaehle }: TiebreakChoiceSheetProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  return (
    <DialogSurface isOpen={isOpen} onClose={onClose} placement="sheet" ariaLabel={t('entscheidung.titel')} testId="tiebreak-choice">
      <div style={flaecheStil}>
        <h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0 }}>{t('entscheidung.titel')}</h2>
        {WEGE.map((weg) => (
          <Button key={weg.wahl} variant="secondary" style={knopfStil} data-testid={weg.testId} onClick={() => { onWaehle(weg.wahl); }}>
            {t(weg.key)}
          </Button>
        ))}
      </div>
    </DialogSurface>
  );
}
