/**
 * TastenkürzelSchalter – „Tastenkürzel“ ein- und ausschalten (WCAG 2.1.4, @SL-189). Gilt je Gerät und wirkt sofort; auch ohne Steuerrecht
 * änderbar, weil es nur dieses Gerät betrifft. Steht in den Einstellungen des Cockpits unter den Turnierwerten.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CheckboxField } from '../../../ui/molecules/CheckboxField';
import { useTastenkuerzelAn } from '../../hooks/useTastenkuerzelAn';

export function TastenkuerzelSchalter(): ReactElement {
  const { t } = useTranslation('cockpit');
  const [an, setze] = useTastenkuerzelAn();
  return (
    <div style={{ marginTop: cssVars.spacing.lg, paddingTop: cssVars.spacing.md, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` }} data-testid="tastenkuerzel-schalter">
      <CheckboxField label={t('tasten.schalter.label')} hint={t('tasten.schalter.hinweis')} checked={an} onChange={setze} data-testid="tastenkuerzel-checkbox" />
    </div>
  );
}
