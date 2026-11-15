/**
 * Prüfstand für H4-9: der Abschnitt „Dieses Gerät“ im Unterpunkt „Hallenton“ – die echte Seitenleiste (`AdminSidebar`, ab 768 px), die echte
 * `HallentonSeiteAnsicht` mit dem echten `DiesesGeraetAbschnitt` (Einrichtung, Schalter, Rückfragen, Anleitung, Fußleiste); nur die Daten kommen
 * von Hand statt aus den Hooks. Daten wie im Mockup: Hallencup Süd, Feld 1/2, „Laptop Turnierleitung“, 14:02. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=leer|eingerichtet|bereit|abloesen|abgeloest|anleitung|wechseln` (H4-9) oder `lautstaerke0|schlafen|angehalten|anderesFenster|anhoerenFrage|gesperrt` (H4-10);
 * `&browser=chrome|edge|safari`. Zustand je Feld aus den echten Funktionen (`geraeteZustandAus`, `feldZustaende`, `hallAnzeige`, `baueGeraetBanner`), die Frage beim
 * Anhören aus dem echten Hook `useAnhoerenRueckfrage`; nur die Werte der Regler und die Tasten sind von Hand.
 * H4-11 (Ausgang): `ausgangStandard|ausgangGewaehlt|ausgangMikrofon|ausgangVerloren|ausgangBestaetigen|ausgangOhneWahl|ausgangLang` und `pruefenPille|pruefenFrage|pruefenLeer`
 * (`&lang=en`): die echte Zeile „Ausgang“ mit dem echten Hook `useHallAusgang`, dem echten Wächter und gefälschten `mediaDevices`/`AudioContext` (Test-Doppel aus H4-6);
 * der Zustand des Geräts folgt aus der Lage des Ausgangs über die echten Funktionen; „Ändern“, Mikrofon, Wahl klickt der Test wie Olli. „Prüfen“: die echte Karte mit dem
 * echten `useTesttonHalle`; nur der Server-Aufruf ist gefälscht (der Testton ist 14:02 gespielt).
 */
import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { AdminSidebar } from '../../../src/features/tournament-admin/components/AdminSidebar';
import { ADMIN_LAYOUT } from '../../../src/features/tournament-admin/constants/admin.constants';
import { CategoryPage } from '../../../src/features/tournament-admin/categories/shared';
import { HallentonSeiteAnsicht } from '../../../src/features/hallenton/ui/HallentonSeite';
import { DiesesGeraetAbschnitt } from '../../../src/features/hallenton/ui/DiesesGeraetAbschnitt';
import { hallAnzeige } from '../../../src/features/hallenton/hallAnzeige';
import { lautsprecherLage, type LautsprecherLage } from '../../../src/features/hallenton/runtime/hallStatusAuswertung';
import { baueFeldKarten } from '../../../src/features/hallenton/ui/feldKarten';
import { baueGeraetBanner } from '../../../src/features/hallenton/ui/geraetBanner';
import { geraeteZustandAus, feldZustaende, type FeldZustand, type LaufzeitRolle } from '../../../src/features/hallenton/runtime/laufzeitZustand';
import { useAnhoerenRueckfrage } from '../../../src/features/hallenton/ui/useAnhoerenRueckfrage';
import { waehleModus, type GeraetAbschnitt } from '../../../src/features/hallenton/ui/useGeraetAbschnitt';
import { formatUhrzeit } from '../../../src/features/hallenton/ui/uhrzeit';
import type { HallStatus } from '../../../src/features/hallenton/useHallStatus';
import type { HallStatusVoll } from '../../../src/core/repositories/hallentonRpc';
import type { LokaleLage } from '../../../src/features/hallenton/hallAnzeige';
import { useState } from 'react';
import type { AusgangLage } from '../../../src/core/hallenton';
import { useHallAusgang } from '../../../src/features/hallenton/useHallAusgang';
import { __setzeAusgangFuerTests } from '../../../src/features/hallenton/runtime/ausgang/browserAusgang';
import { erzeugeAusgangListe } from '../../../src/features/hallenton/runtime/ausgang/ausgangListe';
import { erzeugeAusgangWaechter } from '../../../src/features/hallenton/runtime/ausgang/ausgangWaechter';
import { AUSGANG_SCHLUESSEL, erzeugeAusgangWahl } from '../../../src/features/hallenton/runtime/ausgang/ausgangWahl';
import { __setzeGeraetFuerTests } from '../../../src/features/hallenton/lautsprecherGeraet';
import { FalscheMedienGeraete, type FalscherAusgang } from '../../../src/test/hallenton/falscheMedienGeraete';
import { FalscherSpeicher } from '../../../src/test/hallenton/falschesGeraet';
import type { HallTonSpieler } from '../../../src/features/hallenton/runtime/hallTonSpieler';

