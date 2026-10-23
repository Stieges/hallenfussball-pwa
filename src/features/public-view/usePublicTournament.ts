/**
 * usePublicTournament – Datenzugriff der Zuschauer-Seite (B-13b, B-15).
 *
 * Fragt eine austauschbare Quelle (`PublicTournamentSource`) im Takt ab (`usePolling`: 10 Sekunden im Vordergrund, im
 * Hintergrund gar nicht), hält den letzten Stand und rechnet Spielplan und Tabellen nur neu, wenn sich die Version ändert.
 * Ohne Netz bleibt der letzte Stand stehen (@ZM-032); nach 20 Sekunden meldet `connectionHint` „Stand von 14:32 – keine
 * Verbindung“. Ein Stand vom selben Turniertag überlebt das Neuladen ohne Netz (`publicStandStore`).
 * Die Quelle muss stabil sein (Modulkonstante oder useMemo), sonst startet der Hook bei jedem Render neu.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { anzeigeT } from '../../i18n/anzeigeSprache';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../../core/generators';
import { calculateStandingsPerGroup } from '../../utils/calculations';
import { toTournamentLocal, TOURNAMENT_TIME_ZONE } from '../../core/view';
import type { PublicFetchResult, PublicTournamentSource } from './publicSource';
import { applyPublicDelta } from './publicDelta';
import { defaultPublicTournamentSource } from './defaultPublicSource';
import { usePolling } from './usePolling';
import { withTimeout } from './withTimeout';
import { useConnectionHint, type ConnectionHint, type ContactLoss } from './useConnectionHint';
import {
  browserStandStorage, clearStand, loadStand, purgeOldStands, saveContact, saveStand, type StandStorage,
} from './publicStandStore';

export type { PublicTournamentSource } from './publicSource';
export { defaultPublicTournamentSource } from './defaultPublicSource';
export type LoadingState = 'loading' | 'error' | 'not-found' | 'success';

/** So lange wartet ein Abruf höchstens auf die Quelle (ms); darüber gilt sie als nicht erreichbar. */
export const PUBLIC_FETCH_TIMEOUT_MS = 8000;

interface Snapshot {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  version: string;
  /** Serverzeit (ms), zu der der Stand abgerufen wurde */
  fetchedAtMs: number;
}

export interface PublicTournamentState {
  tournament: Tournament | null;
  schedule: GeneratedSchedule | null;
  standings: Standing[];
  loadingState: LoadingState;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  /** „Stand von 14:32 – keine Verbindung“, solange Abrufe scheitern; sonst `null` */
  connectionHint: ConnectionHint | null;
  /** Serverzeit, zu der der gehaltene Stand abgerufen wurde (Bezug der Spieluhren); `null` ohne Stand */
  fetchedAtMs: number | null;
  /** Jetzt in Serverzeit (ms) */
  nowMs: () => number;
}

export interface UsePublicTournamentOptions {
  /** Speicher für den Stand zum Neuladen ohne Netz; Vorgabe der Speicher des Browsers (`null` = keiner) */
  storage?: StandStorage | null;
}

function derive(tournament: Tournament): Pick<Snapshot, 'tournament' | 'schedule' | 'standings'> {
  return {
    tournament,
    schedule: generateFullSchedule(tournament),
    standings: calculateStandingsPerGroup(tournament),
  };
}

const localDayAt = (ms: number): string => toTournamentLocal(new Date(ms), TOURNAMENT_TIME_ZONE).date;

