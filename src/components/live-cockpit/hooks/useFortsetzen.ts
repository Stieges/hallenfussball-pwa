/**
 * useFortsetzen (LT-6): „Spiel fortsetzen“ nach dem Abpfiff – ob die Taste steht, das Blatt mit der Restzeit und das Senden.
 *
 * Die Taste steht nur, solange `fortsetzenMoeglich` gilt (30 Sekunden Endstand, nicht nach „Weiter“, Steuerrecht, Engine lässt es
 * zu; @SL-074, @SL-075, @SL-162). Endet das während das Blatt offen ist (30 Sekunden um, „Weiter“, Steuer verloren), schließt es
 * ohne Befehl – ein Fortsetzen nach der Frist schickt das Gerät nie. Gesendet wird ein REOPEN mit dem Uhrstand aus der
 * Restzeit; kommt es erst spät am Server an, legt der Server es zur Klärung (@SL-147, Migration 20261118_009).
 */
import { useCallback, useEffect, useState } from 'react';
import type { PhaseView } from '../engine/phaseView';
import { fortsetzenMoeglich, fortsetzenUhrMs, restGrenzenOf, type RestGrenzen } from '../model/fortsetzen';

export interface FortsetzenArgs {
  engineView: PhaseView | null;
  kannSteuern: boolean;
  endstandSteht: boolean;
  /** REOPEN mit Uhrstand (absolute Spieluhr, ms); ID des Eintrags oder `null` bei Ablehnung. */
  reopen: (clockMs: number) => Promise<string | null>;
  melde: (stufe: 2 | 3, text: string) => void;
  /** Bestätigung in der Meldezeile nach dem Senden („Spiel fortgesetzt“). */
  meldung: string;
}

export interface Fortsetzen {
  moeglich: boolean;
  offen: boolean;
  /** Grenzen der Restzeit; `null`, solange nicht angeboten. */
  grenzen: RestGrenzen | null;
  oeffne: () => void;
  schliesse: () => void;
  /** Restzeit in Sekunden übernehmen: Spiel läuft weiter. */
  bestaetige: (restSekunden: number) => void;
}

export function useFortsetzen({ engineView, kannSteuern, endstandSteht, reopen, melde, meldung }: FortsetzenArgs): Fortsetzen {
  const moeglich = fortsetzenMoeglich(engineView, { kannSteuern, endstandSteht });
  const [offen, setOffen] = useState(false);
  useEffect(() => { if (!moeglich) { setOffen(false); } }, [moeglich]);

  const bestaetige = useCallback((restSekunden: number) => {
    setOffen(false);
    if (!moeglich || engineView === null) { return; }
    void reopen(fortsetzenUhrMs(engineView, restSekunden)).then((id) => { if (id !== null) { melde(3, meldung); } });
  }, [moeglich, engineView, reopen, melde, meldung]);

  const oeffne = useCallback(() => { setOffen(true); }, []);
  const schliesse = useCallback(() => { setOffen(false); }, []);

  return {
    moeglich,
    offen: offen && moeglich,
    grenzen: moeglich && engineView ? restGrenzenOf(engineView) : null,
    oeffne,
    schliesse,
    bestaetige,
  };
}
