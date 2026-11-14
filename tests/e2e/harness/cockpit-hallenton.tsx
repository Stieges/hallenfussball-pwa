/**
 * Prüfstand für H4-12: das echte Live-Cockpit (`LiveCockpit`) mit den Hinweisen zum Hallen-Lautsprecher unter der Tafel, dem Cockpit-Dialog
 * „Ton dieses Geräts“ und die echte Seite „Match Cockpit“ des Admin (`MatchCockpitCategory`) ohne Tonwahl-Regler. Der Zustand kommt aus den echten
 * Funktionen: das Spiel aus einer echten Engine (`MatchEngine`, `MatchCommands`, echter IndexedDB-Speicher; Anpfiff, Tore, Halbzeit mit
 * festem Zeitstand), die Hinweise aus einer echten Leitung (`erzeugeLeitungLebenszeichen`, „angepfiffen“ folgt dem Status der Engine) und dem
 * echten `useHallStatus`; nur der Server-Aufruf ist gefälscht, der Ton je Gerät kommt aus `useCockpitTon` (echter `localStorage`).
 * Daten wie im Mockup: Hallencup Süd, Feld 1, Spiel 11, FC Nord – SV Süd, 14:02; 2:1, 2. Halbzeit, Restzeit 4:32 (Fall `halbzeit`: Pause).
 * Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=kein-netz|lautsprecher-aus|ausgang-geaendert|halbzeit|anpfiff|uhr|dialog|admin|ohne` (+ `&lang=en`, `&lang=de`).
 */
import ReactDOM from 'react-dom/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '../../../src/i18n';
import '@fontsource-variable/inter';
import '../../../src/styles/global.css';
import { HashRouter } from 'react-router-dom';
import { AuthContext } from '../../../src/features/auth/context/authContextInstance';
import type { AuthContextValue } from '../../../src/features/auth/context/authContextValue';
import { RepositoryProvider } from '../../../src/core/contexts/RepositoryContext';
import { ToastProvider } from '../../../src/components/ui/Toast';
import { ThemeProvider } from '../../../src/hooks/useTheme';
import { cssVars } from '../../../src/design-tokens';
import { LiveCockpit } from '../../../src/components/live-cockpit/LiveCockpit';
import { MatchCockpitCategory } from '../../../src/features/tournament-admin/categories/MatchCockpit';
import type { Tournament } from '../../../src/types/tournament';
import { ClockSync, LocalMatchStore, MatchCommands, MatchEngine, emptyOutboxStatus } from '../../../src/core/match/client';
import { serverRules, type MatchContext } from '../../../src/core/match';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../src/features/match-engine/matchEngineContextInstance';
import { buildValidMatches, computeLiveMatches } from '../../../src/hooks/engineMatchModel';
import { useEngineCommandWiring } from '../../../src/hooks/useEngineCommandWiring';
import { looseVs } from '../../../src/test/matchSlotFixtures';
import { setzeLeitung } from '../../../src/features/hallenton/leitungGeraet';
import { __setzeHallStatusRpcFuerPruefstand } from '../../../src/features/hallenton/useHallStatus';
import { istAngepfiffen } from '../../../src/features/hallenton/runtime/feldStandSpiele';
import { erzeugeLeitungLebenszeichen } from '../../../src/features/hallenton/runtime/leitungLebenszeichen';
import { echterZeitgeber } from '../../../src/features/hallenton/runtime/zeitgeber';

// Angemeldeter Helfer (Tom): die Hülle des Cockpits braucht Anmeldung, Ablage und Meldungen als Umgebung
const angemeldet = { user: { id: 'tom', name: 'Tom', email: 'tom@example.org' }, isAuthenticated: true, isGuest: false, isLoading: false, connectionState: 'online', reconnect: () => Promise.resolve(true) } as unknown as AuthContextValue;
const TID = 'hallencup-sued';
const SPIEL = 'match-11';
const CTX: MatchContext = { matchId: SPIEL, teamAId: 'fc-nord', teamBId: 'sv-sued' };
const MIN = 60_000;
/** Zeitpunkt des Anpfiffs: 14:02 (Mockup). */
const ANPFIFF = new Date(2026, 10, 21, 14, 2).getTime();
const SERVER_JETZT = ANPFIFF + 30_000;
const FAELLE = ['kein-netz', 'lautsprecher-aus', 'ausgang-geaendert', 'halbzeit', 'anpfiff', 'uhr', 'dialog', 'admin', 'ohne'] as const;
type Fall = (typeof FAELLE)[number];
/** Fälle mit Lautsprecher-Antwort der Leitung im Spiel (angepfiffen). */
const LEITUNG_FAELLE: readonly Fall[] = ['kein-netz', 'lautsprecher-aus', 'ausgang-geaendert', 'halbzeit', 'anpfiff'];