const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
const EIGEN = 'Laptop Turnierleitung';
const AUSGANG_FAELLE = ['ausgangStandard', 'ausgangGewaehlt', 'ausgangMikrofon', 'ausgangVerloren', 'ausgangBestaetigen', 'ausgangOhneWahl', 'ausgangLang'] as const;
const PRUEFEN_FAELLE = ['pruefenPille', 'pruefenFrage', 'pruefenLeer'] as const;
const FALL = ['leer', 'eingerichtet', 'bereit', 'abloesen', 'abgeloest', 'anleitung', 'wechseln', 'lautstaerke0', 'schlafen', 'angehalten', 'anderesFenster', 'anhoerenFrage', 'gesperrt', 'lautstaerke100', ...AUSGANG_FAELLE, ...PRUEFEN_FAELLE] as const;
type Fall = (typeof FALL)[number];

interface Sprecher { name: string; state: 'ready' | 'not_activated' | 'output_lost' | 'output_unconfirmed'; ich: boolean; hinweis?: boolean; gespielt?: boolean }
const GESPIELT_1402 = new Date(2026, 10, 21, 14, 2, 0).getTime();

function antwort(sprecher: readonly Sprecher[]): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: sprecher.map((s) => ({
      field: 1, deviceName: s.name, isThisDevice: s.ich, state: s.state, assignedAt: 1, outputHint: s.hinweis === true, hintAt: s.hinweis === true ? 1 : null, lastSeen: null, ageMs: 3000,
      test: s.gespielt === true ? { testId: 'x1', requestedAt: 1, playedAt: GESPIELT_1402 } : null,
    })),
  };
}

/** Zustand des Spielers je Fall (die Töne gelten als geladen); der Zustand des Geräts und je Feld kommt aus den echten Funktionen. */
function lokalerZustand(fall: Fall, ausgangLage: AusgangLage): { zustand: FeldZustand; rolle: LaufzeitRolle } | null {
  // H4-11: der Ausgang geht vor `not_activated` (wie im Spieler, `istAusgangsZustand`); die Lage kommt vom echten Wächter
  const ausgangZustand = ausgangLage === 'lost' ? 'output_lost' : ausgangLage === 'unconfirmed' ? 'output_unconfirmed' : null;
  const spieler = ausgangZustand ?? (fall === 'eingerichtet' ? 'not_activated' : fall === 'lautstaerke0' ? 'volume_zero' : 'ready');
  const geraet = geraeteZustandAus({ geschlafen: fall === 'schlafen', spieler, ausgesetzt: false, taktFehler: false });
  const rolle: LaufzeitRolle = fall === 'anderesFenster' ? 'andererTab' : geraet === 'ready' || geraet === 'volume_zero' ? 'toent' : 'wartet';
  return { zustand: feldZustaende(geraet, [1], new Set())['field-1'], rolle };
}

/** Spiel 11 läuft auf Feld 1 (ein fester Verweis: der Hook hängt seine Funktion daran). */
const LAUFEND: ReadonlyMap<number, number> = new Map([[1, 11]]);
const KEIN_SPIEL: ReadonlyMap<number, number> = new Map();
const EIGENE = new Set<Fall>(['eingerichtet', 'bereit', 'anleitung', 'lautstaerke0', 'schlafen', 'angehalten', 'anderesFenster', 'anhoerenFrage', 'gesperrt', 'lautstaerke100', ...AUSGANG_FAELLE, ...PRUEFEN_FAELLE]);

