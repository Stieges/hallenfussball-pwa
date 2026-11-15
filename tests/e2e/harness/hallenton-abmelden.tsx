/**
 * Prüfstand für H4-11b (@HT-057): „Abmelden“ an der Karte eines Felds im Unterpunkt „Hallenton“ – die echte Seitenleiste (`AdminSidebar`, ab 768 px), die echte `HallentonSeiteAnsicht` mit dem
 * echten Hook `useLautsprecherAbmelden` (Rückfragen, Fehler, Ergebnis) und der echten Rückfrage bei laufendem Spiel (`useAnhoerenRueckfrage`); nur der Server-Aufruf ist gefälscht: er meldet ab (die Karte
 * zeigt danach „kein Hallen-Lautsprecher“) oder liefert den Fehler aus `&fehler=`. Daten wie im Mockup: Hallencup Süd, Feld 1/2, Spiel 11, 14:02. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=bereit|meldetSichNicht|eigenes|keinNetz` (Lage), `&spiel=1` (Spiel 11 läuft auf Feld 1), `&name=lang` (Gerätename mit 50 Zeichen), `&fehler=kein_recht|netz|…`, `&lang=en`.
 */
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import i18n from '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { AdminSidebar } from '../../../src/features/tournament-admin/components/AdminSidebar';
import { CategoryPage } from '../../../src/features/tournament-admin/categories/shared';
import { HallentonSeiteAnsicht } from '../../../src/features/hallenton/ui/HallentonSeite';
import { hallAnzeige } from '../../../src/features/hallenton/hallAnzeige';
import { lautsprecherLage, type LautsprecherLage } from '../../../src/features/hallenton/runtime/hallStatusAuswertung';
import { baueFeldKarten } from '../../../src/features/hallenton/ui/feldKarten';
import { formatUhrzeit } from '../../../src/features/hallenton/ui/uhrzeit';
import { useAnhoerenRueckfrage } from '../../../src/features/hallenton/ui/useAnhoerenRueckfrage';
import { useLautsprecherAbmelden } from '../../../src/features/hallenton/ui/useLautsprecherAbmelden';
import type { HallStatus } from '../../../src/features/hallenton/useHallStatus';
import type { HallLautsprecher } from '../../../src/features/hallenton/useHallLautsprecher';
import type { HallErgebnis, HallFehlerGrund, HallStatusVoll } from '../../../src/core/repositories/hallentonRpc';

const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
const NAME = 'Rechner der Turnierleitung';
const LANGER_NAME = 'Tablet Halle Süd am Eingang neben der Kasse, links'; // 50 Zeichen (Randfall)
const FALL = ['bereit', 'meldetSichNicht', 'eigenes', 'keinNetz'] as const;
type Fall = (typeof FALL)[number];
const LAUFEND: ReadonlyMap<number, number> = new Map([[1, 11]]);
const KEIN_SPIEL: ReadonlyMap<number, number> = new Map();
const FEHLER: readonly HallFehlerGrund[] = ['kein_recht', 'netz', 'turnier_beendet', 'ungueltig', 'antwort_unbekannt'];

function antwort(sprecher: ReadonlyArray<{ name: string; ich: boolean; ageMs: number }>): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: sprecher.map((s) => ({ field: 1, deviceName: s.name, isThisDevice: s.ich, state: 'ready' as const, assignedAt: 1, outputHint: false, hintAt: null, lastSeen: null, ageMs: s.ageMs, test: null })),
  };
}

