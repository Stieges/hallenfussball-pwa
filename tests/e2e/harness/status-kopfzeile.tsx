/**
 * Prüfstand für H4-5: die Statuszeile des Hallentons in den echten Kopfzeilen – `ManagementHeader` (Verwaltung) und
 * `CockpitSlimHeader` (Cockpit) mit dem Platz `statuszeile` – und der Streifen in einer Ansicht ohne Kopf. Die Zeile ist die echte
 * `HallStatusZeileAnsicht` (hallAnzeige → Einträge → StatusZeile), nur die Daten kommen von Hand statt aus den Hooks. Daten wie im
 * Mockup: Hallencup Süd, Feld 1/2, „Laptop Turnierleitung“, Probe als Platzhalter. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?ort=verwaltung|cockpit|streifen`; je Szenario ein Block mit `data-testid="szenario-<id>"`.
 */
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { AuthContext } from '../../../src/features/auth/context/authContextInstance';
import type { AuthContextValue } from '../../../src/features/auth/context/authContextValue';
import { RepositoryProvider } from '../../../src/core/contexts/RepositoryContext';
import { ToastProvider } from '../../../src/components/ui/Toast';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars, iconSizeValues } from '../../../src/design-tokens';
import { Icons } from '../../../src/components/ui/Icons';
import { ManagementHeader } from '../../../src/screens/ManagementChrome';
import { CockpitSlimHeader } from '../../../src/components/live-cockpit/frame/CockpitSlimHeader';
import { HallStatusZeileAnsicht } from '../../../src/features/hallenton/ui/HallStatusZeile';
import { hallAnzeige, type HallAnzeigeEingabe } from '../../../src/features/hallenton/hallAnzeige';
import type { LautsprecherLage } from '../../../src/features/hallenton/runtime/hallStatusAuswertung';
import type { StatusEintrag } from '../../../src/components/ui/molecules/statusZeileTypen';
import type { Tournament } from '../../../src/types/tournament';

// Angemeldete Turnierleitung (Olli): `AuthSection` im Kopf der Verwaltung braucht einen Provider; Anmelden und Registrieren sind hier ohne Wirkung
const angemeldet = { user: { id: 'olli', name: 'Olli', email: 'olli@example.org' }, isAuthenticated: true, isGuest: false, isLoading: false, connectionState: 'online', reconnect: () => Promise.resolve(true) } as unknown as AuthContextValue;
const TID = 'hallencup-sued';
const turnier = { id: TID, title: 'Hallencup Süd', ageClass: 'U11', date: '2026-11-21', location: { name: 'Sporthalle Süd' }, matches: [], teams: [], groups: [] } as unknown as Tournament;
const probe: StatusEintrag = { id: 'probe', rang: 'probe', ton: 'info', rand: 'gestrichelt', symbol: <Icons.Flask size={iconSizeValues.xs} />, text: 'Probe läuft', aktion: { art: 'navigiere', ziel: '/probe' } };
const bereit: LautsprecherLage = { art: 'bereit', pruefen: false };
const nicht: LautsprecherLage = { art: 'nichtBereit', grund: 'background', pruefen: false };
const server = (felder: Record<number, LautsprecherLage>, stand: 'aktuell' | 'unbekannt' = 'aktuell'): HallAnzeigeEingabe['server'] => ({ stand, felder, antwort: null });
const eigen = (zustand: 'slept' | 'not_activated' | 'keineVerbindung' | 'ready', rolle: 'wartet' | 'toent' | 'andererTab' = 'wartet', felder = [1]) => ({
  felder, rolle, zustandJeFeld: Object.fromEntries(felder.map((f) => [`field-${f}`, zustand])),
});
const lokalSchlafen = eigen('slept');

