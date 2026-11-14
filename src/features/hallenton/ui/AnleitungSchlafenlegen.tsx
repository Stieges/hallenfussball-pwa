/**
 * AnleitungSchlafenlegen – „Laptop und Browser einstellen“ (H4-9, @HT-043): aufklappbar, je Browser (Chrome, Edge, Safari) die Schritte, mit
 * der Adresse der Einstellungsseite und der Adresse dieser App zum Kopieren. In Chrome und Edge heißt die Ausnahme „Diese Websites immer
 * aktiv lassen“; Safari hat keine und meldet das Schlafenlegen nicht (Spike 06.11.). Dazu die zwei Hinweise für den Laptop. Die App prüft
 * nichts davon. Vorgewählt ist der Browser des Geräts, wenn er erkennbar ist.
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import { ChipChoice } from '../../../components/ui/molecules/ChipChoice';
import type { BrowserArt } from './browserErkennung';

const EINSTELLUNG: Record<Exclude<BrowserArt, 'safari'>, string> = { chrome: 'chrome://settings/performance', edge: 'edge://settings/system' };
const BROWSER: readonly BrowserArt[] = ['chrome', 'edge', 'safari'];

export interface AnleitungSchlafenlegenProps {
  /** Adresse dieser App (Host), z. B. `hallenfussball-pwa.vercel.app`. */
  adresse: string;
  /** Vorgewählter Browser. */
  browser?: BrowserArt;
  /** Kopieren in die Zwischenablage; Standard: `navigator.clipboard`. */
  kopiere?: (text: string) => Promise<void>;
}

const listeStil: CSSProperties = { margin: 0, paddingLeft: cssVars.spacing.lg, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const textStil: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const hinweisStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const adresseStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.sm, marginTop: cssVars.spacing.xs };
const codeStil: CSSProperties = { fontFamily: cssVars.fontFamilies.mono, fontSize: cssVars.fontSizes.md, padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, background: cssVars.colors.surfaceLight, borderRadius: cssVars.borderRadius.sm, overflowWrap: 'anywhere' };

async function standardKopieren(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function Adresse({ wert, kopiere, testId }: { wert: string; kopiere: (text: string) => Promise<void>; testId: string }): ReactElement {
  const { t } = useTranslation('hallenton');
  const [kopiert, setKopiert] = useState(false);
  const los = (): void => {
    void kopiere(wert).then(() => setKopiert(true), () => setKopiert(false));
  };
  return (
    <div style={adresseStil}>
      <code style={codeStil} data-testid={`${testId}-text`}>{wert}</code>
      <Button variant="secondary" size="sm" icon={kopiert ? <Icons.Check size={iconSizeValues.sm} /> : <Icons.Copy size={iconSizeValues.sm} />} onClick={los} aria-label={`${t('anleitung.kopieren')}: ${wert}`} data-testid={`${testId}-kopieren`}>
        {kopiert ? t('anleitung.kopiert') : t('anleitung.kopieren')}
      </Button>
    </div>
  );
}

export function AnleitungSchlafenlegen({ adresse, browser: vorgabe = 'chrome', kopiere = standardKopieren }: AnleitungSchlafenlegenProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const [browser, setBrowser] = useState<BrowserArt>(vorgabe);
  return (
    <CollapsibleSection title={t('anleitung.titel')} icon={<Icons.Laptop size={iconSizeValues.sm} />} testId="hallenton-anleitung">
      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md }}>
        <p style={textStil}>{t('anleitung.einleitung')}</p>
        <ChipChoice legend={t('anleitung.browser')} options={BROWSER.map((b) => ({ value: b, label: t(`anleitung.${b}`) }))} value={browser} onSelect={(b) => setBrowser(b as BrowserArt)} testId="anleitung-browser" />
        {browser === 'safari' ? (
          <p style={textStil} data-testid="anleitung-safari">{t('anleitung.safariText')}</p>
        ) : (
          <ol style={listeStil} data-testid={`anleitung-${browser}`}>
            <li>{t('anleitung.schrittAdresse')}<Adresse wert={EINSTELLUNG[browser]} kopiere={kopiere} testId="anleitung-einstellung" /></li>
            <li>{t('anleitung.schrittSuchen')}</li>
            <li>{t('anleitung.schrittApp')}<Adresse wert={adresse} kopiere={kopiere} testId="anleitung-app" /></li>
          </ol>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm }}>
          <strong style={textStil}>{t('anleitung.amLaptop')}</strong>
          <ul style={{ ...listeStil, gap: cssVars.spacing.xs }}>
            <li>{t('anleitung.netzteil')}</li>
            <li>{t('anleitung.ruhezustand')}</li>
          </ul>
        </div>
        <p style={hinweisStil}>{t('anleitung.pruefen')}</p>
      </div>
    </CollapsibleSection>
  );
}
