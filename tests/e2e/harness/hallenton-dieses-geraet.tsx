/**
 * Prüfstand für H4-9: der Abschnitt „Dieses Gerät“ im Unterpunkt „Hallenton“ – die echte Seitenleiste (`AdminSidebar`, ab 768 px), die echte
 * `HallentonSeiteAnsicht` mit dem echten `DiesesGeraetAbschnitt` (Einrichtung, Schalter, Rückfragen, Anleitung, Fußleiste); nur die Daten kommen
 * von Hand statt aus den Hooks. Daten wie im Mockup: Hallencup Süd, Feld 1/2, „Laptop Turnierleitung“, 14:02. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=leer|eingerichtet|bereit|abloesen|abgeloest|anleitung|wechseln` (H4-9) oder `lautstaerke0|schlafen|angehalten|anderesFenster|anhoerenFrage|gesperrt` (H4-10);
 * `&browser=chrome|edge|safari`. Zustand je Feld aus den echten Funktionen (`geraeteZustandAus`, `feldZustaende`, `hallAnzeige`, `baueGeraetBanner`), die Frage beim
 * Anhören aus dem echten Hook `useAnhoerenRueckfrage`; nur die Werte der Regler und die Tasten sind von Hand.
 */
import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../../src/i18n';
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

const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
const EIGEN = 'Laptop Turnierleitung';
const FALL = ['leer', 'eingerichtet', 'bereit', 'abloesen', 'abgeloest', 'anleitung', 'wechseln', 'lautstaerke0', 'schlafen', 'angehalten', 'anderesFenster', 'anhoerenFrage', 'gesperrt'] as const;
type Fall = (typeof FALL)[number];

function antwort(sprecher: ReadonlyArray<{ name: string; state: 'ready' | 'not_activated'; ich: boolean }>): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: sprecher.map((s) => ({
      field: 1, deviceName: s.name, isThisDevice: s.ich, state: s.state, assignedAt: 1, outputHint: false, hintAt: null, lastSeen: null, ageMs: 3000, test: null,
    })),
  };
}

/** Zustand des Spielers je Fall (die Töne gelten als geladen); der Zustand des Geräts und je Feld kommt aus den echten Funktionen. */
function lokalerZustand(fall: Fall): { zustand: FeldZustand; rolle: LaufzeitRolle } | null {
  const spieler = fall === 'eingerichtet' ? 'not_activated' : fall === 'lautstaerke0' ? 'volume_zero' : 'ready';
  const geraet = geraeteZustandAus({ geschlafen: fall === 'schlafen', spieler, ausgesetzt: false, taktFehler: false });
  const rolle: LaufzeitRolle = fall === 'anderesFenster' ? 'andererTab' : geraet === 'ready' || geraet === 'volume_zero' ? 'toent' : 'wartet';
  return { zustand: feldZustaende(geraet, [1], new Set())['field-1'], rolle };
}

/** Spiel 11 läuft auf Feld 1 (ein fester Verweis: der Hook hängt seine Funktion daran). */
const LAUFEND: ReadonlyMap<number, number> = new Map([[1, 11]]);
const EIGENE = new Set<Fall>(['eingerichtet', 'bereit', 'anleitung', 'lautstaerke0', 'schlafen', 'angehalten', 'anderesFenster', 'anhoerenFrage', 'gesperrt']);

/** Der Server-Stand und die lokale Lage dieses Geräts je Fall. */
function lage(fall: Fall): { server: HallStatusVoll; lokal: LokaleLage | null } {
  if (EIGENE.has(fall)) {
    const l = lokalerZustand(fall);
    const state = l?.zustand === 'ready' ? 'ready' : 'not_activated';
    return { server: antwort([{ name: EIGEN, state, ich: true }]), lokal: l === null ? null : { felder: [1], rolle: l.rolle, zustandJeFeld: { 'field-1': l.zustand } } };
  }
  switch (fall) {
    case 'abloesen':
    case 'abgeloest': return { server: antwort([{ name: 'Hallenmonitor Halle', state: 'ready', ich: false }]), lokal: null };
    default: return { server: antwort([]), lokal: null };
  }
}

export function Seite() {
  const { t } = useTranslation('hallenton');
  const params = new URLSearchParams(window.location.search);
  const fall = (FALL.find((f) => f === params.get('fall')) ?? 'leer');
  const browser = params.get('browser') ?? 'chrome';
  const { server, lokal } = lage(fall);
  const lagen: Record<number, LautsprecherLage> = Object.fromEntries(
    server.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, server.serverNow)]));
  const anzeige = hallAnzeige({ server: { stand: 'aktuell', felder: lagen, antwort: server }, lokal, angepfiffen: new Set(), lautsprecherBekannt: server.speakers.length > 0 });
  const sprecher = server.speakers.map((s) => ({ field: s.field, deviceName: s.deviceName }));
  const karten = baueFeldKarten({
    felder: [1, 2], anzeige, serverLagen: lagen, eigenerName: lokal === null ? null : EIGEN, lokalerZustand: lokal?.zustandJeFeld ?? {},
    uhrzeit: (ms) => formatUhrzeit(ms, 'de'), sprecher,
  });
  const status: Pick<HallStatus, 'stand' | 'antwort' | 'testtonAnfordern'> = { stand: 'aktuell', antwort: server, testtonAnfordern: () => Promise.resolve({ ok: false, grund: 'netz' }) };
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
  const rueckfrage = useAnhoerenRueckfrage(LAUFEND);
  const { fragen } = rueckfrage;
  useEffect(() => {
    if (fall === 'anhoerenFrage') {
      fragen('anhoeren', [1], aus);
    }
  }, [fall, fragen]);
  const abschnitt: GeraetAbschnitt = {
    modus, alteAbmeldung: null, oben: einrichtung || istLautsprecher, banner, verstanden: aus, angehaltenBestaetigen: aus,
    regler: istLautsprecher ? { lautstaerke: { abpfiff: fall === 'lautstaerke0' ? 0 : 80, halbzeit: 50, tor: 40 }, gesperrt: fall === 'gesperrt', onLautstaerke: aus, onAnhoeren: aus, hinweis: null } : null,
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
