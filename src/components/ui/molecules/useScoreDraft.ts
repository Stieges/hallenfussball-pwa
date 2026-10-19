/**
 * useScoreDraft – gemeinsamer Eingabestand für zwei Tor-Felder (@FU-101).
 *
 * Jede Ziffer bleibt lokal. Gespeichert wird erst bei Enter oder beim Verlassen eines Feldes, Escape verwirft.
 * Nur ganze Zahlen ab 0 werden angenommen (`-3`, `1e1`, `2,5`, Buchstaben: kein Senden, `invalid` ist gesetzt).
 * Doppelschutz: Enter und danach Verlassen sendet genau einmal. Meldet `onCommit` per Rückgabe `false` (bzw. eine
 * abgelehnte Zusage), dass nichts gespeichert wurde (@FU-093 „Nein“, @FU-097 „Abbrechen“, Ablehnung), zeigen
 * die Felder wieder den gespeicherten Stand, und derselbe Stand lässt sich erneut senden.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ScoreFieldProps } from '../atoms/ScoreDraftInput';

export type ScoreSide = 'a' | 'b';

/** `false` = nicht gespeichert. Alles andere (auch `undefined`) gilt als „gesendet“. */
export type ScoreCommitResult = boolean | undefined | Promise<boolean | undefined>;

export interface UseScoreDraftOptions {
  /** Wechselt das Spiel, wird der Entwurf verworfen */
  resetKey: string;
  /** Gespeicherter Stand (nicht der Entwurf) */
  savedA: number | undefined;
  savedB: number | undefined;
  onCommit: (scoreA: number, scoreB: number) => ScoreCommitResult;
}

export interface ScoreDraft {
  /** Mindestens ein Feld ist ungültig: der Hinweis ist sichtbar */
  invalid: boolean;
  /** Id für den Hinweis (`aria-describedby`) */
  hintId: string;
  fieldProps: (side: ScoreSide) => ScoreFieldProps;
}

const WHOLE_NUMBER = /^\d+$/;
const NONE_INVALID: Record<ScoreSide, boolean> = { a: false, b: false };
const asText = (score: number | undefined): string => (score === undefined ? '' : String(score));

interface Pair {
  a: number | undefined;
  b: number | undefined;
}

export function useScoreDraft({ resetKey, savedA, savedB, onCommit }: UseScoreDraftOptions): ScoreDraft {
  const [a, setA] = useState(asText(savedA));
  const [b, setB] = useState(asText(savedB));
  const hintId = useId();
  const [invalidSides, setInvalidSides] = useState<Record<ScoreSide, boolean>>({ a: false, b: false });
  const savedRef = useRef<Pair>({ a: savedA, b: savedB });
  const sentRef = useRef<Pair | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Neuer Stand von außen (Speichern angekommen, anderes Gerät, anderes Spiel): Entwurf und Doppelschutz zurücksetzen
  useEffect(() => {
    savedRef.current = { a: savedA, b: savedB };
    sentRef.current = null;
    setA(asText(savedA));
    setB(asText(savedB));
    setInvalidSides(NONE_INVALID);
  }, [resetKey, savedA, savedB]);

  const showSaved = useCallback(() => {
    sentRef.current = null;
    setA(asText(savedRef.current.a));
    setB(asText(savedRef.current.b));
    setInvalidSides(NONE_INVALID);
  }, []);

  const commit = useCallback((valueA: string, valueB: string, badInputSide: ScoreSide | null) => {
    const badA = badInputSide === 'a' || (valueA !== '' && !WHOLE_NUMBER.test(valueA));
    const badB = badInputSide === 'b' || (valueB !== '' && !WHOLE_NUMBER.test(valueB));
    if (badA || badB) {
      setInvalidSides({ a: badA, b: badB });
      return;
    }
    if (valueA === '' || valueB === '') {
      return;
    }
    const goalsA = parseInt(valueA, 10);
    const goalsB = parseInt(valueB, 10);
    const next: Pair = { a: goalsA, b: goalsB };
    const saved = savedRef.current;
    const sent = sentRef.current;
    if ((saved.a === goalsA && saved.b === goalsB) || (sent !== null && sent.a === goalsA && sent.b === goalsB)) {
      return;
    }
    sentRef.current = next;
    const stillCurrent = () => sentRef.current === next;
    try {
      Promise.resolve(onCommitRef.current(goalsA, goalsB)).then(
        (result) => {
          if (result === false && stillCurrent()) {
            showSaved();
          }
        },
        () => {
          if (stillCurrent()) {
            showSaved();
          }
        },
      );
    } catch {
      showSaved();
    }
  }, [showSaved]);

  const fieldProps = (side: ScoreSide): ScoreFieldProps => ({
    value: side === 'a' ? a : b,
    invalid: invalidSides[side],
    describedBy: hintId,
    onChange: (event) => {
      sentRef.current = null;
      setInvalidSides(NONE_INVALID);
      (side === 'a' ? setA : setB)(event.target.value);
    },
    onBlur: (event) => commit(a, b, event.currentTarget.validity.badInput ? side : null),
    onKeyDown: (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit(a, b, event.currentTarget.validity.badInput ? side : null);
      } else if (event.key === 'Escape') {
        showSaved();
      }
    },
  });

  return { invalid: invalidSides.a || invalidSides.b, hintId, fieldProps };
}
