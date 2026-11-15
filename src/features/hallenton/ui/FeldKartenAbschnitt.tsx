/**
 * FeldKartenAbschnitt – „Lautsprecher je Feld“ im Unterpunkt „Hallenton“ (H4-8; @HT-016, @HT-041, @HT-042): eine Karte je Feld mit
 * Zustand, Gerät des Lautsprechers und – wo es zutrifft – den ruhigen Hinweisen „🔈? Prüfen“ (@HT-047), „Hupe 1 statt eigener Ton“
 * (@HT-028) und „läuft schon in einem anderen Fenster“ (@HT-033 Zeile 8). Nur Darstellung der Karten aus `baueFeldKarten`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { ArbeitsTaste } from '../../../components/ui/molecules/ArbeitsTaste';
import { HinweisMitTaste } from '../../../components/ui/molecules/HinweisMitTaste';
import type { HallStatus } from '../useHallStatus';
import type { FeldKarte } from './feldKarten';
import { LautsprecherFeldKarte } from './LautsprecherFeldKarte';
import { usePruefen } from './PruefenPille';
import type { LautsprecherAbmelden } from './useLautsprecherAbmelden';
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
  status: Pick<HallStatus, 'gehoert' | 'stand'>;
  darfAendern: boolean;
  /** „Abmelden“ (H4-11b, @HT-057); ohne die Angabe zeigen die Karten keine Taste. */
  abmelden?: LautsprecherAbmelden;
}

interface EintragProps { karte: FeldKarte; testton: TesttonHalle; status: Pick<HallStatus, 'gehoert' | 'stand'>; darfAendern: boolean; abmelden?: LautsprecherAbmelden }

/** Die Taste „Abmelden“ der Karte; beim ersten Stand (`laedt`) aus, solange die Antwort aussteht. Der Lesetext nennt Feld, nie den Gerätenamen. */
function AbmeldenTaste({ karte, status, abmelden }: { karte: FeldKarte; status: Pick<HallStatus, 'stand'>; abmelden: LautsprecherAbmelden }): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <Button
      variant="secondary" icon={<Icons.SpeakerOff size={iconSizeValues.sm} />} busy={abmelden.laeuft.has(karte.feld)} disabled={status.stand === 'laedt'}
      aria-label={t('abmelden.tasteLesetext', { feld: karte.feld })} onClick={() => abmelden.anfragen(karte.feld)} data-testid={`lautsprecher-feld-${karte.feld}-abmelden`}
    >
      {t('abmelden.taste')}
    </Button>
  );
}

function FeldEintrag({ karte, testton, status, darfAendern, abmelden }: EintragProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const { pille, extra } = usePruefen({ feld: karte.feld, aktiv: karte.pruefen, darfAendern, testton, gehoert: status.gehoert });
  const fehler = abmelden?.fehler[karte.feld];
  const taste = abmelden?.anbieten(karte) === true ? <AbmeldenTaste karte={karte} status={status} abmelden={abmelden} /> : undefined;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
      <LautsprecherFeldKarte feld={karte.feld} zustand={karte.zustand} geraet={karte.geraet} pille={pille ?? undefined} extra={extra ?? undefined} aktion={taste} />
      {abmelden?.abgemeldet.has(karte.feld) === true && karte.zustand.art === 'keinLautsprecher' ? (
        <p style={ruhigStil} role="status" data-testid={`lautsprecher-feld-${karte.feld}-abgemeldet`}>{t('abmelden.ergebnis', { feld: karte.feld })}</p>
      ) : null}
      {fehler === undefined || abmelden === undefined ? null : (
        <HinweisMitTaste
          ton="warn" symbol={<Icons.AlertTriangle size={iconSizeValues.sm} />} titel={t(`abmelden.fehler.${fehler}`, { feld: karte.feld })} data-testid={`lautsprecher-feld-${karte.feld}-abmelden-fehler`}
          taste={fehler === 'netz' || fehler === 'antwort_unbekannt' ? (
            <ArbeitsTaste imHinweis laeuft={abmelden.laeuft.has(karte.feld)} onClick={() => abmelden.nochmal(karte.feld)} data-testid={`lautsprecher-feld-${karte.feld}-abmelden-nochmal`}>{t('abmelden.nochmal')}</ArbeitsTaste>
          ) : undefined}
        />
      )}
      {karte.hupeStattEigenerTon ? <p style={ruhigStil} data-testid={`lautsprecher-feld-${karte.feld}-hupe`}>{t('statuszeile.hupeStattEigenerTon')}</p> : null}
      {karte.anderesFenster ? <p style={ruhigStil} data-testid={`lautsprecher-feld-${karte.feld}-anderes-fenster`}>{t('statuszeile.anderesFenster')}</p> : null}
    </div>
  );
}

export function FeldKartenAbschnitt({ karten, keinLautsprecherImTurnier, testton, status, darfAendern, abmelden }: FeldKartenAbschnittProps): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <section style={listeStil} aria-labelledby="hallenton-felder-titel" data-testid="hallenton-felder">
      <h2 id="hallenton-felder-titel" style={{ margin: 0, fontSize: cssVars.fontSizes.titleLg, fontWeight: cssVars.fontWeights.semibold }}>{t('seite.felderTitel')}</h2>
      {keinLautsprecherImTurnier && (abmelden?.abgemeldet.size ?? 0) === 0 ? <p style={hinweisStil} data-testid="hallenton-felder-leer">{t('seite.felderLeer')}</p> : null}
      {karten.map((karte) => <FeldEintrag key={karte.feld} karte={karte} testton={testton} status={status} darfAendern={darfAendern} abmelden={abmelden} />)}
    </section>
  );
}
