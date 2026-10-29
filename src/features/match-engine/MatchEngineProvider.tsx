/**
 * MatchEngineProvider (C3a-1, Teil 1.2): erzeugt die Laufzeit-Baugruppe (Store/Uhr/Sender/
 * MatchEngine) EINMAL fuer die Sitzung und schaltet sie bei Kontowechsel um (`start`/`stop`,
 * kein Neuaufbau -- `MatchEngine`/`OutboxSender` sind dafuer ausgelegt). Schreibweg
 * (`appendMatchEvents`/`serverTime`) laeuft ueber denselben `supabaseLiveMatchRepo` wie der
 * Rest der App (`RepositoryContext`), nicht ueber einen zweiten RPC-Aufrufer.
 *
 * @see .superpowers/sdd/2026-09-26-pr-c-ausgang/task-C3a-brief.md (v2, 1.2)
 */
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useAuth } from '../auth/hooks/useAuth';
import { useRepositories } from '../../core/contexts/RepositoryContext';
import type { SupabaseLiveMatchRepository } from '../../core/repositories/SupabaseLiveMatchRepository';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { resyncNow } from './resyncNow';
import { ResyncNowContext } from './resyncNowContext';
import { cancelQueueResumes, queueOf, scheduleQueueResume, type ResumableQueue } from './queueWiring';
import { safeLocalStorage } from '../../core/utils/safeStorage';
import { getDeviceId } from '../../core/device/deviceId';
import { BROADCAST_CHANNELS } from '../../constants/storage';
import {
  LocalMatchStore,
  ClockSync,
  OutboxSender,
  MatchEngine,
  type ClockStorage,
  type MatchBroadcastChannel,
  type OutboxApi,
} from '../../core/match/client';
import { makeFetchConfirmed, type MatchEventsQueryClient } from './supabaseFetchConfirmed';
import { MatchEngineContext, type MatchEngineContextValue } from './matchEngineContextInstance';
import { useOutboxReport } from './useOutboxReport';
import { useAfterFinishCleanup } from './useAfterFinishCleanup';

const BROADCAST_CHANNEL_NAME = BROADCAST_CHANNELS.MATCH_ENGINE;

const NOT_CONFIGURED_ERROR = new Error('Supabase nicht konfiguriert');

const clockStorage: ClockStorage = {
  get: (key) => safeLocalStorage.getItem(key),
  set: (key, value) => safeLocalStorage.setItem(key, value),
};

/** V14/K1: Gast (kein Supabase, lokaler Gast) faehrt nie ueber das Netz. */
function computeAccountId(userId: string | undefined, globalRole: string | undefined): string {
  if (!isSupabaseConfigured || userId === undefined || globalRole === 'guest') {
    return 'guest';
  }
  return userId;
}

/**
 * Zeigt bei jedem Aufruf auf die AKTUELLE Repo-Instanz (`RepositoryContext` baut sie bei
 * Kontowechsel neu auf) -- der Sender/die Uhr werden dagegen NICHT neu gebaut (`start`/`stop`
 * reicht, s. o.), deshalb der Umweg ueber eine Ref statt eines direkten Konstruktor-Arguments.
 */
