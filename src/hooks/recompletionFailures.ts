/**
 * A-15b, Review #384 M3 (@TM-150 Zeile 2 „ohne dass ‚Besetzung prüfen‘ erscheint“): welche erneuten Abschlüsse sind auf diesem
 * Gerät gescheitert? Solange der Auslöser eine veraltete Gruppe gleich erledigt, zeigt die Tabelle kein „Besetzung prüfen“; ist
 * sein Versuch gescheitert (Ablehnung oder Fehler), erscheint der Hinweis wieder. Kleiner Speicher im Speicher der Seite, je
 * Anfrage-Stand (`recompletionKey`).
 */
import { useSyncExternalStore } from 'react';

const failed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  listeners.forEach((listener) => { listener(); });
}

export function markRecompletionFailed(key: string): void {
  if (!failed.has(key)) {
    failed.add(key);
    notify();
  }
}

export function clearRecompletionFailed(key: string): void {
  if (failed.delete(key)) {
    notify();
  }
}

export function recompletionFailed(key: string): boolean {
  return failed.has(key);
}

/** Nur für Tests: alles vergessen. */
export function resetRecompletionFailures(): void {
  failed.clear();
  notify();
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Ändert sich, sobald ein Versuch scheitert oder wieder gelingt (für Ansichten, die davon abhängen). */
export function useRecompletionFailuresVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
