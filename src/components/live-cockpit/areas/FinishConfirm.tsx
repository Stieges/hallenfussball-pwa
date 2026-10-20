/**
 * FinishConfirm – Rückfrage „Spiel 11 bei noch 3:12 Minuten Spielzeit beenden?“ nach dem Gedrückthalten von „Abpfiff“
 * (Plan LT-1; @SL-157, @SL-010, @SL-133). Auf `DialogSurface` als Rückfrage-Dialog: Esc, Tipp daneben und „Weiterspielen“ beenden
 * nichts, die Eingabetaste löst nichts aus, der Fokus liegt zuerst auf „Weiterspielen“ (@OB-014). Ton und Vibration
 * kommen weiter allein aus `useWhistle`.
 */
import { useRef, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import { DialogSurface } from '../../ui/molecules/DialogSurface';

export interface FinishConfirmProps {
  offen: boolean;
  spielNummer: number;
  /** Restzeit des ganzen Spiels, z. B. „3:12“ (`restzeitText`). */
  restText: string;
  onBeenden: () => void;
  onAbbrechen: () => void;
}

const flaecheStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.lg };
const knopfStil: CSSProperties = { minHeight: cssVars.touchTargets.primary, width: '100%' };

export function FinishConfirm({ offen, spielNummer, restText, onBeenden, onAbbrechen }: FinishConfirmProps): ReactElement {
  const { t } = useTranslation('cockpit');
  const weiterRef = useRef<HTMLButtonElement>(null);
  const frage = t('abpfiff.frage', { spiel: spielNummer, rest: restText });
  return (
    <DialogSurface
      isOpen={offen} onClose={onAbbrechen} role="alertdialog" ariaLabel={frage} testId="finish-confirm"
      accent={cssVars.colors.error} initialFocusRef={weiterRef} suppressEnter
    >
      <div style={flaecheStil}>
        <h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0 }}>{frage}</h2>
        <Button ref={weiterRef} variant="secondary" style={knopfStil} data-testid="finish-confirm-weiter" onClick={onAbbrechen}>{t('abpfiff.weiterspielen')}</Button>
        <Button variant="danger" style={knopfStil} data-testid="finish-confirm-beenden" onClick={onBeenden}>{t('abpfiff.beenden')}</Button>
      </div>
    </DialogSurface>
  );
}
