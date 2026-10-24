/**
 * TeamSummary – Zusammenfassung eines Teams nach dem Abpfiff (B-10a2, Cockpit-Spec § 6 „Abgepfiffen“, @SL-048, @SL-115).
 * Ersetzt in den 30 Sekunden Endstand die Tastenblöcke des Teams: Tore, Karten und Zeitstrafen mit Nummer und Zeit, dazu die Gesamtzahl
 * der Fouls im Spiel (@SL-099). Keine Tasten; die Daten kommen aus `toTeamSummaryModel`, also aus den Einträgen des Spiels –
 * nach dem Neuladen steht sie ohne eigenen Speicher wieder da. Der Name trägt dieselbe Kennung `team-name-<Seite>` wie in `TeamColumn` (nie beide zugleich). Mockup „Laptop, abgepfiffen“ und „Handy, abgepfiffen“.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { KartenSymbol } from '../../ui/atoms/KartenSymbol';
import { MatchIcons } from '../../ui/IconsMatch';
import { TeamKopf } from './TeamKopf';
import type { SummaryKarte, SummaryStrafe, SummaryTor, TeamSummaryModel } from '../model/toTeamSummaryModel';

export interface TeamSummaryProps {
  model: TeamSummaryModel;
  /** Ab 1024 px größere Schrift im Kopf (wie `TeamColumn`). */
  breit?: boolean;
}

const spalteStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, minWidth: 0 };
const flaecheStil: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, padding: cssVars.spacing.sm, minWidth: 0,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.md, background: cssVars.colors.surface,
  fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary,
};
const listeStil: CSSProperties = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs };
const zeileStil: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.xs };
const iconStil: CSSProperties = { flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: cssVars.lineHeights.bodyMd };
const fettStil: CSSProperties = { display: 'block', fontWeight: cssVars.fontWeights.bold };
/** Nur für Bildschirmleser: die Kartenart, die das Symbol allein nicht benennt. */
const nurVorlesen: CSSProperties = {
  position: 'absolute', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap', margin: `calc(-1 * ${cssVars.sizing.hairline})`, padding: 0, border: 0,
};

function Abschnitt({ titel, leerTitel, testId, eintraege }: { titel: string; leerTitel: string; testId: string; eintraege: ReactNode[] }): ReactElement {
  if (eintraege.length === 0) { return <b style={fettStil} data-testid={testId}>{leerTitel}</b>; }
  return (
    <div data-testid={testId}>
      <b style={fettStil}>{titel}</b>
      <ul style={listeStil}>{eintraege}</ul>
    </div>
  );
}

export function TeamSummary({ model, breit = false }: TeamSummaryProps): ReactElement {
  const { t } = useTranslation('cockpit');
  const { seite, name } = model;
  const nummerText = (nummer: number | null, zeit: string): string => (nummer === null ? t('zusammenfassung.ohneNr', { zeit }) : t('zusammenfassung.nr', { nummer, zeit }));
  const tor = (e: SummaryTor): ReactElement => (
    <li key={e.id} style={zeileStil}>
      <span style={iconStil}><MatchIcons.Ball size={iconSizeValues.xs} /></span>
      {e.eigentor ? t('zusammenfassung.eigentor', { text: nummerText(e.nummer, e.zeit) }) : nummerText(e.nummer, e.zeit)}
    </li>
  );
  const karte = (e: SummaryKarte): ReactElement => (
    <li key={e.id} style={zeileStil}>
      <span style={iconStil}><KartenSymbol art={e.art} /></span>
      <span style={nurVorlesen}>{t(`zusammenfassung.karte.${e.art}`)}</span>
      {nummerText(e.nummer, e.zeit)}
    </li>
  );
  const strafe = (e: SummaryStrafe): ReactElement => (
    <li key={e.id} style={zeileStil}>
      <span style={iconStil}><MatchIcons.Stopwatch size={iconSizeValues.xs} /></span>
      {nummerText(e.nummer, e.zeit)}
    </li>
  );
  return (
    <section style={spalteStil} data-testid={`team-summary-${seite}`} aria-label={name} tabIndex={0}>
      <TeamKopf seite={seite} name={name} kasten={model.kasten} breit={breit} />
      <div style={flaecheStil}>
        <Abschnitt testId={`team-summary-tore-${seite}`} titel={t('zusammenfassung.tore', { count: model.tore.length })} leerTitel={t('zusammenfassung.toreKeine')} eintraege={model.tore.map(tor)} />
        <Abschnitt testId={`team-summary-karten-${seite}`} titel={t('zusammenfassung.karten', { count: model.karten.length })} leerTitel={t('zusammenfassung.kartenKeine')} eintraege={model.karten.map(karte)} />
        <Abschnitt testId={`team-summary-strafen-${seite}`} titel={t('zusammenfassung.zeitstrafen', { count: model.zeitstrafen.length })} leerTitel={t('zusammenfassung.zeitstrafenKeine')} eintraege={model.zeitstrafen.map(strafe)} />
        <b style={fettStil} data-testid={`team-summary-fouls-${seite}`}>{t('zusammenfassung.fouls', { count: model.fouls })}</b>
      </div>
    </section>
  );
}
