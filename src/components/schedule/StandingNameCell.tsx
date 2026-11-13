/**
 * Name eines Teams in einer Tabellenzeile: Logo oder Initialen, der Name (Umbruch nur an Leerzeichen und nach „/“, nie mitten im Wort,
 * @ZM-207, @ZM-088), bei einem laufenden Spiel der pulsierende Punkt. Gemeinsam für Desktop- und Handy-Tabelle der Gruppen.
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Team } from '../../types/tournament';
import { TeamAvatar } from '../ui/TeamAvatar';
import { SlashBreaks } from '../ui/atoms/TeamName';
import { liveDotStyle } from './groupTablesStyle';

export interface StandingNameCellProps {
  team: Team;
  /** Angezeigter Name; Vorgabe: der volle Name (am Handy die Kürzung nach Liste, @ZM-169). */
  label?: string;
  playing: boolean;
  gap: string;
  /** Ein Wort, das allein länger ist als die Spalte, bricht an beliebiger Stelle, statt die Tabelle zu verbreitern (@ZM-205; wie bisher in den Tabellen). */
  breakLongWord?: boolean;
}

export function StandingNameCell({ team, label, playing, gap, breakLongWord = true }: StandingNameCellProps) {
  const { t } = useTranslation('tournament');
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap,
    // keine Kürzung; `overflow-wrap: break-word` bricht nur ein Wort, das allein länger ist als die Zeile (@OB-025)
    overflowWrap: breakLongWord ? 'anywhere' : 'break-word',
    hyphens: 'manual',
    minWidth: 0,
  };
  return (
    <div style={style}>
      <TeamAvatar team={team} size="xs" />
      <span data-teamname style={{ minWidth: 0, overflowWrap: breakLongWord ? 'anywhere' : undefined }}><SlashBreaks text={label ?? team.name} /></span>
      {playing && <span title={t('groupTables.currentlyPlaying')} style={liveDotStyle} />}
    </div>
  );
}
