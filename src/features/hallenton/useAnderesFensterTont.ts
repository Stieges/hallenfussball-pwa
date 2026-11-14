/**
 * useAnderesFensterTont(lokal) – tönt schon ein anderes Fenster dieses Geräts? (H4-8, @HT-033 Zeile 8, Nachtrag 13.11.)
 * Nur gefragt, solange dieses Fenster auf „Ton nicht aktiv“ steht (die einzige Lage, in der der Hinweis „hier klicken“ stünde); sofort
 * beim Einbinden, danach alle `ABFRAGE_MS`, damit der Hinweis zurückspringt, wenn das andere Fenster schließt. Reiner Lesezugriff auf
 * `navigator.locks.query`, keine Sperre wird angefordert (`runtime/anderesFenster.ts`).
 * H4-9 (k7): Kopfzeile, Streifen und Seite teilen EINE Abfrage je Fenster (`runtime/anderesFensterGeteilt.ts`, subscribe/getSnapshot).
 */
import { useSyncExternalStore } from 'react';
import { tonNichtAktivLokal, type LokaleLage } from './hallAnzeige';
import { abonniereAnderesFenster, anderesFensterGehalten } from './runtime/anderesFensterGeteilt';

export { ABFRAGE_MS } from './runtime/anderesFensterGeteilt';

const nieAbonniert = (): (() => void) => () => undefined;
const keinFenster = (): boolean => false;

export function useAnderesFensterTont(lokal: LokaleLage | null): boolean {
  const gefragt = tonNichtAktivLokal(lokal);
  const gehalten = useSyncExternalStore(gefragt ? abonniereAnderesFenster : nieAbonniert, anderesFensterGehalten, keinFenster);
  return gefragt && gehalten;
}
