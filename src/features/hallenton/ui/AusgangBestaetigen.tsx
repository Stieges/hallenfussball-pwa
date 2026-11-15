/**
 * AusgangBestaetigen – „nicht bereit – Ausgang bestätigen“ (H4-11; @HT-055): nach dem Neuladen kennt die App den gewählten Ausgang ohne erneute
 * Mikrofon-Freigabe nicht mehr sicher; es kommt kein Hallenton über „Standard“. Ein Tipp auf „Ausgang bestätigen“ ist zugleich die Geste für
 * „Ton aktivieren“ und die Mikrofon-Freigabe (`bestaetigen`, K1). Lehnt Olli ab, bleibt „nicht bereit“, und darunter steht „Oder ‚Standard‘ wählen“.
 * Name und Kennung des Ausgangs stehen in keinem Attribut.
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';

export interface AusgangBestaetigenProps {
  /** Der Tipp: Ton aktivieren und Mikrofon erfragen, synchron im Klick; `false`, wenn das Mikrofon abgelehnt wurde. */
  onBestaetigen: () => Promise<boolean>;
  /** „Oder ‚Standard‘ wählen“. */
  onStandard: () => void;
  darfAendern: boolean;
  /** „Standard“ ist gewählt, der Wechsel dorthin ist gescheitert (kein gespeicherter Ausgang, kein Mikrofon nötig): anderer Text, ein Tipp versucht es erneut. */
  standard?: boolean;
}

const spalte: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, alignItems: 'flex-start' };

export function AusgangBestaetigen({ onBestaetigen, onStandard, darfAendern, standard = false }: AusgangBestaetigenProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const [ohneMikrofon, setOhneMikrofon] = useState(false);
  const tippen = (): void => {
    void onBestaetigen().then((ok) => setOhneMikrofon(!ok));
  };
  return (
    <InlineNotice
      tone="warn" icon={<Icons.SpeakerQuestion size={iconSizeValues.sm} />} data-testid="ausgang-bestaetigen"
      footer={darfAendern ? (
        <div style={spalte}>
          <Button variant="primary" size="lg" icon={<Icons.Check size={iconSizeValues.sm} />} onClick={tippen} data-testid="ausgang-bestaetigen-taste">{t('ausgang.bestaetigen')}</Button>
          {ohneMikrofon ? <Button variant="ghost" onClick={onStandard} data-testid="ausgang-oder-standard">{t('ausgang.oderStandard')}</Button> : null}
        </div>
      ) : undefined}
    >
      <strong>{t('ausgang.bestaetigenTitel')}</strong>
      <span>{standard ? t('ausgang.standardGescheitert') : t('ausgang.bestaetigenText')}</span>
    </InlineNotice>
  );
}
