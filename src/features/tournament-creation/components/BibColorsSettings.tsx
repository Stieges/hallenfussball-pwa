/**
 * BibColorsSettings – „Leibchenfarben dieses Turniers“ im Assistenten (@W3-029, @W3-041): bis zu zwei Hallenfarben aus der Trikot-Palette plus Neongrün
 * (`bibColorPresets`), jede mit ihrem Namen als Wort, und die Regel „Bei gleicher Trikotfarbe zieht die Leibchen an“ (erstgenannte Mannschaft = Heim,
 * Vorgabe, oder Gast). Die Einstellung liegt im `tournaments.config`-JSON (ohne Migration); ohne Eintrag schlägt die Karte Gelb vor.
 * Gewählte Leibchenfarben bleiben bei einer späteren Änderung stehen (@W3-029: bestätigte Wahlen bleiben).
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { bibColorPresets } from '../../../design-tokens/colors/palette';
import { bibRuleOf, hallenFarbenOf, MAX_HALLEN_FARBEN } from '../../../core/models/kit';
import { leibchenFarbName } from '../../../core/models/kitChoice';
import { ChipButton } from '../../../components/ui/atoms/ChipButton';
import type { Tournament } from '../../../types/tournament';

export interface BibColorsSettingsProps {
  formData: Pick<Tournament, 'bibColor' | 'bibColors' | 'bibRule'>;
  onUpdate: <K extends 'bibColors' | 'bibRule' | 'bibColor'>(field: K, value: Tournament[K]) => void;
}

const reihe = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.xs } as const;
const punkt = (farbe: string) => ({
  width: cssVars.spacing.md, height: cssVars.spacing.md, borderRadius: cssVars.borderRadius.full, background: farbe,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, flex: 'none',
}) as const;

export function BibColorsSettings({ formData, onUpdate }: BibColorsSettingsProps): ReactElement {
  const { t } = useTranslation('wizard');
  const { t: tCockpit } = useTranslation('cockpit');
  const gewaehlt = hallenFarbenOf(formData);
  const regel = bibRuleOf(formData);
  const normal = (farbe: string): string => farbe.toUpperCase();

  const wechsle = (farbe: string): void => {
    const hex = normal(farbe);
    const neu = gewaehlt.includes(hex) ? gewaehlt.filter((f) => f !== hex) : gewaehlt.length >= MAX_HALLEN_FARBEN ? gewaehlt : [...gewaehlt, hex];
    onUpdate('bibColors', neu);
    onUpdate('bibColor', neu[0]);
  };

  return (
    <section style={{ margin: `0 0 ${cssVars.spacing.lg} 0` }} data-testid="wizard-bib-colors" aria-labelledby="wizard-bib-title">
      <h3 id="wizard-bib-title" style={{ fontSize: cssVars.fontSizes.lg, color: cssVars.colors.textPrimary, margin: `0 0 ${cssVars.spacing.xs} 0` }}>{t('step4.bib.title')}</h3>
      <p style={{ margin: `0 0 ${cssVars.spacing.sm} 0`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md }}>{t('step4.bib.hilfe')}</p>
      <div style={reihe} role="group" aria-label={t('step4.bib.title')}>
        {bibColorPresets.map((farbe) => {
          const position = gewaehlt.indexOf(normal(farbe)) + 1;
          const name = tCockpit(`anpfiff.farbe.${leibchenFarbName(farbe) ?? 'turnier'}`);
          return (
            <ChipButton key={farbe} selected={position > 0} size="minimum" onClick={() => { wechsle(farbe); }}
              aria-label={position > 0 ? `${name}, ${t('step4.bib.gewaehlt', { position })}` : name} data-testid={`wizard-bib-farbe-${leibchenFarbName(farbe) ?? 'turnier'}`}>
              <span style={punkt(farbe)} aria-hidden="true" />{name}{position > 0 ? ` (${String(position)})` : ''}
            </ChipButton>
          );
        })}
      </div>
      <p style={{ margin: `${cssVars.spacing.md} 0 ${cssVars.spacing.xs} 0`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md }}>{t('step4.bib.regelTitel')}</p>
      <div style={reihe} role="group" aria-label={t('step4.bib.regelTitel')}>
        <ChipButton selected={regel === 'home'} size="minimum" onClick={() => { onUpdate('bibRule', 'home'); }} data-testid="wizard-bib-regel-heim">{t('step4.bib.heim')}</ChipButton>
        <ChipButton selected={regel === 'away'} size="minimum" onClick={() => { onUpdate('bibRule', 'away'); }} data-testid="wizard-bib-regel-gast">{t('step4.bib.gast')}</ChipButton>
      </div>
    </section>
  );
}
