/**
 * Teilnehmer der Zuschauer-Seite, eingeklappt (@ZM-196): eine Zeile „Teilnehmer (8)“, mindestens 44 Bildpunkte hoch; aufgeklappt
 * stehen die Teams einmal, nach Gruppen geordnet, einspaltig (Nummer, Kreis, Name; bei einer Gruppe ohne Überschrift). Beim
 * nächsten Öffnen der Seite ist sie wieder eingeklappt; Vorlese-Programme hören „eingeklappt“ bzw. „aufgeklappt“.
 * Innerhalb der Gruppe nach Namen sortiert, nichts Wertendes (gilt auch im Kindermodus).
 */
import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { TeamAvatar } from '../../../components/ui/TeamAvatar';
import type { Team } from '../../../types/tournament';
import { participantsByGroup } from '../publicParticipantsList';

export interface PublicParticipantsProps {
  teams: readonly Team[];
}

const boxStyle: CSSProperties = { background: cssVars.colors.surface, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg, marginBottom: cssVars.spacing.sm, minWidth: 0 };
const toggleStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: cssVars.touchTargets.comfortable,
  padding: `0 ${cssVars.spacing.md}`, background: 'transparent', border: 'none', cursor: 'pointer',
  color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold, fontFamily: 'inherit',
};
const listWrapStyle: CSSProperties = { padding: `0 ${cssVars.spacing.md} ${cssVars.spacing.sm}`, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` };
const groupTitleStyle: CSSProperties = { margin: `${cssVars.spacing.md} 0 ${cssVars.spacing.xs}`, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.primary };
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };
const itemStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, padding: `${cssVars.spacing.sm} 0`, borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, minWidth: 0 };
const numberStyle: CSSProperties = { width: cssVars.spacing.lg, flex: 'none', textAlign: 'right', fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, fontVariantNumeric: 'tabular-nums' };
const nameStyle: CSSProperties = { fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, overflowWrap: 'break-word', minWidth: 0 };
const srOnly: CSSProperties = { position: 'absolute', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', margin: `calc(-1 * ${cssVars.sizing.hairline})`, padding: 0, border: 0 };

/** Pfeil zum Auf- und Zuklappen; auch der Kopf der Seite nutzt ihn (@ZM-210), damit beide Zeilen gleich aussehen. */
export function Chevron({ up }: { up: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="1.25em" height="1.25em" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

export function PublicParticipants({ teams }: PublicParticipantsProps): ReactElement {
  const { t } = useTranslation('publicView');
  const { t: tSport } = useTranslation('sport');
  const [open, setOpen] = useState(false);
  const groups = participantsByGroup(teams);
  const showTitles = groups.length > 1;
  return (
    <div style={boxStyle} data-testid="public-participants">
      <button type="button" style={toggleStyle} aria-expanded={open} aria-controls={open ? 'public-participants-list' : undefined} onClick={() => setOpen(!open)} data-testid="public-participants-toggle">
        <span>
          {t('participants.toggle', { n: teams.length })}
          <span style={srOnly}>, {open ? t('participants.expandedSr') : t('participants.collapsedSr')}</span>
        </span>
        <Chevron up={open} />
      </button>
      {open && (
        <div style={listWrapStyle} id="public-participants-list" data-testid="public-participants-list">
          {groups.map(({ group, entries }) => (
            <section key={group} aria-label={showTitles ? tSport('tournament.groupWithLetter', { letter: group }) : undefined}>
              {showTitles && <h3 style={groupTitleStyle}>{tSport('tournament.groupWithLetter', { letter: group })}</h3>}
              <ul style={listStyle}>
                {entries.map(({ team, number }) => (
                  <li key={team.id} style={itemStyle} data-testid={`public-participant-${team.id}`}>
                    <span style={numberStyle}>{number}.</span>
                    <TeamAvatar team={team} size="sm" />
                    <span style={nameStyle}>{team.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
