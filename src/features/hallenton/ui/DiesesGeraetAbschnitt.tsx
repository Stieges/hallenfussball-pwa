/**
 * DiesesGeraetAbschnitt – „Dieses Gerät“ im Unterpunkt „Hallenton“ (H4-9; @HT-001, @HT-002, @HT-015, @HT-021, @HT-026, @HT-043, @HT-056). Nur Darstellung
 * des Zustands aus `useGeraetAbschnitt` (am Prüfstand der Bilder mit Hand-Daten gefüttert):
 * - Einrichtung (kein Hallen-Lautsprecher im Turnier): die vier Schritte, der Schalter steht in Schritt 2.
 * - Sonst der Abschnitt: Banner (Stand dieses Geräts, Spur „von einem anderen Gerät übernommen“), Gerätename, Schalter, Feldwahl, „Läuft als“.
 * - Danach die Anleitung gegen das Schlafenlegen; unten die feste Fußleiste „Ton aktivieren“, solange der Browser noch einen Klick braucht.
 * Nach dem Turnierende (`darfAendern` falsch): lesbar, kein Schalter (@HT-046).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import type { GeraetAbschnitt } from './useGeraetAbschnitt';
import { AnleitungSchlafenlegen } from './AnleitungSchlafenlegen';
import { erkenneBrowser } from './browserErkennung';
import { EinrichtungSchritte } from './EinrichtungSchritte';
import { GeraetRueckfragen } from './GeraetRueckfragen';
import { GeraetSchalter } from './GeraetSchalter';
import { LEISTE_PLATZ, TonAktivierenLeiste } from './TonAktivierenLeiste';

export interface DiesesGeraetAbschnittProps {
  abschnitt: GeraetAbschnitt;
  darfAendern: boolean;
  /** Seitenleiste links (Breite in px), neben der die Fußleiste erst beginnt; ohne Seitenleiste 0. */
  leisteLinks?: number;
  /** Adresse dieser App zum Kopieren; Standard: der Host des Browsers. */
  adresse?: string;
  /** Browser-Kennung für die vorgewählte Anleitung; Standard: die des Browsers. */
  browserKennung?: string;
}

const abschnittStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const kastenStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.md, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg, backgroundColor: cssVars.colors.surface, color: cssVars.colors.textPrimary };
const textStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const faktenStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.xs, margin: 0, fontSize: cssVars.fontSizes.md };

function Banner({ abschnitt }: { abschnitt: GeraetAbschnitt }): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <>
      {abschnitt.banner.map((b) => (
        <InlineNotice
          key={b.art}
          tone={b.ton}
          data-testid={`geraet-banner-${b.art}`}
          footer={b.verstehen ? <div><Button variant="secondary" size="sm" onClick={abschnitt.verstanden} data-testid="geraet-verstanden">{t('geraet.verstanden')}</Button></div> : undefined}
        >
          <strong>{b.titel}</strong>
          <span>{b.text}</span>
        </InlineNotice>
      ))}
    </>
  );
}

function LaeuftAls({ installiert }: { installiert: boolean }): ReactElement {
  const { t } = useTranslation('hallenton');
  return (
    <dl style={faktenStil} data-testid="geraet-laeuft-als">
      <dt style={{ color: cssVars.colors.textSecondary }}>{t('geraet.laeuftAls')}</dt>
      <dd style={{ margin: 0, fontWeight: cssVars.fontWeights.bold }}>
        {installiert ? t('geraet.installierteApp') : `${t('geraet.browserTab')} – ${t('geraet.besserInstallieren')}`}
      </dd>
    </dl>
  );
}

export function DiesesGeraetAbschnitt({ abschnitt: a, darfAendern, leisteLinks = 0, adresse, browserKennung }: DiesesGeraetAbschnittProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const schalter = (mitName: boolean): ReactElement => (
    <GeraetSchalter
      an={a.an} felder={a.felder} gewaehlt={a.gewaehlt} name={a.name} onName={a.setzeName} onNameVerlassen={a.nameVerlassen}
      onSchalter={a.schalterUmlegen} onFeld={a.feldUmschalten} beschaeftigt={a.beschaeftigt} mitName={mitName} handy={a.handy}
      fehler={a.fehler === null ? null : t(`geraet.fehler.${a.fehler}`)}
    />
  );
  const anleitung = (
    <AnleitungSchlafenlegen
      adresse={adresse ?? (typeof window === 'undefined' ? '' : window.location.host)}
      browser={erkenneBrowser(browserKennung ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent))}
    />
  );
  const sichtbareBanner = darfAendern ? a.banner : a.banner.filter((b) => b.art !== 'keinLautsprecher');
  return (
    <>
      {a.modus === 'einrichtung' ? (
        <>
          <EinrichtungSchritte
            installiert={a.installiert} installAngebot={a.installAngebot} onInstallieren={a.installieren}
            schalterErledigt={a.schalterErledigt} tonErledigt={a.tonErledigt} schalter={schalter(true)} gesperrt={!darfAendern}
          />
          {anleitung}
        </>
      ) : (
        <section style={abschnittStil} aria-labelledby="hallenton-geraet-titel" data-testid="hallenton-dieses-geraet">
          <h2 id="hallenton-geraet-titel" style={{ margin: 0, fontSize: cssVars.fontSizes.titleLg, fontWeight: cssVars.fontWeights.semibold }}>{t('geraet.titel')}</h2>
          <div style={kastenStil}>
            <Banner abschnitt={{ ...a, banner: sichtbareBanner }} />
            {darfAendern ? schalter(true) : <p style={textStil} data-testid="geraet-gesperrt">{t('geraet.gesperrt')}</p>}
            <LaeuftAls installiert={a.installiert} />
          </div>
          {anleitung}
        </section>
      )}
      {a.tonNoetig ? (
        <>
          <div aria-hidden="true" style={{ height: LEISTE_PLATZ }} />
          <TonAktivierenLeiste onAktivieren={a.tonAktivieren} links={leisteLinks} />
        </>
      ) : null}
      <GeraetRueckfragen
        abloesen={a.abloesen} wechseln={a.wechseln} onAbloesen={a.abloesenBestaetigen} onAbloesenAbbrechen={a.abloesenAbbrechen}
        onWechseln={a.wechselnBestaetigen} onWechselnAbbrechen={a.wechselnAbbrechen}
      />
    </>
  );
}
