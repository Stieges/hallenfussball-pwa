/**
 * PruefenPille – „🔈? Prüfen“ auf der Karte des Felds und was danach kommt (H4-11; @HT-047, @HT-049). Die Pille steht ruhig neben „bereit“ (keine
 * Störung); der Tipp spielt einmal den Testton in der Halle (derselbe Auftrag wie die Taste im Abschnitt „Testton“, mit der Rückfrage bei laufendem
 * Spiel). Sobald der Testton gespielt ist, steht „Gespielt 14:02“ mit „✓ Gehört“ und „✕ Nicht gehört“: „Gehört“ nimmt den Hinweis weg (am Server,
 * `gehoert`), „Nicht gehört“ zeigt die drei Prüfpunkte und „Nochmal prüfen“. Der Lautsprecher bleibt in allen Schritten „bereit“; nichts davon
 * hält Anpfiff oder Spiel auf. Wer nichts wählt, lässt die Frage stehen. Nach Neuladen oder Minimieren entsteht die Pille nicht von selbst (das
 * entscheidet der Server mit dem Hinweis, nicht diese Darstellung).
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { StatusPille } from '../../../components/ui/atoms/StatusPille';
import type { TesttonErgebnis, TesttonHalle } from './useTesttonHalle';

export interface PruefenZustand {
  /** Die Pille („Prüfen“) oder `null`, solange Frage oder Prüfpunkte stehen. */
  pille: ReactNode;
  /** Die Frage „Gehört?“ oder die Prüfpunkte unter der Karte, sonst `null`. */
  extra: ReactNode;
}

export interface PruefenProps {
  feld: number;
  /** Am Feld steht der Hinweis „Ausgang eventuell geändert“ (Server). */
  aktiv: boolean;
  /** Antippbar nur, wo geändert werden darf (nach dem Turnierende nicht, @HT-046). */
  darfAendern: boolean;
  testton: TesttonHalle;
  /** „✓ Gehört“: nimmt den Hinweis weg. */
  gehoert: (feld: number) => Promise<unknown>;
}

type Schritt = { art: 'ruhe' } | { art: 'angefordert'; bei: TesttonErgebnis | undefined } | { art: 'nichtGehoert' };

const gruppeStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, padding: cssVars.spacing.md, border: `${cssVars.borderWidth.medium} dashed ${cssVars.colors.infoStrong}`, borderRadius: cssVars.borderRadius.lg, backgroundColor: cssVars.colors.infoLight, color: cssVars.colors.textPrimary };
const zeileStil: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, margin: 0, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold };
const textStil: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const tastenStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };
const listeStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, margin: 0, padding: 0, listStyle: 'none', fontSize: cssVars.fontSizes.md };

export function usePruefen({ feld, aktiv, darfAendern, testton, gehoert }: PruefenProps): PruefenZustand {
  const { t } = useTranslation('hallenton');
  const [schritt, setSchritt] = useState<Schritt>({ art: 'ruhe' });
  const ergebnis = testton.ergebnisse[feld];
  if (!aktiv) {
    return { pille: null, extra: null };
  }
  const tippen = (): void => {
    setSchritt({ art: 'angefordert', bei: ergebnis });
    testton.ausloesen(feld);
  };
  const neu = schritt.art === 'angefordert' && ergebnis !== undefined && ergebnis !== schritt.bei ? ergebnis : null; // nur der Auftrag dieses Tipps zählt
  const warten = neu?.art === 'laeuft';
  if (schritt.art === 'nichtGehoert') {
    return {
      pille: null,
      extra: (
        <div role="group" aria-label={t('pruefen.gruppe')} style={gruppeStil} data-testid="ausgang-pruefpunkte">
          <p style={zeileStil}><span aria-hidden="true" style={{ display: 'flex' }}><Icons.SpeakerQuestion size={iconSizeValues.sm} /></span>{t('pruefen.nichtGehoertTitel')}</p>
          <p style={textStil}>{t('pruefen.pruefe')}</p>
          <ul style={listeStil}>
            {(['punkt1', 'punkt2', 'punkt3'] as const).map((k) => (
              <li key={k} style={{ display: 'flex', gap: cssVars.spacing.sm }}><span aria-hidden="true" style={{ display: 'flex', color: cssVars.colors.primary }}><Icons.Check size={iconSizeValues.sm} /></span><span>{t(`pruefen.${k}`)}</span></li>
            ))}
          </ul>
          <div style={tastenStil}>
            <Button variant="secondary" icon={<Icons.SpeakerLow size={iconSizeValues.sm} />} disabled={!darfAendern} onClick={tippen} data-testid="ausgang-nochmal">{t('pruefen.nochmal')}</Button>
          </div>
        </div>
      ),
    };
  }
  if (neu?.art === 'gespielt') {
    return {
      pille: null,
      extra: (
        <div role="group" aria-label={t('pruefen.gruppe')} style={gruppeStil} data-testid="ausgang-rueckfrage">
          <p style={zeileStil}><span aria-hidden="true" style={{ display: 'flex' }}><Icons.SpeakerQuestion size={iconSizeValues.sm} /></span>{t('pruefen.gespielt', { zeit: neu.zeit })}</p>
          <p style={textStil}>{t('pruefen.frage')}</p>
          <div style={tastenStil}>
            <Button variant="secondary" disabled={!darfAendern} onClick={() => { setSchritt({ art: 'ruhe' }); void gehoert(feld); }} data-testid="ausgang-gehoert">{t('pruefen.gehoert')}</Button>
            <Button variant="secondary" disabled={!darfAendern} onClick={() => setSchritt({ art: 'nichtGehoert' })} data-testid="ausgang-nicht-gehoert">{t('pruefen.nichtGehoert')}</Button>
          </div>
        </div>
      ),
    };
  }
  const pille = (
    <StatusPille
      ton="info" rand="gestrichelt" symbol={<Icons.SpeakerQuestion size={iconSizeValues.xs} />} data-testid={`lautsprecher-feld-${feld}-pruefen`}
      aktion={darfAendern && !warten ? { art: 'ausloesen', onClick: tippen } : undefined}
    >
      {t('statuszeile.pruefen')}
    </StatusPille>
  );
  const meldung = neu?.art === 'text' ? <p style={{ ...textStil, color: cssVars.colors.textSecondary }} role="status" data-testid="ausgang-pruefen-meldung">{neu.text}</p> : null;
  return { pille, extra: warten ? <p style={{ ...textStil, color: cssVars.colors.textSecondary }} role="status" data-testid="ausgang-pruefen-laeuft">{t('testton.laeuft')}</p> : meldung };
}
