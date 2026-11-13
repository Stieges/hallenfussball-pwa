/**
 * Prüfstand für die Bausteine des Hallentons (H4-4): `StatusZeile` mit 1, 2 und 4 Einträgen und drei `LautsprecherFeldKarte`n,
 * mit den echten Komponenten, Design-Tokens, Texten aus dem Namensraum `hallenton` und Hell/Dunkel über den echten ThemeProvider.
 * Daten wie im Mockup: Hallencup Süd, Feld 1 und 2, „Laptop Turnierleitung“, 14:02. Die Einträge baut diese Seite von Hand nach;
 * den Adapter (`HallStatusZeile`) gibt es erst mit H4-5. Navigation steht in `window.__ziele`. Nur Testumgebung, nicht Teil des Builds.
 */
import ReactDOM from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars, iconSizeValues } from '../../../src/design-tokens';
import { Icons } from '../../../src/components/ui/Icons';
import { StatusPille } from '../../../src/components/ui/atoms/StatusPille';
import { StatusZeile, type StatusEintrag } from '../../../src/components/ui/molecules/StatusZeile';
import { LautsprecherFeldKarte } from '../../../src/features/hallenton/ui/LautsprecherFeldKarte';

declare global {
  interface Window { __ziele: string[] }
}
window.__ziele = [];

const ZIEL = '/tournament/hallencup-sued/admin/hallenton';
const ICON = iconSizeValues.xs;

export function Seite() {
  const { t } = useTranslation('hallenton');
  const { t: tCommon } = useTranslation('common');
  const nav = { art: 'navigiere', ziel: ZIEL } as const;
  const bereitFeld = (feld: number): StatusEintrag => ({
    id: `bereit${feld}`, rang: 'bereit', reihe: feld, ton: 'ok', symbol: <Icons.Speaker size={ICON} />,
    text: t('statuszeile.bereit', { feld }), kurz: t('statuszeile.bereitKurz', { feld }), lesetext: t('statuszeile.bereit', { feld }), aktion: nav,
  });
  const bereit = bereitFeld(1);
  const nicht: StatusEintrag = {
    id: 'nicht', rang: 'stoerung', reihe: 1, ton: 'warn', symbol: <Icons.SpeakerOff size={ICON} />,
    text: t('statuszeile.nichtBereit', { feld: 1 }), kurz: t('statuszeile.nichtBereitKurz', { feld: 1 }), lesetext: t('statuszeile.nichtBereit', { feld: 1 }), aktion: nav,
  };
  // Platzhalter der Probe-Sitzung: Text und Symbol liefert später sie
  const probe: StatusEintrag = {
    id: 'probe', rang: 'probe', ton: 'info', rand: 'gestrichelt', symbol: <Icons.Flask size={ICON} />, text: 'Probe läuft', aktion: { art: 'navigiere', ziel: '/probe' },
  };
  const pruefen: StatusEintrag = {
    id: 'pruefen', rang: 'hinweis', ton: 'info', rand: 'gestrichelt', symbol: <Icons.SpeakerQuestion size={ICON} />,
    text: t('statuszeile.pruefen'), lesetext: t('statuszeile.pruefenLesetext', { feld: 1 }), aktion: { art: 'ausloesen', onClick: () => { window.__ziele.push('pruefen'); } },
  };
  const weitereText = (n: number) => t('statuszeile.weitere', { count: n });
  const onNavigiere = (ziel: string) => { window.__ziele.push(ziel); };
  const rahmen = { border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.md, overflow: 'hidden' } as const;
  const titel = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary } as const;
  return (
    <div style={{ padding: cssVars.spacing.md, background: cssVars.colors.background, color: cssVars.colors.textPrimary, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md }}>
      <h1 style={{ margin: 0, fontSize: cssVars.fontSizes.titleMd }}>Hallencup Süd</h1>
      <p style={titel}>Ein Eintrag</p>
      <div style={rahmen}><StatusZeile data-testid="zeile-1" eintraege={[bereit]} weitereText={weitereText} wenigerText={t('statuszeile.weniger')} onNavigiere={onNavigiere} label={tCommon('statusZeile.titel')} /></div>
      <p style={titel}>Zwei Einträge (Probe, bereit)</p>
      <div style={rahmen}><StatusZeile data-testid="zeile-2" eintraege={[bereit, probe]} weitereText={weitereText} wenigerText={t('statuszeile.weniger')} onNavigiere={onNavigiere} label={tCommon('statusZeile.titel')} /></div>
      <p style={titel}>Zwei Einträge, bereit mit Hinweis „Prüfen“ daneben</p>
      <div style={rahmen}><StatusZeile data-testid="zeile-2p" eintraege={[{ ...bereit, daneben: pruefen }, probe]} weitereText={weitereText} wenigerText={t('statuszeile.weniger')} onNavigiere={onNavigiere} label={tCommon('statusZeile.titel')} /></div>
      <p style={titel}>Vier Einträge (Feld 1 nicht bereit, Probe, Feld 2 bereit mit „Prüfen“ daneben, Feld 3 bereit)</p>
      <div style={rahmen}><StatusZeile data-testid="zeile-4" eintraege={[nicht, probe, { ...bereitFeld(2), daneben: pruefen }, bereitFeld(3)]} weitereText={weitereText} wenigerText={t('statuszeile.weniger')} onNavigiere={onNavigiere} label={tCommon('statusZeile.titel')} /></div>
      <p style={titel}>Feldkarten</p>
      <LautsprecherFeldKarte feld={1} zustand={{ art: 'bereit' }} geraet={{ name: 'Laptop Turnierleitung', art: 'laptop' }}
        pille={<StatusPille ton="info" rand="gestrichelt" symbol={<Icons.SpeakerQuestion size={ICON} />} aktion={{ art: 'ausloesen', onClick: () => undefined }}>{t('statuszeile.pruefen')}</StatusPille>} />
      <LautsprecherFeldKarte feld={1} zustand={{ art: 'nichtBereit', grund: 'tonNichtAktiviert' }} geraet={{ name: 'Laptop Turnierleitung', art: 'laptop' }} data-testid="karte-nicht-bereit" />
      <LautsprecherFeldKarte feld={2} zustand={{ art: 'meldetSichNicht', zuletzt: '14:02' }} geraet={{ name: 'Hallenmonitor Halle', art: 'monitor' }} data-testid="karte-still" />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<ThemeProvider><Seite /></ThemeProvider>);
