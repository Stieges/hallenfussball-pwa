/**
 * useAutoSectionEnd (B-08b): der Abschnitt endet bei Ablauf von selbst, genau einmal. Ersetzt den
 * automatischen Abpfiff aus `useClockControls`.
 *
 * Es gibt einen einzigen Zeitgeber bis zur Grenze (`PhaseView.limitAt`, Serverzeit); springt die Uhr des Geräts
 * (Zeitabgleich, Schlaf), löst die nächste Ansicht (Takt 250 ms) das Ende aus, ohne ihn: nicht der letzte Abschnitt ->
 * `endSection`, letzter Abschnitt oder Verlängerung -> `finish`, jeweils mit der exakten Grenze (`timing`: Spielzeit
 * und Zeitpunkt der Grenze, nicht des späten Ticks) und einer festen Ereignis-ID (`autoEndEventId`), damit zwei
 * Geräte dasselbe Ereignis erzeugen. Schutz vor Doppeln: ein Schlüssel je Abschnitt in einer Ref, eine Web-Sperre
 * für mehrere Tabs desselben Geräts, nie ohne Steuer-Recht, nie außerhalb des laufenden Abschnitts. Eine Ablehnung
 * oder ein Noop bleibt still. Szenarien: @SL-005, @SL-008, @SL-009, @SL-070, @FU-070.
 */
import { useEffect, useRef } from 'react';
import { autoEndEventId } from '../../../core/match/client';
import type { EngineClockCommands } from '../../../hooks/useEngineClockCommands';
import type { PhaseView } from '../engine/phaseView';

export interface SectionEnded {
  /** ID des gesendeten Ende-Ereignisses (`null`: nichts gespeichert). */
  eventId: string | null;
  kind: 'section' | 'match';
}

export interface AutoSectionEndParams {
  matchId: string | null;
  /** Engine-Ansicht; `null` ohne Engine-Kopie (dann endet nichts von selbst). */
  view: PhaseView | null;
  /** Steuerndes Gerät (nicht schreibgeschützt); das Ende von selbst gilt fürs MVP immer. */
  enabled: boolean;
  /** Serverzeit (Engine-Uhr). */
  serverNow: () => number;
  commands: Pick<EngineClockCommands, 'endSection' | 'finish'>;
  onEnded: (ended: SectionEnded) => void;
}

/** Web-Sperre je Spiel, falls vorhanden: nur der Tab, der sie bekommt, sendet. */
async function mitSperre(matchId: string, job: () => Promise<void>): Promise<void> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) { await job(); return; }
  await locks.request(`auto-end:${matchId}`, { ifAvailable: true }, async (lock) => {
    if (lock !== null) { await job(); }
  });
}

export function useAutoSectionEnd({ matchId, view, enabled, serverNow, commands, onEnded }: AutoSectionEndParams): void {
  const latest = useRef({ serverNow, commands, onEnded });
  useEffect(() => { latest.current = { serverNow, commands, onEnded }; });
  /** Schlüssel der Abschnitte, deren Ende schon ausgelöst wurde (einmal je Abschnitt). */
  const ausgeloest = useRef<Set<string>>(new Set());

  const status = view?.status;
  const phase = view?.phase;
  const section = view?.section;
  const letzter = view?.isLastRegularSection;
  const limitClockMs = view?.limitClockMs;
  const limitAt = view?.limitAt ?? null;
  const reopenCount = view?.reopenCount;
  // Fällig laut Uhr dieser Ansicht: Netz gegen einen Zeitgeber, der nach einem Uhrsprung oder Schlaf zu spät oder gar nicht feuert.
  const faellig = limitAt !== null && serverNow() >= limitAt;

  useEffect(() => {
    if (
      !enabled || matchId === null || status !== 'running' || (phase !== 'regular' && phase !== 'overtime') ||
      limitAt === null || section === undefined || limitClockMs === undefined || reopenCount === undefined
    ) {
      return undefined;
    }
    const kind = letzter === true || phase === 'overtime' ? 'MATCH_END' : 'SECTION_END';
    const schluessel = `${matchId}:${kind}:${section}:${limitClockMs}:${reopenCount}`;
    if (ausgeloest.current.has(schluessel)) { return undefined; }

    const senden = async (): Promise<void> => {
      if (ausgeloest.current.has(schluessel)) { return; }
      ausgeloest.current.add(schluessel);
      const timing = {
        clockMs: limitClockMs, at: limitAt, section,
        id: autoEndEventId({ matchId, kind, section, limitClockMs, reopenCount }),
      };
      const { commands } = latest.current;
      const eventId = kind === 'MATCH_END' ? await commands.finish(timing, { silent: true }) : await commands.endSection(timing, { silent: true });
      latest.current.onEnded({ eventId, kind: kind === 'MATCH_END' ? 'match' : 'section' });
    };
    const timer = setTimeout(() => { void mitSperre(matchId, senden); }, Math.max(0, limitAt - latest.current.serverNow()));
    return () => { clearTimeout(timer); };
  }, [enabled, matchId, status, phase, section, letzter, limitClockMs, limitAt, reopenCount, faellig]);
}
