/**
 * TesttonAbschnitt – „Testton“ im Unterpunkt „Hallenton“ (H4-8; @HT-017, @HT-041, @HT-046): „Hier anhören“ spielt auf diesem Gerät,
 * „Testton in der Halle“ am Hallen-Lautsprecher des Felds, danach die Quittung „gespielt 14:02“ (vom Server) oder der Grund. Ohne
 * aktuellen Stand kein Aufruf: „Kein Testton: kein Netz“. Ist der Lautsprecher nicht bereit oder meldet er sich nicht, geht gar kein
 * Auftrag raus (ein spätes Nachholen in der Halle wäre schlimmer als die Auskunft). Läuft auf dem Feld ein Spiel, fragt zuerst die
 * Rückfrage „Auf Feld 1 läuft Spiel 11. Testton trotzdem in der Halle spielen?“ (H4-10, @HT-017); ohne Bestätigen geht nichts raus. Der ganze Abschnitt steht nur, wo geändert werden darf (nach dem Turnierende nicht, @HT-046).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import type { HallStatus } from '../useHallStatus';
import type { FeldKarte } from './feldKarten';
import type { TesttonHalle } from './useTesttonHalle';

export { QUITTUNG_WARTEN_MS } from './useTesttonHalle';

export interface TesttonAbschnittProps {
  karten: readonly FeldKarte[];
  status: Pick<HallStatus, 'stand' | 'antwort' | 'testtonAnfordern'>;
  /** „Hier anhören“: spielt den Abpfiff-Ton auf diesem Gerät. */
  hierAnhoeren: () => void;
  /** Was „Hier anhören“ nicht gespielt hat (z. B. bei 0 %), unter der Taste. */
  hierHinweis?: string | null;
  geraetName: string | null;
  /** Auftrag und Quittung des Testtons in der Halle (`useTesttonHalle`, von der Seite gehalten; läuft bei laufendem Spiel über die Rückfrage, @HT-017). */
  testton: TesttonHalle;
}

const abschnittStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const kastenStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.md, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg, backgroundColor: cssVars.colors.surface, color: cssVars.colors.textPrimary };
const titelStil: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold };
const textStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const zeileStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, paddingTop: cssVars.spacing.md, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` };
const quittungStil: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, margin: 0, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold };

export function TesttonAbschnitt({ karten, status, hierAnhoeren, hierHinweis = null, geraetName, testton }: TesttonAbschnittProps): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <section style={abschnittStil} aria-labelledby="hallenton-testton-titel" data-testid="hallenton-testton">
      <h2 id="hallenton-testton-titel" style={{ margin: 0, fontSize: cssVars.fontSizes.titleLg, fontWeight: cssVars.fontWeights.semibold }}>{t('testton.titel')}</h2>
      <div style={kastenStil}>
        <h3 style={titelStil}>{t('testton.anhoerenTitel')}</h3>
        <p style={textStil}>{geraetName === null ? t('testton.anhoerenText') : t('testton.anhoerenTextGeraet', { name: geraetName })}</p>
        <div>
          <Button variant="secondary" icon={<Icons.SpeakerLow size={iconSizeValues.sm} />} onClick={hierAnhoeren} data-testid="testton-hier-anhoeren">{t('testton.anhoeren')}</Button>
        </div>
        {hierHinweis === null ? null : <p style={textStil} role="status" data-testid="testton-hier-hinweis">{hierHinweis}</p>}
        <h3 style={titelStil}>{t('testton.halleTitel')}</h3>
        <p style={textStil}>{t('testton.halleText')}</p>
        {karten.map((karte) => {
          const e = testton.ergebnisse[karte.feld];
          const kein = karte.zustand.art === 'keinLautsprecher';
          const zeile = kein ? null : status.stand === 'unbekannt' ? { text: t('testton.keinNetz'), warn: true }
            : e?.art === 'laeuft' ? { text: t('testton.laeuft'), warn: false }
            : e?.art === 'gespielt' ? { text: t('testton.gespielt', { zeit: e.zeit }), warn: false }
            : e?.art === 'text' ? { text: e.text, warn: e.warn } : null;
          return (
            <div key={karte.feld} style={zeileStil} data-testid={`testton-feld-${karte.feld}`}>
              <div style={{ minWidth: 0 }}>
                <h4 style={titelStil}>{t('feld.titel', { feld: karte.feld })}</h4>
                <p style={textStil}>{kein || karte.geraet === undefined ? t('testton.keinLautsprecherKein') : t('testton.lautsprecher', { name: karte.geraet.name })}</p>
              </div>
              {kein ? null : (
                <Button variant="secondary" icon={<Icons.Speaker size={iconSizeValues.sm} />} disabled={status.stand === 'laedt'} onClick={() => testton.ausloesen(karte.feld)} data-testid={`testton-halle-${karte.feld}`}>{t('testton.halle')}</Button>
              )}
              {zeile === null ? null : (
                <p style={{ ...quittungStil, flexBasis: '100%' }} role="status" data-testid={`testton-feld-${karte.feld}-ergebnis`}>
                  <span aria-hidden="true" style={{ display: 'flex', color: zeile.warn ? cssVars.colors.warning : cssVars.colors.primary }}>
                    {zeile.warn ? <Icons.AlertTriangle size={iconSizeValues.sm} /> : <Icons.CheckCircle size={iconSizeValues.sm} />}
                  </span>
                  {zeile.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
