/**
 * FeldKartenAbschnitt – „Lautsprecher je Feld“ im Unterpunkt „Hallenton“ (H4-8; @HT-016, @HT-041, @HT-042): eine Karte je Feld mit
 * Zustand, Gerät des Lautsprechers und – wo es zutrifft – den ruhigen Hinweisen „🔈? Prüfen“ (@HT-047), „Hupe 1 statt eigener Ton“
 * (@HT-028) und „läuft schon in einem anderen Fenster“ (@HT-033 Zeile 8). Nur Darstellung der Karten aus `baueFeldKarten`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { HallStatus } from '../useHallStatus';
import type { FeldKarte } from './feldKarten';
import { LautsprecherFeldKarte } from './LautsprecherFeldKarte';
import { usePruefen } from './PruefenPille';
import type { TesttonHalle } from './useTesttonHalle';

const listeStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const hinweisStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const ruhigStil: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm };

export interface FeldKartenAbschnittProps {
  karten: readonly FeldKarte[];
  /** Es gibt im Turnier keinen Hallen-Lautsprecher: der Abschnitt erklärt, dass das in Ordnung ist. */
  keinLautsprecherImTurnier: boolean;
  /** Der Testton in der Halle (für „🔈? Prüfen“, H4-11). */
  testton: TesttonHalle;
  status: Pick<HallStatus, 'gehoert'>;
  darfAendern: boolean;
}

interface EintragProps { karte: FeldKarte; testton: TesttonHalle; status: Pick<HallStatus, 'gehoert'>; darfAendern: boolean }

function FeldEintrag({ karte, testton, status, darfAendern }: EintragProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const { pille, extra } = usePruefen({ feld: karte.feld, aktiv: karte.pruefen, darfAendern, testton, gehoert: status.gehoert });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
      <LautsprecherFeldKarte feld={karte.feld} zustand={karte.zustand} geraet={karte.geraet} pille={pille ?? undefined} extra={extra ?? undefined} />
      {karte.hupeStattEigenerTon ? <p style={ruhigStil} data-testid={`lautsprecher-feld-${karte.feld}-hupe`}>{t('statuszeile.hupeStattEigenerTon')}</p> : null}
      {karte.anderesFenster ? <p style={ruhigStil} data-testid={`lautsprecher-feld-${karte.feld}-anderes-fenster`}>{t('statuszeile.anderesFenster')}</p> : null}
    </div>
  );
}

export function FeldKartenAbschnitt({ karten, keinLautsprecherImTurnier, testton, status, darfAendern }: FeldKartenAbschnittProps): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <section style={listeStil} aria-labelledby="hallenton-felder-titel" data-testid="hallenton-felder">
      <h2 id="hallenton-felder-titel" style={{ margin: 0, fontSize: cssVars.fontSizes.titleLg, fontWeight: cssVars.fontWeights.semibold }}>{t('seite.felderTitel')}</h2>
      {keinLautsprecherImTurnier ? <p style={hinweisStil} data-testid="hallenton-felder-leer">{t('seite.felderLeer')}</p> : null}
      {karten.map((karte) => <FeldEintrag key={karte.feld} karte={karte} testton={testton} status={status} darfAendern={darfAendern} />)}
    </section>
  );
}
