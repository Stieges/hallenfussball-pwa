/**
 * useSperreAktion – eine Aktion mit Sperre gegen Doppelauslösen (@OB-087): `starte` ruft die Aktion höchstens einmal zugleich auf (Sperre per
 * `ref`, also auch bei zwei Tipps im selben Takt, bevor die Oberfläche neu gezeichnet wurde) und meldet `laeuft`, bis sie fertig ist.
 * Die Aktion wird synchron aufgerufen – auch wo ein Browser-Recht an der Geste hängt (Ton aktivieren). Eine Ablehnung wird nicht
 * weitergereicht; was die Aktion sonst meldet (Toast, Zustand), bleibt Sache der Aktion.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSperreAktion(aktion: () => unknown): { starte: () => void; laeuft: boolean } {
  const [laeuft, setLaeuft] = useState(false);
  const aktiv = useRef(false);
  const lebt = useRef(true);
  const neueste = useRef(aktion);
  neueste.current = aktion;
  useEffect(() => {
    lebt.current = true;
    return () => { lebt.current = false; };
  }, []);
  const starte = useCallback(() => {
    if (aktiv.current) { return; }
    aktiv.current = true;
    setLaeuft(true);
    let ergebnis: unknown;
    try {
      ergebnis = neueste.current();
    } catch {
      ergebnis = undefined;
    }
    void Promise.resolve(ergebnis).catch(() => undefined).then(() => {
      aktiv.current = false;
      if (lebt.current) { setLaeuft(false); }
    });
  }, []);
  return { starte, laeuft };
}
