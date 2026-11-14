/**
 * CockpitHallHinweis (H4-12, @HT-011, @HT-034, @HT-035, @HT-036, @HT-040, @HT-050, @HT-039 Spalte Cockpit): ruhiger Kasten unter der Tafel im
 * Live-Cockpit – „Kein Netz – Halle zeigt alten Stand“, „Hallen-Lautsprecher aus – Ende selbst anzeigen“ mit „Grund: …“, „🔈? Hallenton-Ausgang
 * geändert“ und vor dem Anpfiff „Uhr nicht abgeglichen – Hallenton kann abweichen“. Hinweise sperren nichts und verdecken nichts: sie stehen im
 * normalen Fluss, der Anpfiff bleibt mit jedem Hinweis möglich. Ohne eingerichteten Lautsprecher am Feld erscheint nichts (@HT-016, @HT-038).
 *
 * Quelle (@HT-039, Fassung 14.11.): im Spiel die Antwort auf das Lebenszeichen der Leitung (`useHallCockpitHinweis`). Solange die Leitung
 * keinen Stand hat (vor dem Anpfiff, kurz nach dem Anpfiff), gilt der Server-Stand (`useHallStatus`, nur `aktuell`): so steht der Kasten schon
 * vor dem Anpfiff, und er bleibt stehen, wenn Tom trotzdem anpfeift. Sobald die Leitung einen Stand hat, gilt nur noch dieser.
 * - Rechte: `hall_sound_status` erlaubt `writeMatchData` die schmale Sicht (Migration 20261123_001); der Helfer hat das Recht. Ohne Recht
 *   käme alle 5 s ein 42501 (`kein_recht`, kein Kasten) – darum nur mit `kannSteuern` abfragen.
 * - Last: höchstens eine Abfrage je 5 s und Gerät (eine je Turnier, geteilt mit Kopfzeile und Uhr-Zeile), nur solange die Leitung keinen Stand hat.
 * - Ohne Netz: `stand` `unbekannt`, `felder` leer → kein Kasten; die allgemeine Offline-Anzeige des Cockpits genügt (Kein Netz gilt nur im Spiel).
 */
