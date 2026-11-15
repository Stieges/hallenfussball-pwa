/**
 * HelferOhneNetzHinweis – der Hinweis „Ohne Netz“ der Helfer-Verwaltung (@OB-087 Zeile 2): „Verbinden“ steht rechts in der Zeile des Hinweises
 * (`HinweisMitTaste`) und versucht die Verbindung sofort neu; danach lädt die Liste der Helfer von selbst (`beiEnde`, nicht erst im nächsten 2-s-Takt).
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '../../../../components/ui/Icons';
import { HinweisMitTaste } from '../../../../components/ui/molecules/HinweisMitTaste';
import { iconSizeValues } from '../../../../design-tokens';
import { VerbindenTaste } from '../../../match-engine/VerbindenTaste';

export function HelferOhneNetzHinweis({ beiEnde }: { beiEnde: () => void }): ReactElement {
  const { t } = useTranslation('admin');
  return (
    <HinweisMitTaste
      data-testid="needs-network" symbol={<Icons.WifiOff size={iconSizeValues.md} />} titel={t('teamHelpers.offline.title')} zusatz={t('teamHelpers.offline.text')}
      taste={<VerbindenTaste data-testid="needs-network-verbinden" beiEnde={beiEnde} />}
    />
  );
}
