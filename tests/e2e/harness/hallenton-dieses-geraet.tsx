/**
 * Prüfstand für H4-9: der Abschnitt „Dieses Gerät“ im Unterpunkt „Hallenton“ – die echte Seitenleiste (`AdminSidebar`, ab 768 px), die echte
 * `HallentonSeiteAnsicht` mit dem echten `DiesesGeraetAbschnitt` (Einrichtung, Schalter, Rückfragen, Anleitung, Fußleiste); nur die Daten kommen
 * von Hand statt aus den Hooks. Daten wie im Mockup: Hallencup Süd, Feld 1/2, „Laptop Turnierleitung“, 14:02. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=leer|eingerichtet|bereit|abloesen|abgeloest|anleitung|wechseln`, `&ton=` nicht nötig; `&browser=chrome|edge|safari`.
 */
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
import { waehleModus, type GeraetAbschnitt } from '../../../src/features/hallenton/ui/useGeraetAbschnitt';
import { formatUhrzeit } from '../../../src/features/hallenton/ui/uhrzeit';
import type { HallStatus } from '../../../src/features/hallenton/useHallStatus';
import type { HallStatusVoll } from '../../../src/core/repositories/hallentonRpc';
import type { LokaleLage } from '../../../src/features/hallenton/hallAnzeige';

const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
const EIGEN = 'Laptop Turnierleitung';
const FALL = ['leer', 'eingerichtet', 'bereit', 'abloesen', 'abgeloest', 'anleitung', 'wechseln'] as const;
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

/** Der Server-Stand und die lokale Lage dieses Geräts je Fall. */
function lage(fall: Fall): { server: HallStatusVoll; lokal: LokaleLage | null } {
  switch (fall) {
    case 'eingerichtet': return { server: antwort([{ name: EIGEN, state: 'not_activated', ich: true }]), lokal: { felder: [1], rolle: 'wartet', zustandJeFeld: { 'field-1': 'not_activated' } } };
    case 'bereit':
    case 'anleitung': return { server: antwort([{ name: EIGEN, state: 'ready', ich: true }]), lokal: { felder: [1], rolle: 'toent', zustandJeFeld: { 'field-1': 'ready' } } };
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
    sprecherName: (feld) => server.speakers.find((s) => s.field === feld && !s.isThisDevice)?.deviceName, t,
  });
  // Modus wie im echten Hook (`waehleModus`), nicht von Hand (B8): „wechseln“ ist ein Turnier ohne Lautsprecher, also die Einrichtung
  const modus = waehleModus({ istLautsprecher, keinLautsprecherImTurnier: karten.every((k) => k.zustand.art === 'keinLautsprecher'), standAktuell: true, abgeloest: abgeloest !== null });
  const einrichtung = modus === 'einrichtung';
  const aus = () => undefined;
  const abschnitt: GeraetAbschnitt = {
    modus, alteAbmeldung: null, oben: einrichtung || istLautsprecher, banner, verstanden: aus,
    felder: [1, 2], gewaehlt: istLautsprecher ? [1] : [], an: istLautsprecher || fall === 'abloesen' || fall === 'wechseln', name: EIGEN, setzeName: aus, nameVerlassen: aus,
    schalterUmlegen: aus, feldUmschalten: aus, beschaeftigt: false, fehler: null, handy: false, installiert: fall !== 'leer', installAngebot: false, installieren: aus,
    schalterErledigt: istLautsprecher, tonErledigt: fall === 'bereit' || fall === 'anleitung', tonNoetig: fall === 'eingerichtet', tonAktivieren: aus,
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
            darfAendern abgeschlossen={false} hierAnhoeren={aus} geraetName={istLautsprecher ? EIGEN : null}
            geraet={<DiesesGeraetAbschnitt abschnitt={abschnitt} darfAendern leisteLinks={breit ? ADMIN_LAYOUT.sidebarWidth : 0} adresse="hallenfussball-pwa.vercel.app" browserKennung={browser === 'edge' ? 'Edg/120' : browser === 'safari' ? 'Version/17 Safari/605' : 'Chrome/120'} />}
            geraetOben={abschnitt.oben}
          />
        </CategoryPage>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><ThemeProvider><Seite /></ThemeProvider></HashRouter>);
