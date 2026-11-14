/**
 * Prüfstand für H4-8: der Unterpunkt „Hallenton“ im Admin-Center – die echte Seitenleiste (`AdminSidebar`, ab 768 px) und die echte
 * `HallentonSeiteAnsicht` in `CategoryPage` (hallAnzeige → Karten → Abschnitte), nur die Daten kommen von Hand statt aus den Hooks.
 * Daten wie im Mockup: Hallencup Süd, Feld 1/2, Spiel 11, „Laptop Turnierleitung“, 14:02. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=bereit|nicht-bereit|meldet-sich-nicht|status-unbekannt|testton|gesperrt|leer`.
 */
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { useAnhoerenRueckfrage } from '../../../src/features/hallenton/ui/useAnhoerenRueckfrage';
import { HashRouter } from 'react-router-dom';
import '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { AdminSidebar } from '../../../src/features/tournament-admin/components/AdminSidebar';
import { CategoryPage } from '../../../src/features/tournament-admin/categories/shared';
import { HallentonSeiteAnsicht } from '../../../src/features/hallenton/ui/HallentonSeite';
import { hallAnzeige, type HallAnzeigeEingabe } from '../../../src/features/hallenton/hallAnzeige';
import { lautsprecherLage, type LautsprecherLage } from '../../../src/features/hallenton/runtime/hallStatusAuswertung';
import { baueFeldKarten } from '../../../src/features/hallenton/ui/feldKarten';
import { formatUhrzeit } from '../../../src/features/hallenton/ui/uhrzeit';
import type { HallStatus } from '../../../src/features/hallenton/useHallStatus';
import type { HallStatusVoll } from '../../../src/core/repositories/hallentonRpc';

const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
const GESPIELT_1402 = new Date(2026, 10, 21, 14, 2, 0).getTime();

type Zustand = 'ready' | 'not_activated';
function antwort(state: Zustand, ageMs: number, playedAt: number | null = null): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: [{
      field: 1, deviceName: 'Laptop Turnierleitung', isThisDevice: false, state, assignedAt: 1, outputHint: false, hintAt: null, lastSeen: null, ageMs,
      test: playedAt === null ? null : { testId: 'x1', requestedAt: playedAt, playedAt },
    }],
  };
}

interface Fall { stand: HallStatus['stand']; antwort: HallStatusVoll | null; abgeschlossen?: boolean; darf?: boolean; leer?: boolean }
const FAELLE: Record<string, Fall> = {
  bereit: { stand: 'aktuell', antwort: antwort('ready', 3000) },
  'nicht-bereit': { stand: 'aktuell', antwort: antwort('not_activated', 3000) },
  'meldet-sich-nicht': { stand: 'aktuell', antwort: antwort('ready', 30_000) },
  'status-unbekannt': { stand: 'unbekannt', antwort: antwort('ready', 3000) },
  testton: { stand: 'aktuell', antwort: antwort('ready', 3000) }, // die Quittung kommt erst nach dem eigenen Auftrag (siehe `Seite`)
  gesperrt: { stand: 'aktuell', antwort: antwort('ready', 3000), abgeschlossen: true, darf: false },
  leer: { stand: 'aktuell', antwort: { ...antwort('ready', 3000), speakers: [] } },
};

const KEIN_SPIEL: ReadonlyMap<number, number> = new Map();

export function Seite() {
  const fall = new URLSearchParams(window.location.search).get('fall') ?? 'bereit';
  const f0 = FAELLE[fall] ?? FAELLE.bereit;
  // Fall „testton“: der Auftrag wird ausgelöst (Klick), danach meldet der Server die Quittung mit derselben Kennung – nur die eigene zählt (@HT-017)
  const [gespielt, setGespielt] = useState(false);
  const f: Fall = fall === 'testton' && gespielt ? { ...f0, antwort: antwort('ready', 3000, GESPIELT_1402) } : f0;
  const aktuell = f.stand === 'aktuell' ? f.antwort : null;
  const lagen: Record<number, LautsprecherLage> = aktuell === null ? {} : Object.fromEntries(
    aktuell.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, aktuell.serverNow)]));
  const anzeige = hallAnzeige({
    server: { stand: f.stand, felder: lagen, antwort: aktuell }, lokal: null, angepfiffen: new Set(), lautsprecherBekannt: f.antwort !== null && f.antwort.speakers.length > 0,
  } satisfies HallAnzeigeEingabe);
  const karten = baueFeldKarten({
    felder: [1, 2], anzeige, serverLagen: lagen, eigenerName: null, lokalerZustand: {}, uhrzeit: (ms) => formatUhrzeit(ms, 'de'),
    sprecher: f.antwort?.speakers.map((s) => ({ field: s.field, deviceName: s.deviceName })) ?? [],
  });
  const status: Pick<HallStatus, 'stand' | 'antwort' | 'testtonAnfordern'> = { stand: f.stand, antwort: aktuell, testtonAnfordern: () => {
      if (fall !== 'testton') { return Promise.resolve({ ok: false as const, grund: 'netz' as const }); }
      window.setTimeout(() => setGespielt(true), 0); // die Quittung folgt der Antwort auf den Auftrag
      return Promise.resolve({ ok: true, status: 'requested', testId: 'x1', requestedAt: SERVER_JETZT, serverNow: SERVER_JETZT });
    } };
  const rueckfrage = useAnhoerenRueckfrage(KEIN_SPIEL);
  const breit = window.innerWidth >= 768;
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: cssVars.colors.background, color: cssVars.colors.textPrimary }}>
      {breit ? <AdminSidebar activeCategory="hallenton" onNavigate={() => undefined} onBackToTournament={() => undefined} /> : null}
      <main style={{ flex: 1, minWidth: 0, padding: breit ? cssVars.spacing.lg : cssVars.spacing.md, maxWidth: 800 }}>
        <CategoryPage icon="🔊" title="Hallenton" description="Lautsprecher, Abpfiff, Halbzeit">
          <HallentonSeiteAnsicht
            karten={karten} keinLautsprecherImTurnier={karten.every((k) => k.zustand.art === 'keinLautsprecher')} status={status}
            darfAendern={f.darf ?? true} abgeschlossen={f.abgeschlossen ?? false} hierAnhoeren={() => undefined} geraetName="Laptop Turnierleitung" rueckfrage={rueckfrage}
          />
        </CategoryPage>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><ThemeProvider><Seite /></ThemeProvider></HashRouter>);
