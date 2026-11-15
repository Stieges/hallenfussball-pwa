/**
 * MikrofonHinweis – der Text VOR der Mikrofon-Freigabe (H4-11; @HT-053): wozu (die Namen der Ausgänge), dass nichts aufgenommen wird, und die Empfehlung
 * „Bei Besuchen dieser Website erlauben“. Die Freigabe fragt der Browser erst auf den Tipp (`onErlauben`, synchron im Klick); ohne Tipp wird nie nach
 * dem Mikrofon gefragt. Nur Darstellung.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';

export interface MikrofonHinweisProps {
  onErlauben: () => void;
  /** Die Freigabe wird gerade erfragt. */
  beschaeftigt?: boolean;
}

const stil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm };
const textStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };

export function MikrofonHinweis({ onErlauben, beschaeftigt = false }: MikrofonHinweisProps): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <div style={stil} data-testid="ausgang-mikrofon-hinweis">
      <p style={textStil}>{t('ausgang.mikrofonHinweis')}</p>
      <p style={textStil}>{t('ausgang.mikrofonDetail')}</p>
      <div>
        <Button variant="secondary" icon={<Icons.Speaker size={iconSizeValues.sm} />} busy={beschaeftigt} onClick={onErlauben} data-testid="mikrofon-erlauben">{t('ausgang.mikrofonErlauben')}</Button>
      </div>
    </div>
  );
}
