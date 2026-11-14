/**
 * VisibilityErrorNotice – Fehlerhinweis der Seite „Sichtbarkeit“ (@OB-087 Zeile 7): nach einem gescheiterten Ändern der Sichtbarkeit trägt er
 * „Erneut versuchen“, das genau diese Änderung wiederholt (`onRetry`, nur bei Veröffentlichen und Privatisieren). Solange der Versuch läuft
 * (`retrying`), ist die Taste gesperrt und zeigt den Kreisel; bei Erfolg räumt die Seite den Hinweis ab. Ohne `onRetry` bleibt es der
 * Hinweis ohne Taste (z. B. neuer Code gescheitert).
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ArbeitsTaste } from '../../../../components/ui/molecules/ArbeitsTaste';
import { cssVars } from '../../../../design-tokens';

export interface VisibilityErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  retrying: boolean;
}

export function VisibilityErrorNotice({ message, onRetry, retrying }: VisibilityErrorNoticeProps): ReactElement {
  const { t } = useTranslation('common');
  return (
    <div
      role="alert" data-testid="visibility-error"
      style={{
        padding: cssVars.spacing.md, background: cssVars.colors.errorLight, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.errorBorder}`,
        borderRadius: cssVars.borderRadius.md, color: cssVars.colors.error, marginBottom: cssVars.spacing.md,
        display: 'grid', gap: cssVars.spacing.sm, justifyItems: 'start',
      }}
    >
      <span>{message}</span>
      {onRetry !== undefined && <ArbeitsTaste laeuft={retrying} onClick={onRetry} data-testid="visibility-error-retry">{t('actions.retry')}</ArbeitsTaste>}
    </div>
  );
}
