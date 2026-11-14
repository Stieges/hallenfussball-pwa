/**
 * Kopf der Zuschauer-Seite: Titel, darunter immer die Zeile „Sa, 28.11. · ab 16:30 Uhr · Sporthalle Waging“ als Taste zum Auf- und Zuklappen der
 * Einzelheiten (@ZM-210); nach dem Ende der Hinweis „abgeschlossen“. Kein Abzeichen mit dem Freigabe-Code („LIVE: MESS26“, @ZM-196).
 * Standard: aufgeklappt, bis ein Spiel angepfiffen ist; die eigene Wahl gilt am Gerät je Turnier weiter (wie „Mein Team“, localStorage).
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { joinMeta, type MatchView } from '../../../core/view';
import type { Tournament } from '../../../types/tournament';
import { PublicEndedBadge } from './PublicFinalStandings';
import { anyMatchStarted, firstKickoffTime, headDateText, locationLong, readHeadChoice, writeHeadChoice } from '../publicHeadFacts';

export interface PublicPageHeaderProps {
  tournament: Pick<Tournament, 'title' | 'ageClass' | 'date' | 'location' | 'organizer' | 'teams' | 'groupPhaseGameDuration'>;
  /** Spiele der Ansicht: erster Anstoß und „angepfiffen?“ */
  matches: readonly MatchView[];
  shareCode: string;
  ended: boolean;
}

const headerStyle: CSSProperties = { marginBottom: cssVars.spacing.lg, textAlign: 'center' };
const titleStyle: CSSProperties = { fontSize: cssVars.fontSizes.xxl, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary, marginBottom: cssVars.spacing.xs };
const toggleStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: cssVars.spacing.xs, maxWidth: '100%',
  minHeight: cssVars.touchTargets.minimum, padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, background: 'transparent', border: 'none',
  fontFamily: 'inherit', fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary, cursor: 'pointer', textAlign: 'center',
  overflowWrap: 'anywhere',
};
const arrowStyle: CSSProperties = { fontSize: cssVars.fontSizes.xl, lineHeight: 1, flexShrink: 0 };
const detailsStyle: CSSProperties = {
  display: 'grid', gap: cssVars.spacing.xs, margin: `0 auto ${cssVars.spacing.sm}`, padding: cssVars.spacing.md, maxWidth: '32rem', textAlign: 'left',
  background: cssVars.colors.surface, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg,
  fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary,
};
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(6rem, auto) minmax(0, 1fr)', columnGap: cssVars.spacing.md, margin: 0 };
const labelStyle: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary };
const valueStyle: CSSProperties = { margin: 0, overflowWrap: 'anywhere' };

export function PublicPageHeader({ tournament, matches, shareCode, ended }: PublicPageHeaderProps): ReactElement {
  const { t, i18n } = useTranslation('publicView');
  const [choice, setChoice] = useState<boolean | undefined>(() => readHeadChoice(shareCode));
  const open = choice ?? !anyMatchStarted(matches);
  const toggle = (): void => { setChoice(!open); writeHeadChoice(shareCode, !open); };

  const kickoff = firstKickoffTime(matches);
  const place = tournament.location?.name.trim();
  const summary = joinMeta([
    headDateText(tournament.date, i18n.language),
    kickoff === undefined ? undefined : t('head.from', { time: kickoff }),
    place === '' ? undefined : place,
  ], ' · ');

  const duration = tournament.groupPhaseGameDuration;
  const organizer = tournament.organizer?.trim();
  const rows: Array<[string, string, string]> = [
    ['age', t('head.ageClass'), tournament.ageClass?.trim() ?? ''],
    ['location', t('head.location'), locationLong(tournament.location) ?? ''],
    ['duration', t('head.durationLabel'), duration > 0 ? t('head.duration', { count: duration }) : ''],
    ['teams', t('head.teamsLabel'), tournament.teams.length > 0 ? t('head.teams', { count: tournament.teams.length }) : ''],
    ['organizer', t('head.organizer'), organizer ?? ''],
  ];
  const shown = rows.filter(([, , value]) => value !== '');

  return (
    <div style={headerStyle}>
      <h1 style={titleStyle}>{tournament.title}</h1>
      {summary !== '' && (
        <button type="button" style={toggleStyle} onClick={toggle} aria-expanded={open} aria-controls="public-head-details" data-testid="public-head-when-where">
          <span>{summary}</span>
          <span aria-hidden="true" style={arrowStyle}>{open ? '▴' : '▾'}</span>
        </button>
      )}
      <div id="public-head-details" data-testid="public-head-details" style={{ ...detailsStyle, display: open && shown.length > 0 ? detailsStyle.display : 'none' }} role="group" aria-label={t('head.toggleLabel')}>
        {shown.map(([key, label, value]) => (
          <dl key={key} style={rowStyle} data-testid={`public-head-${key}`}>
            <dt style={labelStyle}>{label}</dt>
            <dd style={valueStyle}>{value}</dd>
          </dl>
        ))}
      </div>
      {ended && <div style={{ marginTop: cssVars.spacing.sm }}><PublicEndedBadge /></div>}
    </div>
  );
}