interface Szenario { id: string; titel: string; eingabe: HallAnzeigeEingabe; probe?: boolean }
const leer = (e: Partial<HallAnzeigeEingabe>): HallAnzeigeEingabe => ({ server: server({}), lokal: null, angepfiffen: new Set(), lautsprecherBekannt: false, ...e });
const SZENARIEN: Szenario[] = [
  { id: 'bereit', titel: 'Ein Eintrag: Feld 1 bereit', eingabe: leer({ server: server({ 1: bereit }) }) },
  { id: 'probe-bereit', titel: 'Probe läuft, Feld 1 bereit', eingabe: leer({ server: server({ 1: bereit }) }), probe: true },
  { id: 'stoerung-probe', titel: 'Feld 1 nicht bereit, Probe läuft', eingabe: leer({ server: server({ 1: nicht }) }), probe: true },
  { id: 'schlafen', titel: 'Am Lautsprecher-Gerät: schlafen gelegt', eingabe: leer({ server: server({ 1: bereit }), lokal: lokalSchlafen }), probe: true },
  { id: 'zwei-felder', titel: 'Feld 1 und 2 nicht bereit, Probe läuft', eingabe: leer({ server: server({ 1: nicht, 2: nicht }) }), probe: true },
  { id: 'nur-probe', titel: 'Kein Lautsprecher, Probe läuft', eingabe: leer({}), probe: true },
  { id: 'unbekannt', titel: 'Verwaltung ohne Netz', eingabe: leer({ server: server({}, 'unbekannt'), lautsprecherBekannt: true }), probe: true },
  { id: 'mehr', titel: 'Mehr als zwei Einträge', eingabe: leer({ server: server({ 1: nicht, 2: bereit, 3: { art: 'bereit', pruefen: true } }) }), probe: true },
  { id: 'ton-nicht-aktiv', titel: 'Am Lautsprecher-Gerät: Ton nicht aktiv (@HT-012)', eingabe: leer({ server: server({ 1: bereit }), lokal: eigen('not_activated') }), probe: true },
  { id: 'keiner', titel: 'Kein Eintrag', eingabe: leer({}) },
];
// Der Streifen zeigt nur den lokalen Zustand des eigenen Geräts (ohne Server, ohne Probe)
const STREIFEN: Szenario[] = [
  { id: 'ton-nicht-aktiv', titel: '@HT-012 Ton nicht aktiv – hier klicken', eingabe: leer({ lokal: eigen('not_activated') }) },
  { id: 'zwei-felder', titel: '@HT-012 zwei Felder, ein Gerät: ein Eintrag', eingabe: leer({ lokal: eigen('not_activated', 'wartet', [1, 2]) }) },
  { id: 'anderes-fenster', titel: '@HT-033 Zeile 8 läuft schon in einem anderen Fenster', eingabe: leer({ lokal: eigen('ready', 'andererTab') }) },
  { id: 'schlafen', titel: '@HT-037 schlafen gelegt', eingabe: leer({ lokal: eigen('slept') }) },
  { id: 'keine-verbindung', titel: '@HT-011 keine Verbindung', eingabe: leer({ lokal: eigen('keineVerbindung', 'toent') }) },
  { id: 'bereit', titel: 'bereit', eingabe: leer({ lokal: eigen('ready', 'toent') }) },
];

const zeile = (s: Szenario, testId: string) => (
  <HallStatusZeileAnsicht anzeige={hallAnzeige(s.eingabe)} tournamentId={TID} tonAktivieren={() => undefined} probe={s.probe ? probe : null} data-testid={testId} />
);
const rahmen = { border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.md, overflow: 'hidden', background: cssVars.colors.background } as const;
const titelStil = { margin: `${cssVars.spacing.md} 0 ${cssVars.spacing.xs}`, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary } as const;

export function Seite() {
  const ort = new URLSearchParams(window.location.search).get('ort') ?? 'verwaltung';
  return (
    <div style={{ padding: cssVars.spacing.sm, background: cssVars.colors.background, color: cssVars.colors.textPrimary, minHeight: '100vh' }}>
      {(ort === 'streifen' ? STREIFEN : SZENARIEN).map((s) => (
        <section key={s.id} data-testid={`szenario-${s.id}`}>
          <h2 style={titelStil}>{s.titel}</h2>
          <div style={rahmen}>
            {ort === 'verwaltung' && (
              <ManagementHeader
                tournament={turnier} isMobile={window.innerWidth < 768} activeTab="schedule" isSettingsDirty={false} onTabChange={() => undefined}
                onNavigateToLogin={() => undefined} onNavigateToRegister={() => undefined} onNavigateToProfile={() => undefined}
                statuszeile={zeile(s, `zeile-${s.id}`)}
              />
            )}
            {ort === 'cockpit' && (
              <CockpitSlimHeader
                tournamentId={TID} turnierName="Hallencup Süd" felder={2} feld={1} onFeld={() => undefined}
                verbindung={<span data-testid="verbindung">Online</span>} statuszeile={zeile(s, `zeile-${s.id}`)}
              />
            )}
            {ort === 'streifen' && (
              <>
                {zeile(s, `zeile-${s.id}`)}
                <div style={{ padding: cssVars.spacing.md }}><strong>Meine Turniere</strong> (Ansicht ohne Kopf, Inhalt unverändert)</div>
              </>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><AuthContext.Provider value={angemeldet}><ThemeProvider><RepositoryProvider user={null}><ToastProvider><Seite /></ToastProvider></RepositoryProvider></ThemeProvider></AuthContext.Provider></HashRouter>);
