/**
 * HallGeraetStreifen – die Statuszeile in Ansichten ohne Kopf (H4-5, G6, @HT-012): zeigt die Einträge des EIGENEN Lautsprecher-Geräts
 * („Ton nicht aktiv – hier klicken“ …) in jeder Ansicht der App, aber nur, solange keine Kopfzeile mit Statuszeile für dieses Turnier
 * eingebunden ist (`StatusZeileOrt`) – sonst stünde sie doppelt. Auf Kiosk-Routen (Monitor) bleibt sie aus (@ME-003: nichts wartet
 * auf eine Eingabe). Der Klick auf „Ton nicht aktiv“ aktiviert den Spieler dieses Tabs; hält ein anderer Tab die Sperre, steht
 * danach „Lautsprecher läuft schon in einem anderen Fenster“ (@HT-033 Zeile 8). Ohne Server-Abfrage: nur der lokale Zustand.
 */
import { useCallback, useMemo, useSyncExternalStore, type ReactElement } from 'react';
import { useKioskRoute } from '../../../hooks/useKioskRoute';
import { hallAnzeige } from '../hallAnzeige';
import { abonniereGeraet, geraetStand } from '../lautsprecherGeraet';
import { useHallLautsprecher } from '../useHallLautsprecher';
import { HallStatusZeileAnsicht } from './HallStatusZeile';
import { useHatStatusZeileHost } from './StatusZeileOrt';

const KEINE_FELDER: ReadonlySet<number> = new Set();
const OHNE_SERVER = { stand: 'laedt', felder: {}, antwort: null } as const;

export function HallGeraetStreifen(): ReactElement | null {
  const kiosk = useKioskRoute();
  const { einschaltung } = useSyncExternalStore(abonniereGeraet, geraetStand, geraetStand);
  const turnierId = einschaltung?.turnierId ?? null;
  const hatHost = useHatStatusZeileHost(turnierId);
  if (kiosk || turnierId === null || hatHost) {
    return null;
  }
  return <Streifen turnierId={turnierId} />;
}

function Streifen({ turnierId }: { turnierId: string }): ReactElement {
  const { laufzeit, felder, tonAktivieren } = useHallLautsprecher(turnierId);
  const anzeige = useMemo(() => hallAnzeige({
    server: OHNE_SERVER,
    lokal: laufzeit === null ? null : { felder, rolle: laufzeit.rolle, zustandJeFeld: laufzeit.zustandJeFeld },
    angepfiffen: KEINE_FELDER,
    lautsprecherBekannt: false,
  }), [laufzeit, felder]);
  const aktivieren = useCallback(() => { void tonAktivieren(); }, [tonAktivieren]);
  return <HallStatusZeileAnsicht anzeige={anzeige} tournamentId={turnierId} tonAktivieren={aktivieren} data-testid="hallenton-geraet-streifen" />;
}
