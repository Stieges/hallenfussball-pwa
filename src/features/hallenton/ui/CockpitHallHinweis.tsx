/**
 * CockpitHallHinweis (H4-12, @HT-011, @HT-034, @HT-035, @HT-036, @HT-040, @HT-050, @HT-039 Spalte Cockpit): ruhiger Kasten unter der Tafel im
 * Live-Cockpit – „Kein Netz – Halle zeigt alten Stand“, „Hallen-Lautsprecher aus – Ende selbst anzeigen“ mit „Grund: …“, „🔈? Hallenton-Ausgang
 * geändert“ und vor dem Anpfiff „Uhr nicht abgeglichen – Hallenton kann abweichen“. Hinweise sperren nichts und verdecken nichts: sie stehen im
 * normalen Fluss, der Anpfiff bleibt mit jedem Hinweis möglich. Ohne eingerichteten Lautsprecher am Feld erscheint nichts (@HT-016, @HT-038).
 * „Lautsprecher aus“ vor dem Anpfiff steht nicht im Record (nur danach, @HT-039) und ist hier nicht gebaut.
 */
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { cockpitHallZeile, type CockpitHallZeile } from '../cockpitHallZeile';
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
  /** Das Spiel ist noch nicht angepfiffen (nur dann der Hinweis zur Uhr, @HT-036). */
  vorAnpfiff: boolean;
}

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

/** Die Zeile zur Uhr gibt es nur, wo ein Lautsprecher eingerichtet ist (`useHallStatus`); ohne Antwort des Servers bleibt sie aus. */
function UhrZeile({ tournamentId, feld }: { tournamentId: string; feld: number }): ReactElement | null {
  const { t } = useTranslation('hallenton');
  const status = useHallStatus(tournamentId);
  if (status.stand !== 'aktuell' || status.felder[feld] === undefined) {
    return null;
  }
  return <CockpitHallKasten symbol={<Icons.Clock size={iconSizeValues.md} />} titel={t('cockpit.uhrNichtAbgeglichen')} testid="cockpit-hall-uhr" />;
}

export function CockpitHallHinweis({ tournamentId, feldId, vorAnpfiff }: CockpitHallHinweisProps): ReactElement | null {
  const zeile = cockpitHallZeile(useHallCockpitHinweis(tournamentId, feldId ?? ''));
  const uhrAbgeglichen = useUhrAbgeglichen();
  const feld = feldNummer(feldId);
  const uhrZeile = vorAnpfiff && !uhrAbgeglichen && feld !== null;
  if (zeile === null && !uhrZeile) {
    return null;
  }
  return (
    <div className={styles.liste} data-testid="cockpit-hall-hinweise">
      {zeile === null ? null : <ZeileAnsicht zeile={zeile} />}
      {uhrZeile ? <UhrZeile tournamentId={tournamentId} feld={feld} /> : null}
    </div>
  );
}
