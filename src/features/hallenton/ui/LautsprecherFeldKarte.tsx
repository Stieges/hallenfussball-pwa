/**
 * LautsprecherFeldKarte – die Karte je Feld im Unterpunkt „Hallenton“ (H4-4, @HT-039, @HT-016): Feldname, Zustand als
 * Marke (Symbol + Wort + Randart, Farbe nie allein), Gerät des Hallen-Lautsprechers und optional eine Pille daneben (z. B. „🔈? Prüfen“).
 * Nur Darstellung mit Props; „von einem anderen Gerät übernommen“ (@HT-015) und „abgemeldet“ (@HT-057) sind Zustände des eigenen Geräts („Dieses Gerät“, H4-6), nicht des Felds und stehen deshalb nicht hier; die Wortlaute kommen aus dem Namensraum `hallenton`. Den Zustand liefert später `hallAnzeige` (H4-5/H4-6).
 * „unbekannt“ gibt es in zwei Formen, die getrennt bleiben: `zustandUnbekannt` (der Server meldet einen Zustand, den dieser App-Stand
 * nicht kennt: nur „nicht bereit“ ohne Grund, @HT-039) und `statusUnbekannt` (die Verwaltung hat selbst kein Netz, @HT-041).
 */
import type { TFunction } from 'i18next';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { StatusPille, type StatusPilleRand, type StatusPilleTon } from '../../../components/ui/atoms/StatusPille';

export type FeldGrund = 'tonNichtAktiviert' | 'keineVerbindung' | 'hintergrund' | 'schlafenGelegt' | 'lautstaerkeNull' | 'ausgangVerloren' | 'ausgangBestaetigen';

export type FeldZustand =
  | { art: 'bereit' }
  | { art: 'nichtBereit'; grund: FeldGrund }
  | { art: 'zustandUnbekannt' }
  | { art: 'meldetSichNicht'; zuletzt: string }
  | { art: 'statusUnbekannt' }
  | { art: 'keinLautsprecher' };

export interface FeldGeraet {
  name: string;
  art: 'laptop' | 'monitor' | 'handy';
}

export interface LautsprecherFeldKarteProps {
  feld: string | number;
  zustand: FeldZustand;
  /** Gerät, das für das Feld tönt; ohne Angabe zeigt die Karte keine Geräte-Zeile. */
  geraet?: FeldGeraet;
  /** Zusatz neben dem Zustand (z. B. die Pille „Prüfen“). */
  pille?: ReactNode;
  'data-testid'?: string;
}

interface Aussehen { ton: StatusPilleTon; rand: StatusPilleRand; symbol: ReactNode }

const GROESSE = iconSizeValues.xs;
const AUSSEHEN: Record<FeldZustand['art'], Aussehen> = {
  bereit: { ton: 'ok', rand: 'fest', symbol: <Icons.CheckCircle size={GROESSE} /> },
  nichtBereit: { ton: 'warn', rand: 'fest', symbol: <Icons.AlertTriangle size={GROESSE} /> },
  zustandUnbekannt: { ton: 'warn', rand: 'fest', symbol: <Icons.AlertTriangle size={GROESSE} /> },
  meldetSichNicht: { ton: 'warn', rand: 'fest', symbol: <Icons.Clock size={GROESSE} /> },
  statusUnbekannt: { ton: 'neutral', rand: 'gestrichelt', symbol: <Icons.HelpCircle size={GROESSE} /> },
  keinLautsprecher: { ton: 'neutral', rand: 'fest', symbol: <Icons.MinusCircle size={GROESSE} /> },
};

const GERAET_SYMBOL: Record<FeldGeraet['art'], ReactElement> = {
  laptop: <Icons.Laptop size={iconSizeValues.sm} />,
  monitor: <Icons.Monitor size={iconSizeValues.sm} />,
  handy: <Icons.Phone size={iconSizeValues.sm} />,
};

const kartenStil: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
  padding: cssVars.spacing.md,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.lg,
  backgroundColor: cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
};
const kopfStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm };
const titelStil: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.titleMd, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.semibold };
const zustandStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.sm, minWidth: 0 };
const geraetStil: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, minWidth: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md, overflowWrap: 'break-word' };
const nameStil: CSSProperties = { color: cssVars.colors.textPrimary, fontWeight: cssVars.fontWeights.semibold };
const hinweisStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };

export function LautsprecherFeldKarte({ feld, zustand, geraet, pille, 'data-testid': testId = `lautsprecher-feld-${feld}` }: LautsprecherFeldKarteProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const aussehen = AUSSEHEN[zustand.art];
  const text = zustandText(zustand, t);
  return (
    <article style={kartenStil} data-testid={testId} data-zustand={zustand.art}>
      <div style={kopfStil}>
        <h3 style={titelStil}>{t('feld.titel', { feld })}</h3>
        <div style={zustandStil}>
          <StatusPille ton={aussehen.ton} rand={aussehen.rand} symbol={aussehen.symbol} data-testid={`${testId}-zustand`}>{text}</StatusPille>
          {pille}
        </div>
      </div>
      {geraet !== undefined ? (
        <div style={geraetStil} data-testid={`${testId}-geraet`}>
          <span style={{ display: 'flex', flex: 'none' }} aria-hidden="true">{GERAET_SYMBOL[geraet.art]}</span>
          <span>
            {t('feld.geraetLabel')} <strong style={nameStil}>{geraet.name}</strong>{geraet.art === 'monitor' ? ` ${t('feld.geraetZusatzMonitor')}` : ''}
          </span>
        </div>
      ) : null}
      {zustand.art === 'keinLautsprecher' ? <p style={hinweisStil}>{t('feld.keinLautsprecherHinweis')}</p> : null}
    </article>
  );
}

function zustandText(z: FeldZustand, t: TFunction<'hallenton'>): string {
  switch (z.art) {
    case 'nichtBereit': return t('feld.zustand.nichtBereit', { grund: t(`feld.grund.${z.grund}`) });
    case 'meldetSichNicht': return t('feld.zustand.meldetSichNicht', { zeit: z.zuletzt });
    default: return t(`feld.zustand.${z.art}`);
  }
}
