/**
 * „Mein Team“ der Zuschauer-Seite (@ZM-175, @ZM-196): direkt unter dem Kopf.
 * Ohne gewähltes Team eine Zeile mit „Team wählen“; mit Team der Block: Name ungekürzt (bricht an Leerzeichen um), „ändern“,
 * das nächste Spiel und der Tabellenplatz. Reine Anzeige: Fakten kommen aus `myTeamFacts`, die Wahl öffnet der Aufrufer.
 * Tippziele mindestens 44 Bildpunkte (@OB-022).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import type { MyTeamFacts } from '../publicMyTeamFacts';

export interface PublicMyTeamProps {
  /** Name des gewählten Teams, sonst null */
  teamName: string | null;
  facts: MyTeamFacts;
  onOpenSelector: () => void;
  /**
   * Schalter „Nur meine“ (`my=1`): steht in keinem Szenario und widerspricht @ZM-175 („Spielplan bleibt vollständig“); bleibt bis zur
   * Entscheidung des Product Owners erhalten (Befund C-ZUSCHAUER-WEG-ZUM-SPIELPLAN), nur im Block mit gewähltem Team.
   */
  onlyMine: boolean;
  onOnlyMineChange: (value: boolean) => void;
}

const boxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
  padding: cssVars.spacing.sm,
  background: cssVars.colors.surface,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.lg,
  marginBottom: cssVars.spacing.sm,
  minWidth: 0,
};
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, minWidth: 0 };
const titleStyle: CSSProperties = { fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, paddingLeft: cssVars.spacing.xs };
const buttonStyle: CSSProperties = { minHeight: cssVars.touchTargets.minimum, flex: 'none', whiteSpace: 'nowrap' };
const nameStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary, overflowWrap: 'break-word', minWidth: 0, paddingLeft: cssVars.spacing.xs };
const listStyle: CSSProperties = { margin: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: cssVars.spacing.md, rowGap: cssVars.spacing.xs, paddingTop: cssVars.spacing.sm, paddingLeft: cssVars.spacing.xs, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` };
const termStyle: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const valueStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, overflowWrap: 'break-word', minWidth: 0 };

const onlyMineStyle = (active: boolean): CSSProperties => ({
  minHeight: cssVars.touchTargets.minimum, alignSelf: 'flex-start', padding: `0 ${cssVars.spacing.md}`,
  borderRadius: cssVars.borderRadius.full,
  border: `${cssVars.borderWidth.thin} solid ${active ? cssVars.colors.primary : cssVars.colors.borderControl}`,
  background: active ? cssVars.colors.primary : cssVars.colors.background,
  color: active ? cssVars.colors.background : cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.sm, fontWeight: active ? cssVars.fontWeights.bold : cssVars.fontWeights.normal, cursor: 'pointer',
});

export function PublicMyTeam({ teamName, facts, onOpenSelector, onlyMine, onOnlyMineChange }: PublicMyTeamProps): ReactElement {
  const { t } = useTranslation('publicView');
  if (teamName === null) {
    return (
      <div style={{ ...boxStyle, ...rowStyle, flexDirection: 'row', paddingLeft: cssVars.spacing.md }} data-testid="my-team-bar">
        <span style={{ ...titleStyle, paddingLeft: 0 }}>{t('myTeam.title')}</span>
        <Button variant="secondary" onClick={onOpenSelector} style={buttonStyle} data-testid="my-team-choose">{t('myTeam.choose')}</Button>
      </div>
    );
  }
  const next = facts.next;
  const table = facts.table;
  return (
    <div style={boxStyle} data-testid="my-team-bar" data-has-team="true">
      <div style={rowStyle}>
        <span style={titleStyle}>{t('myTeam.title')}</span>
        <Button variant="secondary" onClick={onOpenSelector} style={buttonStyle} data-testid="my-team-change">{t('myTeam.changeLower')}</Button>
      </div>
      <p style={nameStyle} data-teamname data-testid="my-team-name">{teamName}</p>
      <dl style={listStyle}>
        <dt style={termStyle}>{t('myTeam.next')}</dt>
        <dd style={valueStyle} data-testid="my-team-next">
          {next === undefined
            ? t('myTeam.noNext')
            : t('myTeam.nextLine', { number: next.number ?? '–', time: next.time ?? '–', field: next.field, opponent: next.opponent })}
        </dd>
        {table !== undefined && (
          <>
            <dt style={termStyle}>{t('myTeam.table')}</dt>
            <dd style={valueStyle} data-testid="my-team-table">
              {table.group === undefined
                ? t('myTeam.placeNoGroup', { place: table.place, points: table.points })
                : t('myTeam.place', { place: table.place, group: table.group, points: table.points })}
            </dd>
          </>
        )}
      </dl>
      <button type="button" style={onlyMineStyle(onlyMine)} aria-pressed={onlyMine} onClick={() => onOnlyMineChange(!onlyMine)} data-testid="my-team-only-mine">
        {t('myTeam.onlyMine')}
      </button>
    </div>
  );
}
