/**
 * Prüfstand für H4-17 (@HT-059): der echte Kopf des Cockpits (`ManagementTabKopf` mit `CockpitSlimHeader`, Feldwahl „Feld 1“ von zwei Feldern,
 * `ConnectionPill`, echter `HallStatusZeile` mit echten Hooks, echtem Recht `manageScreens` im lokalen Modus) über dem echten `LiveCockpit` mit
 * laufendem Spiel (echte Engine, echter Speicher). Nur der Server-Aufruf `hall_sound_status` ist gefälscht, das Lautsprecher-Gerät ein Doppel der Laufzeit.
 * Daten wie im Mockup: Hallencup Süd, Feld 1, Spiel 11, FC Nord – SV Süd, 2:1, 2. Halbzeit. Nur Testumgebung, nicht Teil des Builds.
 * Aufruf: `?fall=ohne|bereit|pruefen|feld2|ton|eigen&alt=1` (`alt=1`: Kopf wie vor H4-17, die Statuszeile ohne `nurStoerungen`; `&thema` kommt vom Test).
 *   ohne: kein Hallen-Lautsprecher · bereit: Feld 1 bereit · pruefen: Feld 1 bereit mit „Prüfen“ · feld2: Feld 1 bereit, Feld 2 nicht bereit ·
 *   feld2ton (H4-18): dieses Handy ist Lautsprecher nur von Feld 2, Ton nicht aktiviert (Cockpit von Feld 1) · feld1 (H4-18): Feld 1 nicht bereit (anderes Gerät, Server-Stand) · ton: dieses Handy ist Lautsprecher von Feld 1, Ton nicht aktiviert · eigen: dieses Handy ist Lautsprecher von Feld 1 und bereit (Streifen darf nicht erscheinen).
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
import { CockpitSlimHeader } from '../../../src/components/live-cockpit/frame/CockpitSlimHeader';
import { ConnectionPill } from '../../../src/components/live-cockpit/frame/ConnectionPill';
import { ManagementTabKopf } from '../../../src/features/tournament-management/components/ManagementTabKopf';
import { HallStatusZeile } from '../../../src/features/hallenton/ui/HallStatusZeile';
import { HallGeraetStreifen } from '../../../src/features/hallenton/ui/HallGeraetStreifen';
import type { Tournament } from '../../../src/types/tournament';
import { ClockSync, LocalMatchStore, MatchCommands, MatchEngine, emptyOutboxStatus } from '../../../src/core/match/client';
import { serverRules, type MatchContext } from '../../../src/core/match';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../src/features/match-engine/matchEngineContextInstance';
import { buildValidMatches, computeLiveMatches } from '../../../src/hooks/engineMatchModel';
import { useEngineCommandWiring } from '../../../src/hooks/useEngineCommandWiring';
import { looseVs } from '../../../src/test/matchSlotFixtures';
import { __setzeHallStatusRpcFuerPruefstand } from '../../../src/features/hallenton/useHallStatus';
import { setzeEinschaltung, setzeLaufzeit } from '../../../src/features/hallenton/lautsprecherGeraet';
import type { HallLautsprecherLaufzeit, LaufzeitSnapshot } from '../../../src/features/hallenton/runtime/HallLautsprecherLaufzeit';

// Lokaler Modus (kein Konto): der Nutzer gilt als Eigentümer und hat damit `manageScreens` (useMyTournamentRole, Fall 1)
const lokal = { user: null, isAuthenticated: false, isGuest: true, isLoading: false, connectionState: 'online', reconnect: () => Promise.resolve(true) } as unknown as AuthContextValue;
const TID = 'hallencup-sued';
const SPIEL = 'match-11';
const CTX: MatchContext = { matchId: SPIEL, teamAId: 'fc-nord', teamBId: 'sv-sued' };
const MIN = 60_000;
const ANPFIFF = new Date(2026, 10, 21, 14, 2).getTime();
const FAELLE = ['ohne', 'bereit', 'pruefen', 'feld2', 'ton', 'eigen', 'feld1', 'feld2ton'] as const;
type Fall = (typeof FAELLE)[number];

const turnier = {
  id: TID, title: 'Hallencup Süd', name: 'Hallencup Süd', numberOfFields: 2, groupPhaseGameDuration: 12, gamePeriods: 2, halftimeBreak: 1,
  matches: [{ id: SPIEL, ...looseVs('fc-nord', 'sv-sued'), round: 1, field: 1, matchNumber: 11, scheduledTime: new Date(ANPFIFF).toISOString() }],
  teams: [{ id: 'fc-nord', name: 'FC Nord' }, { id: 'sv-sued', name: 'SV Süd' }],
} as unknown as Tournament;

type Sprecher = { field: number; state: 'ready' | 'not_activated'; ageMs: number; outputHint: boolean };
function sprecherAm(fall: Fall): Sprecher[] {
  switch (fall) {
    case 'bereit': case 'eigen': return [{ field: 1, state: 'ready', ageMs: 1000, outputHint: false }];
    case 'pruefen': return [{ field: 1, state: 'ready', ageMs: 1000, outputHint: true }];
    case 'feld2': return [{ field: 1, state: 'ready', ageMs: 1000, outputHint: false }, { field: 2, state: 'not_activated', ageMs: 1000, outputHint: false }];
    case 'feld2ton': return [{ field: 1, state: 'ready', ageMs: 1000, outputHint: false }, { field: 2, state: 'not_activated', ageMs: 1000, outputHint: false }];
    case 'feld1': return [{ field: 1, state: 'not_activated', ageMs: 1000, outputHint: false }];
    case 'ton': return [{ field: 1, state: 'not_activated', ageMs: 1000, outputHint: false }];
    default: return [];
  }
}

/** Doppel der Laufzeit dieses Geräts (die echte braucht ein Konto am Server und den Ton-Spieler). */
function laufzeitDoppel(zustand: 'not_activated' | 'ready', feld = 1): HallLautsprecherLaufzeit {
  const snapshot: LaufzeitSnapshot = {
    rolle: 'wartet', turnierId: TID, felder: [feld], geraeteZustand: 'ready', zustandJeFeld: { [`field-${feld}`]: zustand },
    naechsterTon: null, taktFehler: false, warAngehalten: false, verfuegbarkeit: null,
  };
  return { subscribe: () => () => undefined, getSnapshot: () => snapshot, stop: () => undefined } as unknown as HallLautsprecherLaufzeit;
}

