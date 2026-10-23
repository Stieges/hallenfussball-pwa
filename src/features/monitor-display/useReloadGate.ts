/**
 * Verdrahtung des Neulade-Tors am Monitor (B-19b, @ZM-124, @ZM-128, @ME-012).
 *
 * Die Regel steht in `monitorReloadGate.ts`. Dieser Hook zählt die Folienwechsel seit dem Eintreffen einer neuen
 * Version (das Tor meldet das über `onUpdateWaiting`) und bewertet das Tor bei jeder Änderung neu, die die Regel
 * ändern kann (Folie, Spielstand).
 */
import { useEffect, useRef } from 'react';
import { attachReloadGate, notifyReloadGate } from '../../lib/swRegistration';
import { neuladenErlaubt } from './monitorReloadGate';
import type { ProgramSlide, RuleMatch } from './slideProgramme';

export function useReloadGate(
  slides: readonly ProgramSlide[],
  matches: readonly RuleMatch[] | undefined,
  index: number,
): void {
  // Refs: das Tor liest den jeweils aktuellen Stand, ohne neu gesetzt zu werden.
  const aktuell = useRef({ slides, matches: matches ?? [], index });
  aktuell.current = { slides, matches: matches ?? [], index };
  const wechselRef = useRef(0);
  const letzteFolie = useRef<number | null>(null);

  // Folienwechsel zählen (der erste Stand zählt nicht).
  useEffect(() => {
    if (letzteFolie.current !== null && letzteFolie.current !== index) {
      wechselRef.current += 1;
    }
    letzteFolie.current = index;
  }, [index]);

  // Tor setzen, solange der Monitor da ist.
  useEffect(() => {
    attachReloadGate({
      allowsReload: () => neuladenErlaubt({
        slides: aktuell.current.slides,
        matches: aktuell.current.matches,
        index: aktuell.current.index,
        wechselSeitUpdate: wechselRef.current,
      }),
      onUpdateWaiting: () => { wechselRef.current = 0; },
    });
    return () => { attachReloadGate(null); };
  }, []);

  // Bei jeder Änderung, die die Regel ändern kann, neu bewerten (Folie oder Spieldaten).
  useEffect(() => {
    notifyReloadGate();
  }, [index, matches]);
}