const turnier = {
  id: TID, name: 'Hallencup Süd', groupPhaseGameDuration: 12, gamePeriods: 2, halftimeBreak: 1,
  matches: [{ id: SPIEL, ...looseVs('fc-nord', 'sv-sued'), round: 1, field: 1, matchNumber: 11, scheduledTime: new Date(ANPFIFF).toISOString() }],
  teams: [{ id: 'fc-nord', name: 'FC Nord' }, { id: 'sv-sued', name: 'SV Süd' }],
} as unknown as Tournament;

type Antwort = { state: 'ready' | 'not_activated'; ageMs: number; hint: boolean };
/** Der Server-Stand des Lautsprechers je Fall (Leitung und Abfrage `hall_sound_status` antworten gleich). */
function lautsprecherAm(fall: Fall): Antwort | null {
  switch (fall) {
    case 'lautsprecher-aus': return { state: 'ready', ageMs: 12_000, hint: false }; // meldet sich seit 14:02 nicht mehr
    case 'ausgang-geaendert': return { state: 'ready', ageMs: 1000, hint: true };
    case 'halbzeit':
    case 'anpfiff': return { state: 'not_activated', ageMs: 1000, hint: false };
    case 'kein-netz':
    case 'uhr': return { state: 'ready', ageMs: 1000, hint: false };
    default: return null;
  }
}

declare global {
  interface Window { __hallentonPruefstand?: { leitungAntworten: number } }
}
const pruefstand = { leitungAntworten: 0 };
window.__hallentonPruefstand = pruefstand;

type LeitungRpc = Parameters<typeof erzeugeLeitungLebenszeichen>[0]['rpc'];

/** Eine echte Leitung mit gefälschtem Server: „angepfiffen“ folgt dem Status der Engine; „kein Netz“ = erste Antwort gut, danach scheitert jeder Versuch. */
function starteLeitung(fall: Fall, kontext: MatchEngineContextValue): void {
  let aufrufe = 0;
  const rpc: LeitungRpc = () => {
    aufrufe += 1;
    pruefstand.leitungAntworten = aufrufe;
    const am = lautsprecherAm(fall);
    if (fall === 'kein-netz' && aufrufe > 1) { return Promise.resolve({ ok: false as const, grund: 'netz' as const }); }
    return Promise.resolve({ ok: true as const, status: 'ok' as const, serverNow: SERVER_JETZT, speaker: am === null ? null : { state: am.state, ageMs: am.ageMs, outputHint: am.hint } });
  };
  const leitung = erzeugeLeitungLebenszeichen({
    deviceId: 'handy-tom', eigeneFelder: () => ({ [TID]: [1] }),
    angepfiffen: () => istAngepfiffen(kontext.engine.view(SPIEL)?.result.state.status),
    rpc, zeitgeber: echterZeitgeber,
  });
  setzeLeitung(leitung);
  leitung.start();
}

/** Die Abfrage `hall_sound_status` (schmale Sicht des Helfers): das Feld 1 mit dem Stand des Falls. */
function starteServerStand(fall: Fall): void {
  __setzeHallStatusRpcFuerPruefstand(() => {
    const am = lautsprecherAm(fall);
    return Promise.resolve({
      ok: true as const, sicht: 'schmal' as const, serverNow: SERVER_JETZT,
      speakers: am === null ? [] : [{ field: 1, state: am.state, ageMs: am.ageMs, outputHint: am.hint }],
    });
  });
}