export function Seite() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('lang') === 'en' && i18n.language !== 'en') { void i18n.changeLanguage('en'); }
  const fall: Fall = FALL.find((f) => f === params.get('fall')) ?? 'bereit';
  const fehler = FEHLER.find((f) => f === params.get('fehler')) ?? null;
  const geraetName = params.get('name') === 'lang' ? LANGER_NAME : fall === 'eigenes' ? 'Laptop Turnierleitung' : NAME;
  const [abgemeldet, setAbgemeldet] = useState(false);
  const eigenes = fall === 'eigenes';
  const stand = fall === 'keinNetz' ? 'unbekannt' : 'aktuell';
  const server = antwort(abgemeldet ? [] : [{ name: geraetName, ich: eigenes, ageMs: fall === 'meldetSichNicht' ? 60_000 : 3000 }]);
  const aktuell = stand === 'aktuell' ? server : null;
  const lagen: Record<number, LautsprecherLage> = aktuell === null ? {} : Object.fromEntries(
    aktuell.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, aktuell.serverNow)]));
  const lokal = eigenes && !abgemeldet ? { felder: [1], rolle: 'toent' as const, zustandJeFeld: { 'field-1': 'ready' as const } } : null;
  const anzeige = hallAnzeige({ server: { stand, felder: lagen, antwort: aktuell }, lokal, angepfiffen: new Set(), lautsprecherBekannt: true });
  const karten = baueFeldKarten({
    felder: [1, 2], anzeige, serverLagen: lagen, eigenerName: lokal === null ? null : geraetName, lokalerZustand: lokal?.zustandJeFeld ?? {},
    uhrzeit: (ms) => formatUhrzeit(ms, i18n.language), sprecher: [{ field: 1, deviceName: geraetName }],
  });
  const status: Pick<HallStatus, 'stand' | 'antwort' | 'testtonAnfordern' | 'gehoert'> = {
    stand, antwort: aktuell, gehoert: () => Promise.resolve({ ok: false as const, grund: 'netz' as const }), testtonAnfordern: () => Promise.resolve({ ok: false as const, grund: 'netz' as const }),
  };
  const rueckfrage = useAnhoerenRueckfrage(params.get('spiel') === '1' ? LAUFEND : KEIN_SPIEL);
  // nur der Server-Aufruf ist gefälscht: Erfolg → die Karte zeigt gleich „kein Hallen-Lautsprecher“; sonst der gewählte Fehler
  const melde = (): Promise<HallErgebnis<{ status: 'unassigned'; fields: number[] }>> => {
    if (fehler !== null) { return Promise.resolve({ ok: false, grund: fehler }); }
    setAbgemeldet(true);
    return Promise.resolve({ ok: true, status: 'unassigned', fields: [1] });
  };
  const lautsprecher = {
    rolle: lokal === null ? 'keiner' : 'diesesTurnier', felder: lokal === null ? [] : [1],
    feldAbmelden: () => { setAbgemeldet(true); return Promise.resolve({ ok: true as const, status: 'released' as const, fields: [1] }); },
    ausschalten: () => { setAbgemeldet(true); return Promise.resolve({ ok: true as const, status: 'released' as const, fields: [1] }); },
  } as unknown as HallLautsprecher;
  const abmelden = useLautsprecherAbmelden({ tournamentId: 't-sued', karten, stand, darfAendern: true, lautsprecher, rueckfrage }, melde);
  const breit = window.innerWidth >= 768;
  const aus = () => undefined;
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: cssVars.colors.background, color: cssVars.colors.textPrimary }}>
      {breit ? <AdminSidebar activeCategory="hallenton" onNavigate={aus} onBackToTournament={aus} /> : null}
      <main style={{ flex: 1, minWidth: 0, padding: breit ? cssVars.spacing.lg : cssVars.spacing.md, maxWidth: 800 }}>
        <CategoryPage icon="🔊" title="Hallenton" description="Lautsprecher, Abpfiff, Halbzeit">
          <HallentonSeiteAnsicht
            karten={karten} keinLautsprecherImTurnier={karten.every((k) => k.zustand.art === 'keinLautsprecher') && stand === 'aktuell'} status={status}
            darfAendern abgeschlossen={false} hierAnhoeren={aus} geraetName={null} rueckfrage={rueckfrage} abmelden={abmelden}
          />
        </CategoryPage>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><ThemeProvider><Seite /></ThemeProvider></HashRouter>);
