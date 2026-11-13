/**
 * useAnderesFensterTont(lokal) – tönt schon ein anderes Fenster dieses Geräts? (H4-8, @HT-033 Zeile 8, Nachtrag 13.11.)
 * Nur gefragt, solange dieses Fenster auf „Ton nicht aktiv“ steht (die einzige Lage, in der der Hinweis „hier klicken“ stünde); sofort
 * beim Einbinden, danach alle `ABFRAGE_MS`, damit der Hinweis zurückspringt, wenn das andere Fenster schließt. Reiner Lesezugriff auf
 * `navigator.locks.query`, keine Sperre wird angefordert (`anderesFenster.ts`).
 */
import { useEffect, useState } from 'react';
import { tonNichtAktivLokal, type LokaleLage } from './hallAnzeige';
import { browserSperrAbfrage, haeltEinFensterDieSperre } from './runtime/anderesFenster';

export const ABFRAGE_MS = 3000;

export function useAnderesFensterTont(lokal: LokaleLage | null): boolean {
  const gefragt = tonNichtAktivLokal(lokal);
  const [gehalten, setGehalten] = useState(false);
  useEffect(() => {
    if (!gefragt) {
      setGehalten(false);
      return undefined;
    }
    let lebt = true;
    const frage = (): void => {
      void haeltEinFensterDieSperre(browserSperrAbfrage()).then((halten) => {
        if (lebt) {
          setGehalten(halten);
        }
      });
    };
    frage();
    const takt = window.setInterval(frage, ABFRAGE_MS);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [gefragt]);
  return gefragt && gehalten;
}