/** Baut Engine, Speicher und Spiel auf. Der Zeitstand ist fest (`jetzt.wert`), damit die Tafel in jedem Bild dasselbe zeigt. */
async function baueKontext(fall: Fall, jetzt: { wert: number }): Promise<MatchEngineContextValue> {
  const store = new LocalMatchStore();
  const abgeglichen = fall !== 'uhr';
  const clock = new ClockSync(
    () => Promise.resolve(jetzt.wert), () => jetzt.wert,
    { get: () => (abgeglichen ? JSON.stringify({ offsetMs: 0, measuredAt: 1 }) : null), set: () => undefined },
  );
  const ausgang = emptyOutboxStatus(); // gleiche Identität bei jedem Lesen (`useSyncExternalStore`)
  const sender = {
    kick: () => Promise.resolve(), getStatus: () => ausgang, subscribe: () => () => undefined,
    dismissRejected: () => Promise.resolve(), start: () => Promise.resolve(), stop: () => undefined,
  };
  const engine = new MatchEngine({ store, clock, sender: sender, fetchConfirmed: () => Promise.resolve({ events: [], newWatermark: 0 }), now: () => jetzt.wert });
  const konto = `pruefstand-${Date.now()}`;
  await engine.start(konto);
  await engine.ensureMatch(SPIEL, CTX, TID);
  const kontext = { engine, store, clock, sender, accountId: konto } as unknown as MatchEngineContextValue;
  const imSpiel = !['anpfiff', 'uhr', 'admin'].includes(fall);
  if (imSpiel) {
    const befehle = new MatchCommands({ engine, store, sender: sender, accountId: konto });
    const regeln = serverRules({ durationMinutes: null, phase: null, groupPhaseDuration: 12, finalRoundDuration: null, config: { gamePeriods: 2, halftimeBreak: 1 }, finalsConfig: null });
    jetzt.wert = ANPFIFF;
    await befehle.start(SPIEL, CTX, 'leitung', regeln);
    jetzt.wert = ANPFIFF + MIN;
    await befehle.goal(SPIEL, CTX, 'leitung', 'fc-nord', false);
    jetzt.wert = ANPFIFF + 3 * MIN;
    await befehle.goal(SPIEL, CTX, 'leitung', 'sv-sued', false);
    jetzt.wert = ANPFIFF + 5 * MIN;
    await befehle.goal(SPIEL, CTX, 'leitung', 'fc-nord', false);
    jetzt.wert = ANPFIFF + 6 * MIN; // Ende der 1. Halbzeit (6 Minuten), danach 1 Minute Pause
    await befehle.endSection(SPIEL, CTX, 'leitung');
    if (fall === 'halbzeit') {
      jetzt.wert = ANPFIFF + 6 * MIN + 20_000;
    } else {
      jetzt.wert = ANPFIFF + 7 * MIN;
      await befehle.startSection(SPIEL, CTX, 'leitung');
      jetzt.wert = ANPFIFF + 7 * MIN + 88_000; // 1:28 gespielt: Restzeit 4:32
    }
  } else {
    jetzt.wert = ANPFIFF - 2 * MIN;
  }
  return kontext;
}

const nichts = (): undefined => undefined;

function Cockpit({ kontext }: { kontext: MatchEngineContextValue }) {
  const gueltig = useMemo(() => buildValidMatches(turnier), []);
  const berechne = useCallback(() => computeLiveMatches(kontext, gueltig, new Set([SPIEL]), turnier, new Map()), [kontext, gueltig]);
  const [spiele, setSpiele] = useState(berechne);
  useEffect(() => kontext.engine.subscribe(() => { setSpiele(berechne()); }), [kontext, berechne]);
  const verdrahtung = useEngineCommandWiring(turnier, kontext, spiele);
  const spiel = spiele.get(SPIEL);
  if (!spiel) { return null; }
  return (
    <LiveCockpit
      fieldName="Feld 1" tournamentName="Hallencup Süd" tournamentId={TID} upcomingMatches={[]} kannSteuern currentMatch={spiel}
      onStart={(id) => { void verdrahtung.handleStart(id); }} onFinish={verdrahtung.handleFinish}
      onPause={(id) => { void verdrahtung.handlePause(id); }} onResume={(id) => { void verdrahtung.handleResume(id); }}
      onGoal={verdrahtung.handleGoal} onCard={verdrahtung.handleCard} onFoul={verdrahtung.handleFoul} onTimePenalty={verdrahtung.handleTimePenalty}
      onLoadNextMatch={nichts} onUpdateSettings={nichts}
    />
  );
}

export function Seite() {
  const params = new URLSearchParams(window.location.search);
  const fall = FAELLE.find((f) => f === params.get('fall')) ?? 'ohne';
  const [kontext, setKontext] = useState<MatchEngineContextValue | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    void baueKontext(fall, { wert: ANPFIFF }).then((k) => {
      if (abgebrochen) { return; }
      if (LEITUNG_FAELLE.includes(fall) || fall === 'uhr' || fall === 'admin') { starteServerStand(fall); }
      if (LEITUNG_FAELLE.includes(fall)) { starteLeitung(fall, k); }
      setKontext(k);
    });
    return () => { abgebrochen = true; };
  }, [fall]);
  if (fall === 'admin') {
    return (
      <div style={{ padding: cssVars.spacing.md, background: cssVars.colors.background, color: cssVars.colors.textPrimary, minHeight: '100vh' }} data-testid="admin-panel">
        {/* ohne Rollenquelle im Prüfstand (kein Konto am Server) bleibt die Karte „Hallenton“ aus (`useCan('manageScreens')`); sie hat die Prüfstände H4-8/H4-9 */}
        <MatchCockpitCategory tournamentId={TID} tournament={turnier} onTournamentUpdate={nichts} />
      </div>
    );
  }
  if (!kontext) { return null; }
  return (
    <MatchEngineContext.Provider value={kontext}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: cssVars.colors.background }}>
        <Cockpit kontext={kontext} />
      </div>
    </MatchEngineContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><AuthContext.Provider value={angemeldet}><ThemeProvider><RepositoryProvider user={null}><ToastProvider><Seite /></ToastProvider></RepositoryProvider></ThemeProvider></AuthContext.Provider></HashRouter>);