function buildBundle(
  repoRef: { current: SupabaseLiveMatchRepository | null },
): Omit<MatchEngineContextValue, 'accountId'> {
  const store = new LocalMatchStore();
  const clock = new ClockSync(
    () => (isSupabaseConfigured && repoRef.current ? repoRef.current.serverTime() : Promise.reject(NOT_CONFIGURED_ERROR)),
    () => Date.now(),
    clockStorage,
  );
  const api: OutboxApi = {
    appendMatchEvents: (matchId, events, options) => {
      if (!isSupabaseConfigured || !repoRef.current) {
        return Promise.reject(NOT_CONFIGURED_ERROR);
      }
      return repoRef.current.appendMatchEvents(matchId, events, options);
    },
  };
  let engineHandle: MatchEngine | null = null;
  const sender = new OutboxSender({
    store,
    api,
    // B-49 (Brief A-34 L7): Format 2 = sendet Geräte-ID und Steuer-Epoche. Der Server nimmt jedes Format >= min_client_format an
    // (`append_match_events`: `p_client_format < v_min_format` → CLIENT_OUTDATED, heute min 1); erst ein Anheben von
    // min_client_format auf 2 (DB-Fenster, Freigabe Daniel) sperrt alte Stände ohne Geräte-ID aus.
    clientFormat: 2,
    // B-49 (@FU-026, @FU-030): stabile Geraete-ID -- ohne sie entsteht am Server kein Anspruch (A-34), die Sperre greift nicht.
    deviceId: getDeviceId(),
    timers: {
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => { clearTimeout(handle); },
    },
    now: () => Date.now(),
    requestCatchUp: (matchId) => {
      void engineHandle?.catchUp(matchId);
    },
    // m7: eigene Store-Schreibzugriffe (resolveBatch/rejectAllPending/dismissRejected) lesen die
    // Kopie sofort neu ein, statt bis zum naechsten ensureMatch/catchUp veraltet zu bleiben.
    notifyStoreChange: (matchId) => {
      // Minor (Review Fixrunde 1): `.catch` statt nacktem `void` -- kein unbehandelter Fehler,
      // wenn das Neu-Einlesen der Kopie fehlschlaegt.
      engineHandle?.notifyStoreChange(matchId).catch(() => undefined);
    },
  });
  const broadcast: MatchBroadcastChannel | undefined =
    typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  const engine = new MatchEngine({
    store,
    clock,
    sender,
    fetchConfirmed: (matchId, watermarkSeq) => {
      if (!isSupabaseConfigured || !supabase) {
        return Promise.reject(NOT_CONFIGURED_ERROR);
      }
      // K8: einziger Cast-Punkt -- `SupabaseClient<Database>` ist strukturell kompatibel zu
      // `MatchEventsQueryClient` (siehe supabaseFetchConfirmed.ts, dort ohne jeden Cast gegen
      // einen Fake getestet), die direkte Zuweisung sprengt aber TS' Rekursionslimit (TS2589)
      // wegen der Groesse des generierten Datenbank-Schemas -- deshalb der Umweg ueber `unknown`.
      const client: unknown = supabase;
      return makeFetchConfirmed(client as MatchEventsQueryClient)(matchId, watermarkSeq);
    },
    now: () => Date.now(),
    ...(broadcast ? { broadcast } : {}),
  });
  engineHandle = engine;
  return { engine, sender, store, clock };
}

