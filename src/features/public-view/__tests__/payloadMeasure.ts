/**
 * Byte-Messung und Egress-Rechnung der Zuschauer-Seite (B-15). Nur Testumgebung, ohne Netz und ohne Produktion.
 *
 * Gemessen werden die Nutzlasten aus `payloadFixtures.ts` (Nikolaus-Turnier, 6 Teams, 15 Spiele), komprimiert wie ein
 * Browser sie bekommt (gzip Stufe 6; Brotli zum Vergleich; nie größer als unkomprimiert). Kopfzeilen und Rechenweg
 * folgen dem Messtest P0-7 (`.superpowers/sdd/2026-10-03-mvp-bauplan/p0-4-p0-7-ergebnis.md`, lokaler Stack): Kopfzeilen einer
 * Antwort der Server-Funktion 316 Byte, einer REST-Abfrage 427 Byte, dazu 300 Byte Cloud-Zuschlag je Antwort (Annahme P0-7);
 * Änderungsrate 1 je Minute (Delta-Anteil je Abruf = 1 − e^(−Takt/60 s)); Egress = nur Antworten des Servers; 1 GB = 10^9 B.
 * Die echten Kopfzeilen der Cloud misst B-14 an der echten Funktion nach.
 */
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { deltaOneGoalReply, fullReply, legacyResponses, unchangedReply } from './payloadFixtures';

export const HEADER_BYTES_RPC = 316;
export const HEADER_BYTES_REST = 427;
export const CLOUD_HEADER_SURCHARGE = 300;
const BYTES_PER_MEGABYTE = 1_000_000;
const SECONDS_PER_MINUTE = 60;

/** Bytes auf dem Draht: komprimiert, aber nie größer als unkomprimiert (kleine Antworten werden nicht komprimiert). */
export function wireBytes(body: string): { raw: number; gzip: number; brotli: number; wire: number } {
  const raw = Buffer.byteLength(body);
  const gzip = gzipSync(body).length;
  const brotli = brotliCompressSync(body).length;
  return { raw, gzip, brotli, wire: Math.min(raw, gzip) };
}

export interface ResponseSize {
  label: string;
  /** Antworten je Abruf */
  responses: number;
  raw: number;
  gzip: number;
  brotli: number;
  /** komprimierter Body (nie größer als roh) */
  body: number;
  /** Body plus Kopfzeilen wie im lokalen Stack (P0-7) */
  withHeadersLocal: number;
  /** Body plus Kopfzeilen plus Cloud-Zuschlag (Annahme P0-7) */
  withHeadersCloud: number;
}

function sizeOf(label: string, bodies: readonly string[], headerBytes: number): ResponseSize {
  const parts = bodies.map(wireBytes);
  const sum = (pick: (part: ReturnType<typeof wireBytes>) => number): number => parts.reduce((total, part) => total + pick(part), 0);
  return {
    label,
    responses: bodies.length,
    raw: sum((part) => part.raw),
    gzip: sum((part) => part.gzip),
    brotli: sum((part) => part.brotli),
    body: sum((part) => part.wire),
    withHeadersLocal: sum((part) => part.wire) + headerBytes * bodies.length,
    withHeadersCloud: sum((part) => part.wire) + (headerBytes + CLOUD_HEADER_SURCHARGE) * bodies.length,
  };
}

export interface Measurements {
  /** Weg (a): ein Abruf = drei Antworten (Turnier, Teams, Spiele) */
  legacy: ResponseSize;
  /** Weg (b), Stub des Vertrags */
  full: ResponseSize;
  delta: ResponseSize;
  unchanged: ResponseSize;
}

export function measure(): Measurements {
  const legacy = legacyResponses();
  return {
    legacy: sizeOf('Weg (a) heute: Turnier + Teams + Spiele (3 Antworten)', [legacy.tournament, legacy.teams, legacy.matches], HEADER_BYTES_REST),
    full: sizeOf('Weg (b) Voll-Antwort', [JSON.stringify(fullReply())], HEADER_BYTES_RPC),
    delta: sizeOf('Weg (b) Delta „1 Tor“', [JSON.stringify(deltaOneGoalReply())], HEADER_BYTES_RPC),
    unchanged: sizeOf('Weg (b) keine Änderung', [JSON.stringify(unchangedReply())], HEADER_BYTES_RPC),
  };
}

