/**
 * useHallentonDaten(tid, felderAnzahl) – alles, was der Unterpunkt „Hallenton“ zum Anzeigen braucht (H4-8): Stand am Server (geteilte
 * Abfrage, H4-5), lokaler Zustand dieses Geräts, `hallAnzeige` (eine Quelle, G7) und daraus die Karten je Feld. Keine Oberfläche.
 * Den Gerätenamen und die Lautsprecher kennt nur die volle Sicht; die zuletzt bekannten bleiben stehen, wenn die Verwaltung kein Netz
 * hat (@HT-041: „Status unbekannt“ bei Feld 1, mit dem Gerät dahinter), ohne dass daraus je ein „bereit“ wird.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hallAnzeige, type HallAnzeige } from './hallAnzeige';
import { useLaufendeSpiele } from './useLaufendeSpiele';
import { useAnderesFensterTont } from './useAnderesFensterTont';
import { useHallLautsprecher, type HallLautsprecher } from './useHallLautsprecher';
import { useHallStatus, type HallStatus } from './useHallStatus';
import { baueFeldKarten, type FeldKarte, type SprecherInfo } from './ui/feldKarten';
import { formatUhrzeit } from './ui/uhrzeit';

export interface HallentonDaten {
  status: HallStatus;
  lautsprecher: HallLautsprecher;
  anzeige: HallAnzeige;
  karten: readonly FeldKarte[];
  /** Im Turnier ist (auch zuletzt) kein Lautsprecher bekannt. */
  keinLautsprecherImTurnier: boolean;
  /** Feld → Nummer des angepfiffenen Spiels (@HT-017: Rückfrage vor „Anhören“ und „Testton in der Halle“). */
  laufendeSpiele: ReadonlyMap<number, number>;
}

export function useHallentonDaten(tournamentId: string, felderAnzahl: number): HallentonDaten {
  const { i18n } = useTranslation();
  const status = useHallStatus(tournamentId);
  const lautsprecher = useHallLautsprecher(tournamentId);
  const { laufzeit, felder, name } = lautsprecher;
  const lokal = useMemo(
    () => (laufzeit === null ? null : { felder, rolle: laufzeit.rolle, zustandJeFeld: laufzeit.zustandJeFeld }),
    [laufzeit, felder],
  );
  const anderesFenster = useAnderesFensterTont(lokal);
  const laufendeSpiele = useLaufendeSpiele(tournamentId, status.antwort);
  const angepfiffen = useMemo(() => new Set(laufendeSpiele.keys()), [laufendeSpiele]);

  const [sprecher, setSprecher] = useState<readonly SprecherInfo[]>([]);
  useEffect(() => {
    if (status.antwort?.sicht === 'voll') {
      setSprecher(status.antwort.speakers.map((s) => ({ field: s.field, deviceName: s.deviceName })));
    }
  }, [status.antwort]);

  const anzeige = useMemo(
    () => hallAnzeige({
      server: { stand: status.stand, felder: status.felder, antwort: status.antwort }, lokal, angepfiffen,
      lautsprecherBekannt: status.lautsprecherBekannt || (lokal !== null && lokal.felder.length > 0),
      anderesFensterTont: anderesFenster,
    }),
    [status.stand, status.felder, status.antwort, status.lautsprecherBekannt, lokal, angepfiffen, anderesFenster],
  );
  const sprache = i18n.language;
  const karten = useMemo(
    () => baueFeldKarten({
      felder: Array.from({ length: felderAnzahl }, (_, i) => i + 1),
      anzeige, serverLagen: status.felder, sprecher, eigenerName: name,
      lokalerZustand: laufzeit?.zustandJeFeld ?? {}, uhrzeit: (ms) => formatUhrzeit(ms, sprache),
    }),
    [felderAnzahl, anzeige, status.felder, sprecher, name, laufzeit, sprache],
  );
  const keinLautsprecherImTurnier = karten.every((k) => k.zustand.art === 'keinLautsprecher');
  return { status, lautsprecher, anzeige, karten, keinLautsprecherImTurnier, laufendeSpiele };
}