export function MatchEngineProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user, session } = useAuth();
  const { supabaseLiveMatchRepo, tournamentRepository } = useRepositories();

  const accountId = computeAccountId(user?.id, user?.globalRole);

  const repoRef = useRef<SupabaseLiveMatchRepository | null>(supabaseLiveMatchRepo);
  repoRef.current = supabaseLiveMatchRepo;

  // A-06g: immer die AKTUELLE Queue (Repo-Wechsel bei Kontowechsel), nie eine alte Closure.
  const queueRef = useRef<ResumableQueue | null>(null);
  queueRef.current = queueOf(tournamentRepository);
  // Ausstehende Wiederaufnahmen nach Anmeldung (setTimeout 0); beim Unmount geloescht.
  const resumeTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  const bundleRef = useRef<Omit<MatchEngineContextValue, 'accountId'> | null>(null);
  bundleRef.current ??= buildBundle(repoRef);
  const bundle = bundleRef.current;

  // m3 (Nachtrag C3a-2a): NEUES Kontext-Objekt je Kontowechsel (`bundle` selbst bleibt stabil,
  // s. Doku an `MatchEngineContextValue.accountId`) -- Hooks, die `context` in einer
  // Abhaengigkeitsliste fuehren, bauen ihren Kopien-Cache dadurch zuverlaessig neu auf.
  const contextValue = useMemo<MatchEngineContextValue>(() => ({ ...bundle, accountId }), [bundle, accountId]);

  const resync = useCallback(
    () =>
      resyncNow({
        clock: bundle.clock,
        sender: bundle.sender,
        engine: bundle.engine,
        mutationQueue: queueRef.current,
        isGuest: accountId === 'guest',
      }),
    [bundle, accountId],
  );

  const previousAccountRef = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | undefined>(undefined);

  // Kontowechsel (RC-Kontowechsel): stop() des alten, start() des neuen Kontos -- kein Neuaufbau.
  // m4 (Re-Review Fixrunde 1/2): `previousAccountRef` wird jetzt SYNCHRON beansprucht (vor jedem
  // `await`), nicht erst nachdem `start()` aufgeloest hat. Ein schneller A->B-Wechsel sieht dadurch
  // sofort den echten Vorgaenger und ruft `stop()` zuverlaessig auf, auch wenn `start()` fuer A noch
  // nicht abgeschlossen war.
  // N2-m4 (ehrlich gemacht -- der vorige Text hier behauptete das Gegenteil, s. Test "N2-m4"):
  // fuer den StrictMode-Doppellauf DESSELBEN Kontos wird `start(accountId)` NUR EINMAL aufgerufen,
  // nicht zweimal -- `previousAccountRef.current` ist bereits nach dem ERSTEN Durchlauf (synchron,
  // vor jedem `await`) auf `accountId` gesetzt; der zweite (StrictMode-)Durchlauf sieht
  // `previousTarget === accountId` und kehrt VOR dem `start()`-Aufruf zurueck. Waere das je nicht
  // mehr so (z. B. durch eine kuenftige Umstellung), bliebe es trotzdem unschaedlich:
  // `MatchEngine.start()`/`OutboxSender.start()` sind fuer denselben Account idempotent (raeumen
  // ihren eigenen Zustand jeweils selbst auf).
  useEffect(() => {
    const previousTarget = previousAccountRef.current;
    previousAccountRef.current = accountId;
    let cancelled = false;
    async function switchAccount(): Promise<void> {
      if (previousTarget !== null && previousTarget !== accountId) {
        bundle.engine.stop();
      }
      if (cancelled || previousTarget === accountId) {
        return;
      }
      await bundle.engine.start(accountId);
    }
    void switchAccount();
    return () => {
      cancelled = true;
    };
  }, [accountId, bundle]);

  // W9: Uhr sofort messen (nicht erst nach 60s) + periodisch weiter -- nur mit Netz (kein Gast).
  useEffect(() => {
    if (accountId === 'guest') {
      return undefined;
    }
    void bundle.clock.sync();
    bundle.clock.start();
    return () => {
      bundle.clock.stop();
    };
  }, [accountId, bundle]);

  // RC5/I4: bei Wiederverbindung sofort neu messen, den Ausgang anstossen UND die geladenen
  // Engine-Spiele nachladen (`catchUpLoaded` -- nur qualifizierende Spiele, s. `MatchEngine`).
  useEffect(() => {
    if (accountId === 'guest') {
      return undefined;
    }
    const handleOnline = (): void => {
      void bundle.clock.sync();
      void bundle.sender.kick();
      bundle.engine.catchUpLoaded().catch(() => undefined);
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [accountId, bundle]);

  // A-06g (@FU-015): Rueckkehr in den Vordergrund -> resyncNow (nur 'visible', nie Gast).
  useEffect(() => {
    if (accountId === 'guest') {
      return undefined;
    }
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void resync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [accountId, resync]);

  // R3-2a (@LZ-018, @FU-068): Zahl wartender Einträge alle 30 s an den Server melden (Warnungen vor dem Abschluss)
  useOutboxReport({ sender: bundle.sender, accountId });
  // R3-2b (Review #392 M2, @FU-018): nach dem Wiederöffnen „an die Turnierleitung übergeben“ aufräumen
  useAfterFinishCleanup({ sender: bundle.sender, accountId });

  // Unmount: ausstehende Wiederaufnahmen loeschen, bevor irgendetwas entsorgt wird (A-06g).
  useEffect(() => {
    const timers = resumeTimersRef.current;
    return () => {
      cancelQueueResumes(timers);
    };
  }, []);

  // RC9: SIGNED_IN/TOKEN_REFRESHED DESSELBEN Kontos -> Sender weiter (kein Kontowechsel-Neuaufbau).
  // A-06g (@FU-009): zusaetzlich die Queue wecken (setTimeout, s. queueWiring.ts). Abmelden: kein Aufruf.
  useEffect(() => {
    const token = session?.token;
    if (token === undefined) {
      cancelQueueResumes(resumeTimersRef.current);
    } else if (token !== sessionTokenRef.current && previousAccountRef.current === accountId) {
      void bundle.sender.resumeAuth();
      scheduleQueueResume(resumeTimersRef.current, queueRef);
    }
    sessionTokenRef.current = token;
  }, [session, accountId, bundle]);

  return (
    <ResyncNowContext.Provider value={resync}>
      <MatchEngineContext.Provider value={contextValue}>{children}</MatchEngineContext.Provider>
    </ResyncNowContext.Provider>
  );
}