/** Der Server-Stand und die lokale Lage dieses Geräts je Fall. */
function lage(fall: Fall, ausgangLage: AusgangLage, pruefen: { hinweis: boolean; gespielt: boolean }): { server: HallStatusVoll; lokal: LokaleLage | null } {
  if (EIGENE.has(fall)) {
    const l = lokalerZustand(fall, ausgangLage);
    const state = l?.zustand === 'ready' ? 'ready' : l?.zustand === 'output_lost' || l?.zustand === 'output_unconfirmed' ? l.zustand : 'not_activated';
    return { server: antwort([{ name: EIGEN, state, ich: true, hinweis: pruefen.hinweis, gespielt: pruefen.gespielt }]), lokal: l === null ? null : { felder: [1], rolle: l.rolle, zustandJeFeld: { 'field-1': l.zustand } } };
  }
  switch (fall) {
    case 'abloesen':
    case 'abgeloest': return { server: antwort([{ name: 'Hallenmonitor Halle', state: 'ready', ich: false }]), lokal: null };
    default: return { server: antwort([]), lokal: null };
  }
}

/** Die sechs Ausgänge des Mockups (Hallencup Süd), das Dock steht mit Kennung, Name und Gruppe da; die Kennungen sind absichtlich ungewöhnlich (der Test sucht sie in den Attributen). */
const DOCK_NAME = 'ThinkPad Thunderbolt 3 Dock USB Audio';
const LANGER_NAME = 'ThinkPad Thunderbolt 3 Dock USB Audio Hallen 2'; // 50 Zeichen (Randfall)
const AUSGAENGE_MOCKUP = (dockName: string): FalscherAusgang[] => [
  { id: 'default', name: 'Standard - MacBook Pro-Lautsprecher', gruppe: 'gruppe-mac-7f3a' },
  { id: 'kennung-dock-91c2', name: dockName, gruppe: 'gruppe-dock-44b1' },
  { id: 'kennung-mac-17d0', name: 'MacBook Pro-Lautsprecher', gruppe: 'gruppe-mac-7f3a' },
  { id: 'kennung-poly-52e8', name: 'Poly VFOCUS2 Series (Bluetooth)', gruppe: 'gruppe-poly-0a9c' },
  { id: 'kennung-lg-83b6', name: 'LG Ultra HD (DisplayPort)', gruppe: 'gruppe-lg-6d25' },
  { id: 'kennung-teams-2c71', name: 'Microsoft Teams Audio Device (Virtual)', gruppe: 'gruppe-teams-b840' },
];

declare global {
  interface Window { __ausgangPruefstand?: { medien: FalscheMedienGeraete; speicher: FalscherSpeicher; aktivieren: number; setSinkIdAufrufe: string[] } }
}

/** Baut den Ausgang dieses Prüfstands (echter Wächter, gefälschte Browser-Bausteine) VOR dem ersten Zeichnen; Sprache aus `?lang=`. */
function richteAusgangEin(): void {
  const params = new URLSearchParams(window.location.search);
  const fall = params.get('fall') ?? 'leer';
  if (params.get('lang') === 'en') { void i18n.changeLanguage('en'); }
  const medien = new FalscheMedienGeraete(AUSGAENGE_MOCKUP(fall === 'ausgangLang' ? LANGER_NAME : DOCK_NAME));
  medien.ablehnen = params.get('ablehnen') === '1';
  const speicher = new FalscherSpeicher();
  const mitWahl = ['ausgangGewaehlt', 'ausgangVerloren', 'ausgangBestaetigen', 'ausgangLang'].includes(fall);
  if (mitWahl) {
    const dock = medien.ausgaenge[1];
    speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify({ id: dock.id, name: dock.name, gruppe: dock.gruppe }));
    medien.erlaubt = fall !== 'ausgangBestaetigen'; // „Bestätigen“: neu geladen, „Nur dieses Mal“ ist vorbei
    medien.dauerhaft = true;
  }
  if (fall === 'ausgangVerloren') {
    medien.abziehen('kennung-dock-91c2', false); // das Dock ist weg, bevor der Wächter zum ersten Mal liest
  }
  const mitSetSinkId = fall !== 'ausgangOhneWahl';
  const kontext = class { setSinkId(): Promise<void> { return Promise.resolve(); } };
  const ohne = class { resume(): Promise<void> { return Promise.resolve(); } };
  Object.defineProperty(window, 'AudioContext', { value: mitSetSinkId ? kontext : ohne, configurable: true, writable: true });
  const pruefstand = { medien, speicher, aktivieren: 0, setSinkIdAufrufe: [] as string[] };
  window.__ausgangPruefstand = pruefstand;
  __setzeGeraetFuerTests({ spieler: { aktivieren: () => { pruefstand.aktivieren += 1; return Promise.resolve(true); } } as unknown as HallTonSpieler });
  const liste = erzeugeAusgangListe({ geraete: medien, berechtigungen: medien });
  const wahl = erzeugeAusgangWahl({ speicher, seite: null });
  __setzeAusgangFuerTests({ liste, wahl, waechter: erzeugeAusgangWaechter({ liste, wahl }) });
}
richteAusgangEin();

