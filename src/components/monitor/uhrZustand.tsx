/**
 * Zustand der Uhr als Symbole statt Wörter (@ZM-215, Daniel 2026-11-19): Darstellung der Symbole (Zuordnung in `uhrSymbole.ts`) für die Live-Folie „Spielfeld (fern)“
 * (`MatchTimer`, `KickoffClock`) und das Profil „Halle (sehr fern)“ (`HallBand`). Angaben stehen nur an einer Stelle: das Abzeichen oben links sagt, was die Folie zeigt,
 * die Symbole an der Uhr sagen, was mit der Uhr ist. Jedes Symbol trägt als zugänglichen Namen das bisherige Wort (`liveMatch.clock.*`).
 * - angehalten → Pause-Symbol · Halbzeitpause und andere Pausen → halber Kreis · Zeit abgelaufen → Pfeife · Verlängerung → Kreis mit Plus (nur hier, nicht im Abzeichen)
 * - Läuft die Uhr in der Verlängerung nicht (angehalten, abgelaufen), steht das Plus neben dem Symbol, damit die Verlängerung nicht verloren geht
 * - Abschnitt als Punkte, nur bei mehr als einem Abschnitt und im regulären Spiel außerhalb der Pause
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { regularKey } from '../../core/view';
import { AbschnittPunkte, MonitorSymbol } from '../ui/atoms/MonitorSymbole';
import type { UhrSymbolDef } from './uhrSymbole';

export interface UhrZustandProps {
  symbole: UhrSymbolDef[];
  /** Kantenlänge je Symbol als Token-Wert */
  size: string;
  /** Abstand zwischen zwei Symbolen als Token-Wert */
  gap: string;
  testId: string;
  color?: string;
  /** `MonitorUhrText` des Modells (Prüfhilfe) */
  text: string;
}

/** Symbole des Uhr-Zustands nebeneinander; ohne Symbole nichts. */
export function UhrZustand({ symbole, size, gap, color, testId, text }: UhrZustandProps): ReactElement | null {
  const { t } = useTranslation('monitor');
  if (symbole.length === 0) { return null; }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, ...(color === undefined ? {} : { color }) }} data-testid={testId} data-text={text}>
      {symbole.map((s) => <MonitorSymbol key={s.kind} kind={s.kind} size={size} label={t(`liveMatch.clock.${s.key}`)} testId={`${testId}-${s.kind}`} />)}
    </span>
  );
}

export interface AbschnittAnzeigeProps {
  current: number;
  total: number;
  size: string;
  gap: string;
  border: string;
  color?: string;
  testId: string;
}

/** Abschnitt als Punkte mit dem Namen („2. Halbzeit“, „Abschnitt 3 von 3“) als zugänglichem Namen. */
export function AbschnittAnzeige({ current, total, size, gap, border, color, testId }: AbschnittAnzeigeProps): ReactElement {
  const { t } = useTranslation('tournament');
  const key = regularKey(current, total);
  const label = key === 'firstHalf' ? t('matchClock.section.firstHalf') : key === 'secondHalf' ? t('matchClock.section.secondHalf') : t('matchClock.section.sectionOfN', { section: current, sections: total });
  return <AbschnittPunkte current={current} total={total} label={label} size={size} gap={gap} border={border} color={color} testId={testId} />;
}