async function baueKontext(jetzt: { wert: number }): Promise<MatchEngineContextValue> {
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(jetzt.wert), () => jetzt.wert, { get: () => JSON.stringify({ offsetMs: 0, measuredAt: 1 }), set: () => undefined });
  const ausgang = emptyOutboxStatus();
  const sender = { kick: () => Promise.resolve(), getStatus: () => ausgang, subscribe: () => () => undefined, dismissRejected: () => Promise.resolve(), start: () => Promise.resolve(), stop: () => undefined };
  const engine = new MatchEngine({ store, clock, sender, fetchConfirmed: () => Promise.resolve({ events: [], newWatermark: 0 }), now: () => jetzt.wert });
  const konto = `pruefstand-${Date.now()}`;
  await engine.start(konto);
  await engine.ensureMatch(SPIEL, CTX, TID);
  const befehle = new MatchCommands({ engine, store, sender, accountId: konto });
  const regeln = serverRules({ durationMinutes: null, phase: null, groupPhaseDuration: 12, finalRoundDuration: null, config: { gamePeriods: 2, halftimeBreak: 1 }, finalsConfig: null });
  jetzt.wert = ANPFIFF;
  await befehle.start(SPIEL, CTX, 'leitung', regeln);
  for (const [minute, team] of [[1, 'fc-nord'], [3, 'sv-sued'], [5, 'fc-nord']] as const) {
    jetzt.wert = ANPFIFF + minute * MIN;
    await befehle.goal(SPIEL, CTX, 'leitung', team, false);
  }
  jetzt.wert = ANPFIFF + 6 * MIN;
  await befehle.endSection(SPIEL, CTX, 'leitung');
  jetzt.wert = ANPFIFF + 7 * MIN;
  await befehle.startSection(SPIEL, CTX, 'leitung');
  jetzt.wert = ANPFIFF + 7 * MIN + 88_000;
  return { engine, store, clock, sender, accountId: konto } as unknown as MatchEngineContextValue;
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
  const alt = params.get('alt') === '1';
  const [kontext, setKontext] = useState<MatchEngineContextValue | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    // `data-antwort="1"` am Wurzelelement: die erste Antwort des gefälschten Servers ist gegeben (die Tests warten darauf, bevor sie „keine Zeile“ prüfen)
    __setzeHallStatusRpcFuerPruefstand(() => Promise.resolve({
      ok: true as const, sicht: 'voll' as const, serverNow: ANPFIFF, closed: false, speakers: sprecherAm(fall), leads: [],
      settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    } as never).then((antwort) => { document.documentElement.dataset.antwort = '1'; return antwort; }));
    if (fall === 'ton' || fall === 'eigen' || fall === 'feld2ton') {
      const feld = fall === 'feld2ton' ? 2 : 1;
      setzeEinschaltung({ turnierId: TID, felder: [feld], name: 'Handy Tom' });
      setzeLaufzeit(laufzeitDoppel(fall === 'eigen' ? 'ready' : 'not_activated', feld));
    }
    void baueKontext({ wert: ANPFIFF }).then((k) => { if (!abgebrochen) { setKontext(k); } });
    return () => { abgebrochen = true; };
  }, [fall]);
  if (!kontext) { return null; }
  return (
    <MatchEngineContext.Provider value={kontext}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: cssVars.colors.background }}>
        {alt ? (
          <CockpitSlimHeader
            tournamentId={TID} turnierName="Hallencup Süd" felder={2} feld={1} onFeld={nichts} halter={{}} verbindung={<ConnectionPill tournamentId={TID} />}
            statuszeile={<HallStatusZeile tournamentId={TID} />}
          />
        ) : <ManagementTabKopf tournament={turnier} feld={1} onFeld={nichts} halter={{}} onTastenkuerzel={nichts} />}
        <Cockpit kontext={kontext} />
      </div>
      <HallGeraetStreifen />
    </MatchEngineContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<HashRouter><AuthContext.Provider value={lokal}><ThemeProvider><RepositoryProvider user={null}><ToastProvider><Seite /></ToastProvider></RepositoryProvider></ThemeProvider></AuthContext.Provider></HashRouter>);