export function Seite() {
  const { t } = useTranslation('hallenton');
  const params = new URLSearchParams(window.location.search);
  const fall = (FALL.find((f) => f === params.get('fall')) ?? 'leer');
  const browser = params.get('browser') ?? 'chrome';
  const ausgangHook = useHallAusgang(); // der echte Hook; liest beim Einbinden nichts
  const [hinweis, setHinweis] = useState(fall === 'pruefenPille' || fall === 'pruefenFrage');
  const [gespielt, setGespielt] = useState(false);
  const { server, lokal } = lage(fall, ausgangHook.zustand, { hinweis, gespielt });
  const lagen: Record<number, LautsprecherLage> = Object.fromEntries(
    server.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, server.serverNow)]));
  const anzeige = hallAnzeige({ server: { stand: 'aktuell', felder: lagen, antwort: server }, lokal, angepfiffen: new Set(), lautsprecherBekannt: server.speakers.length > 0 });
  const sprecher = server.speakers.map((s) => ({ field: s.field, deviceName: s.deviceName }));
  const karten = baueFeldKarten({
    felder: [1, 2], anzeige, serverLagen: lagen, eigenerName: lokal === null ? null : EIGEN, lokalerZustand: lokal?.zustandJeFeld ?? {},
    uhrzeit: (ms) => formatUhrzeit(ms, i18n.language), sprecher,
  });
  const status: Pick<HallStatus, 'stand' | 'antwort' | 'testtonAnfordern' | 'gehoert'> = {
    stand: 'aktuell', antwort: server,
    // nur der Server-Aufruf ist gefälscht: der Testton ist um 14:02 gespielt, „Gehört“ nimmt den Hinweis weg
    testtonAnfordern: () => { window.setTimeout(() => setGespielt(true), 0); return Promise.resolve({ ok: true, status: 'requested', testId: 'x1', requestedAt: 1, serverNow: SERVER_JETZT }); },
    gehoert: () => { setHinweis(false); return Promise.resolve({ ok: true, status: 'ok', serverNow: SERVER_JETZT } as never); },
  };
  const istLautsprecher = lokal !== null;
  const abgeloest = fall === 'abgeloest' ? { felder: [{ feld: 1, art: 'abgeloest' as const }], um: SERVER_JETZT } : null;
  const banner = baueGeraetBanner({
    rolle: istLautsprecher ? 'diesesTurnier' : 'keiner', felder: istLautsprecher ? [1] : [], name: istLautsprecher ? EIGEN : null, abgeloest,
    eigeneAnzeige: anzeige.felder.filter((f) => f.eigenesGeraet), karten,
    sprecherName: (feld) => server.speakers.find((s) => s.field === feld && !s.isThisDevice)?.deviceName, angehalten: fall === 'angehalten', t,
  });
  // Modus wie im echten Hook (`waehleModus`), nicht von Hand (B8): „wechseln“ ist ein Turnier ohne Lautsprecher, also die Einrichtung
  const modus = waehleModus({ istLautsprecher, keinLautsprecherImTurnier: karten.every((k) => k.zustand.art === 'keinLautsprecher'), standAktuell: true, abgeloest: abgeloest !== null });
  const einrichtung = modus === 'einrichtung';
  const aus = () => undefined;
  // Spiel 11 läuft auf Feld 1: die Rückfrage vor „Anhören“ kommt aus dem echten Hook, geöffnet wie ein Klick auf „Anhören“ (Abpfiff)
  const rueckfrage = useAnhoerenRueckfrage(fall.startsWith('pruefen') ? KEIN_SPIEL : LAUFEND); // „Prüfen“: auf Feld 1 läuft kein Spiel (@HT-049)
  const { fragen } = rueckfrage;
  useEffect(() => {
    if (fall === 'anhoerenFrage') {
      fragen('anhoeren', [1], aus);
    }
  }, [fall, fragen]);
  const abschnitt: GeraetAbschnitt = {
    modus, alteAbmeldung: null, oben: einrichtung || istLautsprecher, banner, verstanden: aus, angehaltenBestaetigen: aus,
    ausgang: istLautsprecher ? ausgangHook : null,
    regler: istLautsprecher ? { lautstaerke: { abpfiff: fall === 'lautstaerke0' ? 0 : fall === 'lautstaerke100' ? 100 : 80, halbzeit: 50, tor: 40 }, gesperrt: fall === 'gesperrt', onLautstaerke: aus, onAnhoeren: aus, hinweis: null } : null,
    felder: [1, 2], gewaehlt: istLautsprecher ? [1] : [], an: istLautsprecher || fall === 'abloesen' || fall === 'wechseln', name: EIGEN, setzeName: aus, nameVerlassen: aus,
    schalterUmlegen: aus, feldUmschalten: aus, beschaeftigt: false, fehler: null, handy: false, installiert: fall !== 'leer', installAngebot: false, installieren: aus,
    schalterErledigt: istLautsprecher, tonErledigt: fall === 'bereit' || fall === 'anleitung' || fall === 'angehalten', tonNoetig: fall === 'eingerichtet' || fall === 'schlafen', tonAktivieren: aus,
    abloesen: fall === 'abloesen' ? { felder: [1], belegt: [{ field: 1, deviceName: 'Hallenmonitor Halle' }], eigenerName: EIGEN } : null,
    wechseln: fall === 'wechseln' ? { turnierName: 'Hallencup Süd' } : null,
    abloesenBestaetigen: aus, abloesenAbbrechen: aus, wechselnBestaetigen: aus, wechselnAbbrechen: aus,
  };
  const breit = window.innerWidth >= 768;
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: cssVars.colors.background, color: cssVars.colors.textPrimary }}>
      {breit ? <AdminSidebar activeCategory="hallenton" onNavigate={aus} onBackToTournament={aus} /> : null}
      <main style={{ flex: 1, minWidth: 0, padding: breit ? cssVars.spacing.lg : cssVars.spacing.md, maxWidth: 800 }}>
        <CategoryPage icon="🔊" title="Hallenton" description="Lautsprecher, Abpfiff, Halbzeit">
          <HallentonSeiteAnsicht
            karten={karten} keinLautsprecherImTurnier={karten.every((k) => k.zustand.art === 'keinLautsprecher')} status={status}
            darfAendern={fall !== 'gesperrt'} abgeschlossen={fall === 'gesperrt'} hierAnhoeren={aus} geraetName={istLautsprecher ? EIGEN : null} rueckfrage={rueckfrage}
            geraet={<DiesesGeraetAbschnitt abschnitt={abschnitt} darfAendern={fall !== 'gesperrt'} leisteLinks={breit ? ADMIN_LAYOUT.sidebarWidth : 0} adresse="hallenfussball-pwa.vercel.app" browserKennung={browser === 'edge' ? 'Edg/120' : browser === 'safari' ? 'Version/17 Safari/605' : 'Chrome/120'} />}
            geraetOben={abschnitt.oben}
          />
        </CategoryPage>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><ThemeProvider><Seite /></ThemeProvider></HashRouter>);