// --- Egress-Rechnung (Formel des Plans B-15, Rechenweg P0-7) ------------------------------------------------------------

export interface EgressScenario {
  viewers: number;
  hours: number;
  screens: number;
  /** Takt der Zuschauer im Vordergrund (Sekunden) */
  viewerPollSeconds: number;
  /** Takt der Bildschirme (Sekunden): heute 5, künftig 2 (E-A3) */
  screenPollSecondsLegacy: number;
  screenPollSecondsRpc: number;
  /** Änderungen am Turnierstand je Minute (Tor, Anpfiff, Abpfiff, Korrektur) */
  changesPerMinute: number;
  /** Voll-Ladungen je Zuschauer über den Tag: Öffnen (Weg b: einmal; Neuladen zählt hier nicht extra) */
  fullLoadsPerViewer: number;
}

/** Annahmen des Auftrags: 5 Stunden; Rest wie P0-7. */
export const NIKOLAUS_SCENARIO: Omit<EgressScenario, 'viewers'> = {
  hours: 5,
  screens: 2,
  viewerPollSeconds: 10,
  screenPollSecondsLegacy: 5,
  screenPollSecondsRpc: 2,
  changesPerMinute: 1,
  fullLoadsPerViewer: 1,
};

export interface EgressResult {
  viewers: number;
  /** MB je Turniertag */
  legacyMegabytes: number;
  rpcMegabytes: number;
}

/**
 * Egress eines Turniertags. Weg (a): jede Abfrage lädt alles (Zuschauer im 10-s-Takt, Bildschirme alle 5 s).
 * Weg (b): „keine Änderung“; mit Wahrscheinlichkeit p = 1 − e^(−Takt · Änderungen) das Delta; jeder Client einmal voll.
 */
export function egress(scenario: EgressScenario, sizes: Measurements, headers: 'local' | 'cloud' = 'cloud'): EgressResult {
  const bytes = (size: ResponseSize): number => (headers === 'cloud' ? size.withHeadersCloud : size.withHeadersLocal);
  const seconds = scenario.hours * 3600;
  const viewerPolls = scenario.viewers * (seconds / scenario.viewerPollSeconds);
  const legacyScreenPolls = scenario.screens * (seconds / scenario.screenPollSecondsLegacy);
  const rpcScreenPolls = scenario.screens * (seconds / scenario.screenPollSecondsRpc);
  const deltaShare = (pollSeconds: number): number => 1 - Math.exp(-(pollSeconds / SECONDS_PER_MINUTE) * scenario.changesPerMinute);

  const legacy = (viewerPolls + legacyScreenPolls) * bytes(sizes.legacy);
  const rpcPolls = (polls: number, pollSeconds: number): number => polls * (deltaShare(pollSeconds) * bytes(sizes.delta) + (1 - deltaShare(pollSeconds)) * bytes(sizes.unchanged));
  const rpc = rpcPolls(viewerPolls, scenario.viewerPollSeconds)
    + rpcPolls(rpcScreenPolls, scenario.screenPollSecondsRpc)
    + (scenario.viewers * scenario.fullLoadsPerViewer + scenario.screens) * bytes(sizes.full);

  return { viewers: scenario.viewers, legacyMegabytes: legacy / BYTES_PER_MEGABYTE, rpcMegabytes: rpc / BYTES_PER_MEGABYTE };
}

/** Messtest P0-7, Weg (b), 300 Zuschauer + 3 Bildschirme, 5 h, komprimiert (MB je Tag); zum Vergleich (Abweichung > 25 % melden). */
export const P0_7_RPC_MEGABYTES_PER_DAY = 389;
/** Messtest P0-7, „Weg (a) hypothetisch“: Zuschauer im 10-s-Takt voll + Bildschirme 2 s voll (MB je Tag, komprimiert). */
export const P0_7_LEGACY_POLLING_MEGABYTES_PER_DAY = 2489;
