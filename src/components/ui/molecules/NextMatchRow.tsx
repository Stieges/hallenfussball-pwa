/**
 * NextMatchRow – Zeile „Nächstes“ im Cockpit (Plan LT-3; @SL-155, @SL-156, @SL-160, @SL-161, Mockup laptop.html).
 *
 * Neutral wie jede Information: Rahmen dünn in der Randfarbe, Fläche `surface`, Text `textPrimary`, kein Fehler-Rot
 * (Befund C-COCKPIT-NAECHSTES-WIE-FEHLER). „Spiel 13 · ● TSV West – ● SG Mitte · Anstoß 15:15“: der Farbpunkt steht nur, wenn eine
 * Trikotfarbe festgelegt ist; das Leibchen-Zeichen (ohne Text) am Ende bei zu ähnlichen Farben. Vorwarnung: der Rahmen wird mittel
 * breit in der Warn-Rahmenfarbe und bleibt; beim ersten Aktivwerden pulst er dreimal (`blinken`). Texte kommen als Props (UI-Baustein).
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { MatchIcons } from '../IconsMatch';
import styles from './NextMatchRow.module.css';

export interface NextMatchRowTeam { name: string; farbe: string | null }

export interface NextMatchRowProps {
  label: string;
  spielText: string;
  teams: [NextMatchRowTeam, NextMatchRowTeam];
  anstossText: string;
  leibchen: { ariaLabel: string } | null;
  modus: 'normal' | 'vorwarnung' | 'wechsel';
  blinken: boolean;
  /** Wechsel-Countdown nach dem Abpfiff (LT-4): Text und Anteil 0 bis 1 des Balkens. */
  wechsel?: { text: string; anteil: number };
  testId: string;
}

const zeileStil = (modus: NextMatchRowProps['modus']): CSSProperties => ({
  position: 'relative', display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, flexWrap: 'wrap', minWidth: 0,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`, boxSizing: 'border-box',
  background: cssVars.colors.surface, color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm,
  border: modus === 'vorwarnung'
    ? `${cssVars.borderWidth.medium} solid ${cssVars.colors.nextWarnBorder}`
    : `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md,
});
const labelStil: CSSProperties = { fontWeight: cssVars.fontWeights.bold };
const teamStil: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs };
const punktStil = (farbe: string): CSSProperties => ({
  display: 'inline-block', width: cssVars.spacing.sm, height: cssVars.spacing.sm, borderRadius: cssVars.borderRadius.full,
  background: farbe, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderSolid}`, flex: 'none',
});
const balkenSpurStil: CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 0, height: cssVars.spacing.xs, overflow: 'hidden',
  borderBottomLeftRadius: cssVars.borderRadius.md, borderBottomRightRadius: cssVars.borderRadius.md,
};

function Team({ team, index, testId }: { team: NextMatchRowTeam; index: number; testId: string }): ReactElement {
  return (
    <span style={teamStil}>
      {team.farbe !== null && <i aria-hidden="true" data-testid={`${testId}-punkt-${index}`} style={punktStil(team.farbe)} />}
      {team.name}
    </span>
  );
}

export function NextMatchRow(p: NextMatchRowProps): ReactElement {
  return (
    <div
      className={p.blinken ? styles.blinken : undefined}
      style={zeileStil(p.modus)}
      data-testid={p.testId}
      data-modus={p.modus}
      data-blinken={p.blinken ? 'true' : undefined}
    >
      <span style={{ display: 'inline-flex', color: cssVars.colors.textSecondary }}><MatchIcons.Calendar size={16} /></span>
      <span style={labelStil}>{p.label}</span>{' '}
      <span>{p.spielText}</span>{' '}
      <span aria-hidden="true">·</span>{' '}
      <Team team={p.teams[0]} index={0} testId={p.testId} />{' '}
      <span aria-hidden="true">–</span>{' '}
      <Team team={p.teams[1]} index={1} testId={p.testId} />{' '}
      <span aria-hidden="true">·</span>{' '}
      <span>{p.anstossText}</span>
      {p.wechsel && <span data-testid={`${p.testId}-wechsel`} style={{ fontWeight: cssVars.fontWeights.semibold }}>{p.wechsel.text}</span>}
      {p.leibchen && (
        <span role="img" aria-label={p.leibchen.ariaLabel} data-testid={`${p.testId}-leibchen`} style={{ marginLeft: 'auto', display: 'inline-flex' }}>
          <MatchIcons.Shirt size={18} />
        </span>
      )}
      {p.wechsel && (
        <span style={balkenSpurStil} aria-hidden="true">
          <span
            data-testid={`${p.testId}-wechsel-balken`}
            style={{ display: 'block', height: '100%', background: cssVars.colors.primary, transformOrigin: 'left center', transform: `scaleX(${p.wechsel.anteil})` }}
          />
        </span>
      )}
    </div>
  );
}