import type { ReactElement, ReactNode } from 'react';
import type { CockpitZustand } from '../../../components/live-cockpit/model/cockpitPhase';
import { useTranslation } from 'react-i18next';
import { iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { cockpitHallZeile, cockpitHallZeileAusServer, type CockpitHallZeile } from '../cockpitHallZeile';
import { feldNummer } from '../runtime/hallStatusAuswertung';
import { useHallCockpitHinweis } from '../useHallCockpitHinweis';
import { useHallStatus } from '../useHallStatus';
import { useUhrAbgeglichen } from '../useUhrAbgeglichen';
import { formatUhrzeit } from './uhrzeit';
import styles from './CockpitHallHinweis.module.css';

export interface CockpitHallHinweisProps {
  tournamentId: string;
  /** `field-N` des Spiels; ohne Feld kein Hinweis. */
  feldId: string | null | undefined;
  /** Zustand des Spiels im Cockpit: vor dem Anpfiff gibt es die Uhr-Zeile (@HT-036), ohne laufendes oder bevorstehendes Spiel keinen Hinweis. */
  zustand: CockpitZustand;
  /** Steuerrecht (`writeMatchData`): nur damit darf der Server-Stand gelesen werden (sonst 42501 alle 5 s). */
  kannSteuern: boolean;
}

/** Ohne Spiel, nach dem Abpfiff und bei offener Besetzung gibt es keinen Hinweis (@HT-016, @HT-035 letzte Zeile). */
const OHNE_HINWEIS: ReadonlySet<CockpitZustand> = new Set<CockpitZustand>(['abgepfiffen', 'keinSpiel', 'wartetAufHerkunft']);

interface KastenProps { symbol: ReactNode; titel: string; grund?: string; ruhig?: boolean; testid: string }

export function CockpitHallKasten({ symbol, titel, grund, ruhig = false, testid }: KastenProps): ReactElement {
  return (
    <div className={ruhig ? `${styles.kasten} ${styles.ruhig}` : styles.kasten} role="status" data-testid={testid}>
      <span className={styles.symbol} aria-hidden="true">{symbol}</span>
      <span className={styles.text}>
        <span className={styles.titel}>{titel}</span>
        {grund !== undefined ? <span className={styles.grund}>{grund}</span> : null}
      </span>
    </div>
  );
}

function ZeileAnsicht({ zeile }: { zeile: CockpitHallZeile }): ReactElement {
  const { t, i18n } = useTranslation('hallenton');
  const symbol = iconSizeValues.md;
  switch (zeile.art) {
    case 'keinNetz':
      return <CockpitHallKasten symbol={<Icons.WifiOff size={symbol} />} titel={t('cockpit.keinNetz')} testid="cockpit-hall-kein-netz" />;
    case 'ausgangGeaendert':
      return <CockpitHallKasten ruhig symbol={<Icons.SpeakerQuestion size={symbol} />} titel={t('cockpit.ausgangGeaendert')} testid="cockpit-hall-ausgang-geaendert" />;
    case 'aus': {
      const wort = zeile.grund === 'meldetSichNicht'
        ? t('feld.zustand.meldetSichNicht', { zeit: zeile.zuletztServerMs === null ? '–' : formatUhrzeit(zeile.zuletztServerMs, i18n.language) })
        : zeile.grund === null ? undefined : t(`feld.grund.${zeile.grund}`);
      return (
        <CockpitHallKasten
          symbol={<Icons.SpeakerOff size={symbol} />} titel={t('cockpit.titel')}
          grund={wort === undefined ? undefined : t('cockpit.grund', { grund: wort })} testid="cockpit-hall-aus"
        />
      );
    }
  }
}

function Zeilen({ zeile, uhr }: { zeile: CockpitHallZeile | null; uhr: boolean }): ReactElement | null {
  const { t } = useTranslation('hallenton');
  if (zeile === null && !uhr) {
    return null;
  }
  return (
    <div className={styles.liste} data-testid="cockpit-hall-hinweise">
      {zeile === null ? null : <ZeileAnsicht zeile={zeile} />}
      {uhr ? <CockpitHallKasten symbol={<Icons.Clock size={iconSizeValues.md} />} titel={t('cockpit.uhrNichtAbgeglichen')} testid="cockpit-hall-uhr" /> : null}
    </div>
  );
}

interface MitServerProps { tournamentId: string; feld: number; leitungZeile: CockpitHallZeile | null; serverFrage: boolean; imSpiel: boolean; uhrZeile: boolean }

/**
 * Liest den Server-Stand (`useHallStatus`, nur `aktuell`): für die Zeile vor der Leitung (`serverFrage`) und für die Uhr-Zeile, die es nur gibt,
 * wo ein Lautsprecher eingerichtet ist. Der Hook steht nur hier: ohne beides fragt dieses Gerät den Server nicht zusätzlich.
 */
function MitServerStand({ tournamentId, feld, leitungZeile, serverFrage, imSpiel, uhrZeile }: MitServerProps): ReactElement | null {
  const status = useHallStatus(tournamentId);
  const lage = status.stand === 'aktuell' ? status.felder[feld] : undefined;
  const zeile = leitungZeile ?? (serverFrage ? cockpitHallZeileAusServer(lage, imSpiel) : null);
  return <Zeilen zeile={zeile} uhr={uhrZeile && lage !== undefined} />;
}

export function CockpitHallHinweis({ tournamentId, feldId, zustand, kannSteuern }: CockpitHallHinweisProps): ReactElement | null {
  const hinweis = useHallCockpitHinweis(tournamentId, feldId ?? '');
  const leitungZeile = cockpitHallZeile(hinweis);
  const uhrAbgeglichen = useUhrAbgeglichen();
  const feld = feldNummer(feldId);
  const vorAnpfiff = zustand === 'vorAnpfiff';
  const uhrZeile = vorAnpfiff && !uhrAbgeglichen && feld !== null;
  const serverFrage = hinweis.art === 'keiner' && kannSteuern && feld !== null && !OHNE_HINWEIS.has(zustand);
  if (feld !== null && (serverFrage || uhrZeile)) {
    return <MitServerStand tournamentId={tournamentId} feld={feld} leitungZeile={leitungZeile} serverFrage={serverFrage} imSpiel={!vorAnpfiff} uhrZeile={uhrZeile} />;
  }
  return <Zeilen zeile={leitungZeile} uhr={false} />;
}