export function usePublicTournament(
  shareCode: string,
  source: PublicTournamentSource = defaultPublicTournamentSource,
  options: UsePublicTournamentOptions = {},
): PublicTournamentState {
  const storage = options.storage === undefined ? browserStandStorage() : options.storage;

  // Stand vom selben Tag, falls vorhanden: steht sofort da, die Abfrage prüft ihn danach (@ZM-035)
  const [restored] = useState(() => {
    const today = localDayAt(source.nowMs());
    purgeOldStands(storage, today);
    const loaded = loadStand(storage, shareCode, today, source.kind);
    if (loaded === null) {
      return null;
    }
    try {
      const snapshot: Snapshot = { ...derive(loaded.stand.tournament), version: loaded.stand.version, fetchedAtMs: loaded.contact?.atMs ?? source.nowMs() };
      return { snapshot, contact: loaded.contact };
    } catch {
      clearStand(storage, shareCode);
      return null;
    }
  });

  const [snapshot, setSnapshot] = useState<Snapshot | null>(restored?.snapshot ?? null);
  const [loadingState, setLoadingState] = useState<LoadingState>(restored === null ? 'loading' : 'success');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loss, setLoss] = useState<ContactLoss | null>(null);

  const versionRef = useRef<string | null>(restored?.snapshot.version ?? null);
  const snapshotRef = useRef<Snapshot | null>(restored?.snapshot ?? null);
  const lastContactRef = useRef<{ atMs: number; deviceMs: number } | null>(restored?.contact ?? null);
  const requestRef = useRef(0);

  const commit = useCallback((next: Snapshot | null) => {
    snapshotRef.current = next;
    versionRef.current = next?.version ?? null;
    setSnapshot(next);
  }, []);

  /** Ein erfolgreicher Abruf, auch ohne neuen Inhalt: Frist für den Hinweis neu, Zeitpunkt für „Stand von“ merken. */
  const noteContact = useCallback(() => {
    const contact = { atMs: source.nowMs(), deviceMs: Date.now() };
    lastContactRef.current = contact;
    saveContact(storage, shareCode, contact);
    setLoss(null);
    setLoadingState('success');
    setErrorMessage(null);
  }, [source, storage, shareCode]);

  const noteFailure = useCallback(() => {
    const last = lastContactRef.current;
    setLoss((current) => current ?? (last === null ? null : { lastAtMs: last.atMs, lastDeviceMs: last.deviceMs }));
    if (snapshotRef.current === null) {
      setLoadingState('error');
      setErrorMessage(anzeigeT('publicView:error.loadFailed'));
    }
  }, []);

  const takeStand = useCallback((tournament: Tournament, version: string) => {
    try {
      const fetchedAtMs = source.nowMs();
      const next: Snapshot = { ...derive(tournament), version, fetchedAtMs };
      commit(next);
      saveStand(storage, shareCode, { source: source.kind, version, day: localDayAt(fetchedAtMs), tournament });
      noteContact();
    } catch (error) {
      console.error('Error loading tournament:', error);
      if (snapshotRef.current === null) {
        setLoadingState('error');
        setErrorMessage(anzeigeT('publicView:error.loadFailed'));
      }
    }
  }, [source, storage, shareCode, commit, noteContact]);

  /** Übernimmt eine Antwort; `true`, wenn die Änderungen nicht auf den gehaltenen Stand passen und ganz geladen werden muss. */
  const handle = useCallback((result: PublicFetchResult): boolean => {
    switch (result.kind) {
      case 'unreachable':
        noteFailure();
        return false;
      case 'not-found':
        clearStand(storage, shareCode);
        commit(null);
        setLoss(null);
        setLoadingState('not-found');
        return false;
      case 'unchanged':
        noteContact();
        return false;
      case 'full':
        if (result.version === versionRef.current) {
          noteContact();
        } else {
          takeStand(result.tournament, result.version);
        }
        return false;
      case 'delta': {
        const held = snapshotRef.current;
        if (held === null || result.baseVersion !== versionRef.current) {
          return true;
        }
        takeStand(applyPublicDelta(held.tournament, result.delta), result.version);
        return false;
      }
    }
  }, [noteFailure, noteContact, takeStand, commit, storage, shareCode]);

  const poll = useCallback(async (): Promise<void> => {
    requestRef.current += 1;
    const request = requestRef.current;
    let since = versionRef.current;
    // höchstens zweimal: passt eine Änderung nicht auf den Stand, kommt einmal die ganze Antwort
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let result: PublicFetchResult;
      try {
        result = await withTimeout(source.fetch(shareCode, since), PUBLIC_FETCH_TIMEOUT_MS);
      } catch {
        result = { kind: 'unreachable' };
      }
      if (request !== requestRef.current || !handle(result)) {
        return;
      }
      since = null;
    }
  }, [source, shareCode, handle]);

  const { pollNow } = usePolling({ task: poll, intervalMs: source.pollIntervalMs });

  // Anderes Turnier oder andere Quelle: Anfragen der alten Seite verwerfen
  // (nicht beim bloßen Neu-Einhängen im Entwicklungsmodus: dort läuft der erste Abruf weiter und gilt)
  const keyRef = useRef<{ shareCode: string; source: PublicTournamentSource }>({ shareCode, source });
  useEffect(() => {
    if (keyRef.current.shareCode !== shareCode || keyRef.current.source !== source) {
      keyRef.current = { shareCode, source };
      requestRef.current += 1;
    }
  }, [shareCode, source]);

  const connectionHint = useConnectionHint(loss);

  return {
    tournament: snapshot?.tournament ?? null,
    schedule: snapshot?.schedule ?? null,
    standings: snapshot?.standings ?? [],
    loadingState,
    errorMessage,
    refresh: pollNow,
    connectionHint,
    fetchedAtMs: snapshot?.fetchedAtMs ?? null,
    nowMs: source.nowMs,
  };
}
