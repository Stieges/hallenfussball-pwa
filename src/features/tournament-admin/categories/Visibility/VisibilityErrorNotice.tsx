/**
 * VisibilityErrorNotice – Fehlerhinweis der Seite „Sichtbarkeit“ (@OB-087 Zeile 7): nach einem gescheiterten Ändern der Sichtbarkeit trägt er
 * „Erneut versuchen“, das genau diese Änderung wiederholt (`onRetry`, nur bei Veröffentlichen und Privatisieren). Solange der Versuch läuft
 * (`retrying`), ist die Taste gesperrt und zeigt den Kreisel; bei Erfolg räumt die Seite den Hinweis ab. Ohne `onRetry` bleibt es der
 * Hinweis ohne Taste (z. B. neuer Code gescheitert).
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '../../../../components/ui/Icons';
import { ArbeitsTaste } from '../../../../components/ui/molecules/ArbeitsTaste';
import { HinweisMitTaste } from '../../../../components/ui/molecules/HinweisMitTaste';
import { cssVars, iconSizeValues } from '../../../../design-tokens';

export interface VisibilityErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  retrying: boolean;
}

export function VisibilityErrorNotice({ message, onRetry, retrying }: VisibilityErrorNoticeProps): ReactElement {
  const { t } = useTranslation('common');
  return (
    <div style={{ marginBottom: cssVars.spacing.md }}>
      <HinweisMitTaste
        ton="fehler" data-testid="visibility-error" symbol={<Icons.AlertTriangle size={iconSizeValues.md} />} titel={message}
        taste={onRetry === undefined ? undefined : <ArbeitsTaste imHinweis laeuft={retrying} onClick={onRetry} data-testid="visibility-error-retry">{t('actions.retry')}</ArbeitsTaste>}
      />
    </div>
  );
}
