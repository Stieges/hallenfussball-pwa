/**
 * useTesttonHalle – „Testton in der Halle“ je Feld als Zustand und Handlung (aus `TesttonAbschnitt`, H4-11; @HT-017, @HT-041, @HT-049, @HT-053): die
 * Taste im Abschnitt „Testton“, die Empfehlung nach einer Ausgangswahl und die Pille „🔈? Prüfen“ lösen denselben Auftrag aus und lesen dieselbe Quittung.
 * Ohne aktuellen Stand kein Aufruf („Kein Testton: kein Netz“). Ist der Lautsprecher nicht bereit, geht gar kein Auftrag raus (ein spätes Nachholen in
 * der Halle wäre schlimmer als die Auskunft). Läuft auf dem Feld ein Spiel, fragt zuerst die Rückfrage (@HT-017); ohne Bestätigen geht nichts raus.
 * Nur die Quittung des in dieser Sitzung ausgelösten Auftrags zählt; ein älterer Test am Server nie.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { HallFehlerGrund, HallStatusAntwort } from '../../../core/repositories/hallentonRpc';
import type { HallStatus } from '../useHallStatus';
import { echterZeitgeber } from '../runtime/zeitgeber';
import type { FeldKarte } from './feldKarten';
import { formatUhrzeit } from './uhrzeit';
import type { AnhoerenRueckfrage } from './useAnhoerenRueckfrage';

/** So lange wartet die Anzeige auf die Quittung, bevor sie „keine Antwort“ sagt (der Lautsprecher meldet alle 5 s). */
export const QUITTUNG_WARTEN_MS = 15_000;

/** `laeuft`: der in DIESER Sitzung ausgelöste Auftrag (Kennung + Start, lokal gemessen); `gespielt`: seine Quittung (Uhrzeit aus Serverzeit). */
export type TesttonErgebnis =
  | { art: 'laeuft'; testId: string; seit: number }
  | { art: 'gespielt'; zeit: string }
  | { art: 'text'; text: string; warn: boolean };

export interface TesttonHalle {
  ergebnisse: Readonly<Record<number, TesttonErgebnis>>;
  /** Wie die Taste „Testton in der Halle“ des Felds. */
  ausloesen(feld: number): void;
}

const FEHLER_TEXT = {
  netz: 'testton.keinNetz', kein_recht: 'testton.keinRecht', turnier_beendet: 'testton.beendet', ungueltig: 'testton.fehler', antwort_unbekannt: 'testton.fehler',
} as const satisfies Record<HallFehlerGrund, string>;

export function nichtGespielt(karte: FeldKarte, t: TFunction<'hallenton'>): string | null {
  const z = karte.zustand;
  switch (z.art) {
    case 'nichtBereit': return t('feld.zustand.nichtBereit', { grund: t(`feld.grund.${z.grund}`) });
    case 'zustandUnbekannt': return t('feld.zustand.zustandUnbekannt');
    case 'meldetSichNicht': return t('testton.nichtGespieltMeldetSich', { zeit: z.zuletzt });
    default: return null;
  }
}

/** Uhrzeit der Quittung (Serverzeit) – nur für genau diesen Test; ein älterer Test des Lautsprechers am Server zählt nie. */
function gespielteZeit(antwort: HallStatusAntwort | null, feld: number, sprache: string, testId: string): string | null {
  if (antwort?.sicht !== 'voll') {
    return null;
  }
  const test = antwort.speakers.find((s) => s.field === feld)?.test;
  const gespielt = test?.playedAt ?? null;
  if (!test || gespielt === null) {
    return null;
  }
  return test.testId === testId ? formatUhrzeit(gespielt, sprache) : null;
}

export function useTesttonHalle(karten: readonly FeldKarte[], status: Pick<HallStatus, 'stand' | 'antwort' | 'testtonAnfordern'>, rueckfrage: AnhoerenRueckfrage): TesttonHalle {
  const { t, i18n } = useTranslation('hallenton');
  const [ergebnisse, setErgebnisse] = useState<Readonly<Record<number, TesttonErgebnis>>>({});
  const setze = useCallback((feld: number, e: TesttonErgebnis) => setErgebnisse((alt) => ({ ...alt, [feld]: e })), []);

  // Die Quittung des eigenen Auftrags (gleiche Kennung) ersetzt „läuft“ für immer; ein älterer Test am Server zählt nie (@HT-017)
  useEffect(() => {
    setErgebnisse((alt) => {
      let geaendert = false;
      const neu: Record<number, TesttonErgebnis> = { ...alt };
      for (const [feld, e] of Object.entries(alt)) {
        const zeit = e.art === 'laeuft' ? gespielteZeit(status.antwort, Number(feld), i18n.language, e.testId) : null;
        if (zeit !== null) {
          neu[Number(feld)] = { art: 'gespielt', zeit };
          geaendert = true;
        }
      }
      return geaendert ? neu : alt;
    });
  }, [status.antwort, i18n.language]);

  // Je Feld eine eigene Frist ab seinem Start: ein zweiter Auftrag verlängert die des ersten nicht (R2, H4-9: als Liste, nicht als Text)
  const fristen = useMemo(
    () => Object.entries(ergebnisse).flatMap(([feld, e]) => (e.art === 'laeuft' ? [{ feld: Number(feld), testId: e.testId, seit: e.seit }] : [])),
    [ergebnisse],
  );
  useEffect(() => {
    const timers = fristen.map(({ feld, testId, seit }) => window.setTimeout(() => {
      setErgebnisse((alt) => {
        const e = alt[feld];
        return e?.art === 'laeuft' && e.testId === testId ? { ...alt, [feld]: { art: 'text', text: t('testton.keineAntwort'), warn: true } } : alt;
      });
    }, Math.max(0, seit + QUITTUNG_WARTEN_MS - echterZeitgeber.jetzt())));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [fristen, t]);

  const anfordern = useCallback(async (feld: number): Promise<void> => {
    const antwort = await status.testtonAnfordern(feld);
    if (!antwort.ok) {
      setze(feld, { art: 'text', text: t(FEHLER_TEXT[antwort.grund]), warn: true });
    } else if (antwort.status === 'requested') {
      setze(feld, { art: 'laeuft', testId: antwort.testId, seit: echterZeitgeber.jetzt() });
    } else {
      setze(feld, { art: 'text', text: antwort.status === 'too_soon' ? t('testton.zuFrueh') : t('testton.keinLautsprecher'), warn: true });
    }
  }, [status, setze, t]);

  const ausloesen = useCallback((feld: number): void => {
    const karte = karten.find((k) => k.feld === feld);
    if (karte === undefined) {
      return;
    }
    const grund = nichtGespielt(karte, t);
    if (status.stand === 'laedt') {
      return; // die erste Antwort steht noch aus: kein „kein Netz“, die Taste ist bis dahin aus
    }
    if (status.stand !== 'aktuell') {
      setze(feld, { art: 'text', text: t('testton.keinNetz'), warn: true });
    } else if (grund !== null) {
      setze(feld, { art: 'text', text: grund, warn: true });
    } else {
      rueckfrage.fragen('testton', [feld], () => { void anfordern(feld); }); // läuft ein Spiel auf dem Feld, erst die Rückfrage (@HT-017)
    }
  }, [karten, status.stand, t, setze, rueckfrage, anfordern]);

  return useMemo(() => ({ ergebnisse, ausloesen }), [ergebnisse, ausloesen]);
}
