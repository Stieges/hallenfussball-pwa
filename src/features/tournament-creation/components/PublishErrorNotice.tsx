/**
 * PublishErrorNotice – der Hinweis „Turnier konnte nicht veröffentlicht werden“ in der Vorschau des Wizards (@OB-087 Zeile 6): trägt die Taste
 * „Erneut versuchen“, die genau das gescheiterte Veröffentlichen wiederholt – ohne dass etwas neu eingegeben wird (die Eingaben stehen noch im
 * Wizard). Solange der Versuch läuft, ist sie gesperrt und zeigt den Kreisel; die Sperre gegen Doppelauslösen liegt in `handlePublish`
 * (`publishLockRef`). „Schließen“ blendet den Hinweis aus.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { ArbeitsTaste } from '../../../components/ui/molecules/ArbeitsTaste';
import { cssVars } from '../../../design-tokens';

export interface PublishErrorNoticeProps {
  title: string;
  message: string;
  /** Beschriftung von „Schließen“ (wie bisher vom Wizard geliefert). */
  closeLabel: string;
  /** Wiederholt das gescheiterte Veröffentlichen (mit denselben Angaben). */
  onRetry: () => void;
  onClose: () => void;
  /** Das Veröffentlichen läuft gerade (Taste gesperrt, Kreisel). */
  retrying: boolean;
}

export function PublishErrorNotice({ title, message, closeLabel, onRetry, onClose, retrying }: PublishErrorNoticeProps): ReactElement {
  const { t } = useTranslation('common');
  return (
    <div style={{ marginBottom: cssVars.spacing.lg }}>
      <InlineNotice
        tone="error"
        data-testid="publish-error-notice"
        footer={(
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm }}>
            <ArbeitsTaste laeuft={retrying} onClick={onRetry} data-testid="publish-error-retry">{t('actions.retry')}</ArbeitsTaste>
            <Button variant="ghost" onClick={onClose} data-testid="publish-error-close">{closeLabel}</Button>
          </div>
        )}
      >
        <strong style={{ fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold }}>{title}</strong>
        <span>{message}</span>
      </InlineNotice>
    </div>
  );
}
