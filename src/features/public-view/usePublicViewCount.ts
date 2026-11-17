/**
 * usePublicViewCount – die Zuschauer-Seite zählt sich selbst (intern, Stufe 1; @RZ-024 bis @RZ-028).
 *
 * - Kanal aus `?k=q|l` (sonst „direkt“); der Zusatz verschwindet danach aus der Adresse, alle anderen Teile bleiben.
 * - „Aufruf“ genau einmal je Laden der Seite, sobald das Turnier erfolgreich geladen ist (nicht bei „nicht gefunden“ oder Fehler).
 * - „Lebenszeichen“ jede Minute, nur solange die Seite sichtbar ist.
 * - „Störung überstanden“ (`stoerung_kurz` / `stoerung_lang`, @RZ-033): jede Meldung aus `usePublicTournament` genau einmal, für das Turnier, in dem sie
 *   stattfand, mit Kanal und Gerät des Öffnens; sonst derselbe Weg wie die übrigen Meldungen.
 * - Eigener Aufruf, nie im Lade-Pfad, ohne Warten; Fehler und Zeitüberschreitung werden verschluckt, nichts wird wiederholt.
 * - Nichts auf dem Gerät: kein Speicher, kein Cookie, keine Kennung (@RZ-027).
 * - Betriebssystem- und Browser-Familie (@RZ-031) kommen vom Server aus der Kennung, die der Browser ohnehin mitschickt; hier wird dafür nichts gelesen.
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  channelFromParam, deviceClassFromEnvironment, isInstalledApp, sendViewCount, HEARTBEAT_INTERVAL_MS,
  type ViewCountKind, type ViewCountTransport, type ViewChannel, type DeviceClass,
} from '../../core/viewCount/publicViewCount';
import type { RecoveredOutage } from '../../core/viewCount/publicOutage';
import { defaultViewCountTransport } from './viewCountTransport';

export interface UsePublicViewCountOptions {
  /** Versandweg (nur für Tests); Vorgabe: der Weg dieser App, `null` = Zählung aus */
  transport?: ViewCountTransport | null;
  /** Die zuletzt überstandene Netzstörung (aus `usePublicTournament`); jede Kennung wird genau einmal gesendet (@RZ-033) */
  outage?: RecoveredOutage | null;
}

interface DeviceFacts { device: DeviceClass; installed: boolean }

/** Geräteart und „installiert“ beim Öffnen der Seite. */
function readDeviceFacts(): DeviceFacts {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { standalone?: boolean });
  const matchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? (q: string) => window.matchMedia(q) : undefined;
  const screenInfo = typeof window === 'undefined' ? undefined : window.screen;
  return {
    device: deviceClassFromEnvironment({ screenWidth: screenInfo?.width, screenHeight: screenInfo?.height, matchMedia }),
    installed: isInstalledApp({ matchMedia, navigatorStandalone: nav?.standalone }),
  };
}

export function usePublicViewCount(shareCode: string, loaded: boolean, options: UsePublicViewCountOptions = {}): void {
  const transport = options.transport === undefined ? defaultViewCountTransport : options.transport;
  const [searchParams, setSearchParams] = useSearchParams();

  // Kanal und Gerät genau einmal beim Öffnen festhalten; der Zusatz in der Adresse wird gleich entfernt.
  const factsRef = useRef<{ channel: ViewChannel } & DeviceFacts | null>(null);
  factsRef.current ??= { channel: channelFromParam(searchParams.get('k')), ...readDeviceFacts() };

  useEffect(() => {
    if (searchParams.has('k')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('k');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const outage = options.outage ?? null;
  const countedCodeRef = useRef<string | null>(null);
  const sentOutageIdRef = useRef(0);
  const transportRef = useRef(transport);
  transportRef.current = transport;

  useEffect(() => {
    const facts = factsRef.current;
    if (!loaded || facts === null) {
      return undefined;
    }
    const send = (art: ViewCountKind): void => {
      const via = transportRef.current;
      if (via === null) {
        return;
      }
      void sendViewCount(via, {
        p_share_code: shareCode, p_art: art, p_kanal: facts.channel, p_geraet: facts.device, p_installiert: facts.installed,
      });
    };
    if (countedCodeRef.current !== shareCode) {
      countedCodeRef.current = shareCode;
      send('aufruf');
    }
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        send('lebenszeichen');
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => { clearInterval(timer); };
  }, [loaded, shareCode]);

  // Überstandene Störung: jede Meldung genau einmal (Kennung merken), ohne Warten, Fehler verschluckt, nie wiederholt (@RZ-035)
  useEffect(() => {
    const facts = factsRef.current;
    if (outage === null || outage.id <= sentOutageIdRef.current) {
      return;
    }
    sentOutageIdRef.current = outage.id;
    const via = transportRef.current;
    if (via !== null && facts !== null) {
      void sendViewCount(via, {
        p_share_code: outage.shareCode, p_art: outage.kind, p_kanal: facts.channel, p_geraet: facts.device, p_installiert: facts.installed,
      });
    }
  }, [outage]);
}
