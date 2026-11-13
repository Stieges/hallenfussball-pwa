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
  /** Ein Wort, das allein länger ist als die Spalte, bricht an beliebiger Stelle (`anywhere`); Vorgabe: nie mitten im Wort, die Tabelle scrollt dann in ihrem Kasten (@ZM-088). */
  breakLongWord?: boolean;
}

export function StandingNameCell({ team, label, playing, gap, breakLongWord = false }: StandingNameCellProps) {
  const { t } = useTranslation('tournament');
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap,
    // keine Kürzung, nie mitten im Wort (@ZM-088): ein zu langes Wort lässt die Tabelle in ihrem Kasten scrollen
    overflowWrap: breakLongWord ? 'anywhere' : 'normal',
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
