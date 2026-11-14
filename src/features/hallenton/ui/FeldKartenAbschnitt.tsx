/**
 * FeldKartenAbschnitt – „Lautsprecher je Feld“ im Unterpunkt „Hallenton“ (H4-8; @HT-016, @HT-041, @HT-042): eine Karte je Feld mit
 * Zustand, Gerät des Lautsprechers und – wo es zutrifft – den ruhigen Hinweisen „🔈? Prüfen“ (@HT-047), „Hupe 1 statt eigener Ton“
 * (@HT-028) und „läuft schon in einem anderen Fenster“ (@HT-033 Zeile 8). Nur Darstellung der Karten aus `baueFeldKarten`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { StatusPille } from '../../../components/ui/atoms/StatusPille';
import type { FeldKarte } from './feldKarten';
import { LautsprecherFeldKarte } from './LautsprecherFeldKarte';

const listeStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const hinweisStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const ruhigStil: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm };

export interface FeldKartenAbschnittProps {
  karten: readonly FeldKarte[];
  /** Es gibt im Turnier keinen Hallen-Lautsprecher: der Abschnitt erklärt, dass das in Ordnung ist. */
  keinLautsprecherImTurnier: boolean;
}

export function FeldKartenAbschnitt({ karten, keinLautsprecherImTurnier }: FeldKartenAbschnittProps): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <section style={listeStil} aria-labelledby="hallenton-felder-titel" data-testid="hallenton-felder">
      <h2 id="hallenton-felder-titel" style={{ margin: 0, fontSize: cssVars.fontSizes.titleLg, fontWeight: cssVars.fontWeights.semibold }}>{t('seite.felderTitel')}</h2>
      {keinLautsprecherImTurnier ? <p style={hinweisStil} data-testid="hallenton-felder-leer">{t('seite.felderLeer')}</p> : null}
      {karten.map((karte) => (
        <div key={karte.feld} style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
          <LautsprecherFeldKarte
            feld={karte.feld}
            zustand={karte.zustand}
            geraet={karte.geraet}
            pille={karte.pruefen ? (
              <StatusPille ton="info" rand="gestrichelt" symbol={<Icons.SpeakerQuestion size={iconSizeValues.xs} />} data-testid={`lautsprecher-feld-${karte.feld}-pruefen`}>
                {t('statuszeile.pruefen')}
              </StatusPille>
            ) : undefined}
          />
          {karte.hupeStattEigenerTon ? <p style={ruhigStil} data-testid={`lautsprecher-feld-${karte.feld}-hupe`}>{t('statuszeile.hupeStattEigenerTon')}</p> : null}
          {karte.anderesFenster ? <p style={ruhigStil} data-testid={`lautsprecher-feld-${karte.feld}-anderes-fenster`}>{t('statuszeile.anderesFenster')}</p> : null}
        </div>
      ))}
    </section>
  );
}
