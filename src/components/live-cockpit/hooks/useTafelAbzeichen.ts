/**
 * useTafelAbzeichen – die stehenden Abzeichen der Tafel für Ton und Bildschirm (Spec § 4.1; @SL-059, @SL-060, @SL-122).
 *
 * Ton: nur im angepfiffenen Spiel, solange der Ton für das Spielende nicht freigegeben ist (antippen gibt ihn frei).
 * Bildschirm: ab dem Anpfiff hält das Cockpit den Bildschirm wach, wenn „Bildschirm an lassen“ eingeschaltet ist – nach dem Abpfiff nur
 * während der 30-Sekunden-Quittung (@SL-152) und nur, wenn ein Folgespiel ansteht; ausgefallen oder letztes Spiel des Felds: die Sperre des
 * Geräts gilt (@SL-060). Lehnt das Gerät ab oder kann es das nicht, steht das Abzeichen „Bildschirm kann sich sperren, die Uhr läuft
 * weiter“ (@SL-122), einmal je Spiel, verdeckt weder Uhr noch Stand. Antippen blendet es aus und zeigt den vollen Text in der Meldezeile
 * (am Handy steht neben anderen Abzeichen sonst nur das Schloss).
 */
import { useEffect, useState } from 'react';
import { useWakeLock, type WakeLockStatus } from '../../../hooks/useWakeLock';
import type { ScoreboardAbzeichenKnopf } from '../../ui/molecules/Scoreboard';
import { istAngepfiffenUndNichtBeendet, type CockpitZustand } from '../model/cockpitPhase';
import type { Uebersetzer } from '../model/cockpitTypes';

interface TafelAbzeichenEingang {
  zustand: CockpitZustand;
  matchId: string | undefined;
  ton: { an: boolean; freigegeben: boolean; aktiviere: () => void };
  wachhalten: boolean;
  t: Uebersetzer;
  /** Nach dem Abpfiff: die Quittung läuft und ein Folgespiel steht an (sonst gilt die Sperre des Geräts). */
  quittungMitFolgespiel?: boolean;
  /** Meldezeile: der volle Text des Abzeichens beim Antippen. */
  melde?: (stufe: 1 | 2 | 3, text: string) => void;
}

/** Zustände, in denen der Bildschirm nicht wach bleiben kann: Ablehnung, fehlende Schnittstelle, keine Antwort. */
const KANN_NICHT: ReadonlySet<WakeLockStatus> = new Set<WakeLockStatus>(['denied', 'unsupported', 'noAnswer']);

export function useTafelAbzeichen({ zustand, matchId, ton, wachhalten, t, quittungMitFolgespiel = false, melde }: TafelAbzeichenEingang): {
  tonHinweis: ScoreboardAbzeichenKnopf | null;
  wachhaltenHinweis: ScoreboardAbzeichenKnopf | null;
} {
  const spielLaeuft = istAngepfiffenUndNichtBeendet(zustand) || (zustand === 'abgepfiffen' && quittungMitFolgespiel);
  const wakeLock = useWakeLock(wachhalten && spielLaeuft);
  // „einmal“ je Spiel: wer das Abzeichen antippt, sieht es in diesem Spiel nicht wieder
  const [ausgeblendetFuer, setAusgeblendetFuer] = useState<string | null>(null);
  const [gezeigtFuer, setGezeigtFuer] = useState<string | null>(null);
  const kannNicht = wachhalten && spielLaeuft && KANN_NICHT.has(wakeLock.status);
  useEffect(() => { if (kannNicht && matchId !== undefined) { setGezeigtFuer(matchId); } }, [kannNicht, matchId]);

  const tonHinweis = ton.an && !ton.freigegeben && istAngepfiffenUndNichtBeendet(zustand)
    ? { label: t('tafel.tonAusAntippen'), kurz: t('tafel.tonAus'), onAntippen: ton.aktiviere }
    : null;
  const wachhaltenHinweis = (kannNicht || (gezeigtFuer === matchId && spielLaeuft)) && matchId !== undefined && ausgeblendetFuer !== matchId
    ? { label: t('tafel.wachhaltenSymbol'), kurz: t('tafel.wachhaltenKurz'), onAntippen: () => { setAusgeblendetFuer(matchId); melde?.(1, t('tafel.wachhaltenSymbol')); } }
    : null;
  return { tonHinweis, wachhaltenHinweis };
}
