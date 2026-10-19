/**
 * useScoreDraft – gemeinsamer Eingabestand für zwei Tor-Felder (@FU-101).
 *
 * Jede Ziffer bleibt lokal. Gespeichert wird erst bei Enter oder beim Verlassen eines Feldes, Escape verwirft.
 * Nur ganze Zahlen ab 0 werden angenommen (`-3`, `1e1`, `2,5`, Buchstaben: kein Senden, `invalid` ist gesetzt).
 * Doppelschutz: Enter und danach Verlassen sendet genau einmal. Meldet `onCommit` per Rückgabe `false` (bzw. eine
 * abgelehnte Zusage), dass nichts gespeichert wurde (@FU-093 „Nein“, @FU-097 „Abbrechen“, Ablehnung), zeigen
 * die Felder wieder den gespeicherten Stand, und derselbe Stand lässt sich erneut senden.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, FocusEvent } from 'react';

export type ScoreSide = 'a' | 'b';

/** `false` = nicht gespeichert. Alles andere (auch `undefined`) gilt als „gesendet“. */
export type ScoreCommitResult = boolean | undefined | Promise<boolean | undefined>;

export interface UseScoreDraftOptions {
  /** Wechselt das Spiel, wird der Entwurf verworfen */
  resetKey: string;
  scoreA: number | undefined;
  scoreB: number | undefined;
  onCommit: (scoreA: number, scoreB: number) => ScoreCommitResult;
}

export interface ScoreFieldProps {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export interface ScoreDraft {
  invalid: boolean;
  fieldProps: (side: ScoreSide) => ScoreFieldProps;
}

const WHOLE_NUMBER = /^\d+$/;
const asText = (score: number | undefined): string => (score === undefined ? '' : String(score));

interface Pair {
  a: number | undefined;
  b: number | undefined;
}

export function useScoreDraft({ resetKey, scoreA, scoreB, onCommit }: UseScoreDraftOptions): ScoreDraft {
  const [a, setA] = useState(asText(scoreA));
  const [b, setB] = useState(asText(scoreB));
  const [invalid, setInvalid] = useState(false);
  const savedRef = useRef<Pair>({ a: scoreA, b: scoreB });
  const sentRef = useRef<Pair | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Neuer Stand von außen (Speichern angekommen, anderes Gerät, anderes Spiel): Entwurf und Doppelschutz zurücksetzen
  useEffect(() => {
    savedRef.current = { a: scoreA, b: scoreB };
    sentRef.current = null;
    setA(asText(scoreA));
    setB(asText(scoreB));
    setInvalid(false);
  }, [resetKey, scoreA, scoreB]);

  const showSaved = useCallback(() => {
    sentRef.current = null;
    setA(asText(savedRef.current.a));
    setB(asText(savedRef.current.b));
    setInvalid(false);
  }, []);

  const commit = useCallback((valueA: string, valueB: string, badInput: boolean) => {
    if (badInput || (valueA !== '' && !WHOLE_NUMBER.test(valueA)) || (valueB !== '' && !WHOLE_NUMBER.test(valueB))) {
      setInvalid(true);
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
    onChange: (event) => {
      sentRef.current = null;
      setInvalid(false);
      (side === 'a' ? setA : setB)(event.target.value);
    },
    onBlur: (event) => commit(a, b, event.currentTarget.validity.badInput),
    onKeyDown: (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit(a, b, event.currentTarget.validity.badInput);
      } else if (event.key === 'Escape') {
        showSaved();
      }
    },
  });

  return { invalid, fieldProps };
}
