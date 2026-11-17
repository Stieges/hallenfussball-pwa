/**
 * HallBand – Zeitbalken und Uhrband unter den Farbflächen (@ZM-213, @ZM-214): der Balken läuft über die ganze Breite, darunter steht die
 * Restzeit groß in der Mitte, klein links das Live-Abzeichen mit dem Feld und rechts Gruppe und Text zur Uhr („Restzeit“, „angehalten“,
 * „Pause · Halbzeit“ …). Eine Kopfzeile gibt es nicht. Beide Zeilen liegen in jedem Zustand an derselben Stelle (@ZM-151):
 * - läuft das Spiel: Restzeit (weiß, auch bei angehaltener Uhr; nur der Balken wird grau, Entscheidung offen @ZM-212)
 * - vor dem Anpfiff: Anstoßzeit an der Stelle der Restzeit, daneben „Nächstes Spiel“ (Abzeichen der Live-Folie)
 * - Halbzeitpause: die Pausenzeit an der Stelle der Restzeit, daneben „Pause · Halbzeit“
 * - Strafstoßschießen: Zwischenstand an der Stelle der Restzeit, daneben „Strafstoßschießen“, kein Balken
 * - Ende: „Endstand“ bzw. „4 : 3 n. E.“ an der Stelle der Restzeit, kein Balken
 * Daten und Zustandsregeln dieselben wie in der übrigen Live-Folie (`useMonitorUhr`, `monitorUhrOf`, Abzeichen der Ansicht).
 */
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isSingleGroupId } from '../../../core/models/standingsGroups';
import { formatRemaining, type FinalScore, type MatchBadgeModel, type MonitorUhrModell } from '../../../core/view';
import type { MonitorThemeColors } from '../../../design-tokens';
import { cssVars, displayHall } from '../../../design-tokens';
import type { MonitorTheme } from '../../../types/monitor';
import type { LiveMatch } from '../../../hooks/useLiveMatches';
import type { ClockMode } from '../../../core/match/clockDisplay';
import { MatchStatusBadge } from '../../ui/molecules/MatchStatusBadge';
import { monitorBadgeTone } from '../../ui/molecules/matchStatusBadgeStyle';
import { ZeitBalken } from '../../ui/atoms/ZeitBalken';
import { UHR_TEXT_KEY, useMonitorUhr, type MatchTimerUhrQuelle } from '../useMonitorUhr';
import { bandStyle, barRowStyle, sideColumnStyle, slotBadgeStyle, slotFontSize, slotStyle } from './hallStyles';

export interface HallBandProps {
  match: LiveMatch;
  group?: string;
  badge: MatchBadgeModel;
  theme: MonitorTheme;
  colors: MonitorThemeColors;
  clockMode?: ClockMode;
  uhr?: MatchTimerUhrQuelle;
  finalScore?: FinalScore;
  hideScore: boolean;
  /** Vor dem Anpfiff: Anstoßzeit an der Stelle der Restzeit */
  kickoff?: { time: string; notes?: ReactNode };
}

type SlotKind = 'clock' | 'word' | 'shootout';

interface Slot { kind: SlotKind; /** `null`: nur das Abzeichen (Strafstoßschießen ohne sichtbaren Zwischenstand) */ text: string | null; testId: string; phase?: string; schlussphase?: boolean }

interface BandInhalt {
  bar: ReactNode;
  slot: Slot | null;
  /** Text rechts neben der Uhr (zweite Zeile unter der Gruppe) */
  right: ReactNode;
}

function HallLayout({ props, inhalt }: { props: HallBandProps; inhalt: BandInhalt }): ReactElement {
  const { t } = useTranslation('monitor');
  const { match, group, badge, colors } = props;
  const slot = inhalt.slot;
  const slotText = slot?.text ?? null;
  // Strafstoßschießen: das Wort steht über dem Zwischenstand in der Mitte (Mockup „schiessen“), nicht links (es ist breiter als die Seitenspalte)
  const mitteAbzeichen = slot?.kind === 'shootout';
  const abzeichen = <MatchStatusBadge model={badge} size="halle" tone={monitorBadgeTone(colors)} />;
  return (
    <>
      <div style={barRowStyle} data-testid="hall-bar-row">{inhalt.bar}</div>
      <div style={bandStyle} data-testid="hall-band">
        {/* Nah-Information: Live-Abzeichen und Feld (8 % der Höhe, @ZM-213) */}
        <div style={sideColumnStyle('start')} data-monitor="nah" data-testid="hall-side-left">
          {!mitteAbzeichen && abzeichen}
          <span style={{ color: colors.textSecondary }} data-testid="hall-field">{t('fieldSelector.field', { field: match.field ?? 1 })}</span>
        </div>
        <div style={{ ...slotStyle, fontSize: slot ? slotFontSize(slot.kind) : undefined, color: slot?.schlussphase === true ? cssVars.colors.scoreboardFinalPhase : colors.timerNormal }} data-testid="hall-slot">
          {mitteAbzeichen && <div style={slotBadgeStyle} data-monitor="nah" data-testid="hall-slot-badge">{abzeichen}</div>}
          {slot && slotText !== null && (
            <span data-monitor="uhr" data-testid={slot.testId} {...(slot.phase === undefined ? {} : { 'data-phase': slot.phase })}>{slotText}</span>
          )}
        </div>
        <div style={sideColumnStyle('end')} data-monitor="nah" data-testid="hall-side-right">
          {group !== undefined && !isSingleGroupId(group) && <span data-testid="hall-group">{t('liveMatch.group', { group })}</span>}
          <span style={{ color: colors.textSecondary }} data-testid="hall-phase-text">{inhalt.right}</span>
        </div>
      </div>
    </>
  );
}

/** Spiel läuft oder ist unterbrochen: Uhr und Balken aus dem Modell der Monitor-Uhr. */
function HallTimedBand(props: HallBandProps): ReactElement {
  const { t } = useTranslation('monitor');
  const { match, theme, colors, clockMode, uhr, finalScore, badge } = props;
  const modell: MonitorUhrModell | null = useMonitorUhr({
    elapsedSeconds: match.elapsedSeconds, durationSeconds: match.durationSeconds, status: match.status, timerStartTime: match.timerStartTime,
    timerElapsedSeconds: match.timerElapsedSeconds, theme, clockMode, uhr,
  });
  const schiessen = badge.kind === 'badge' && badge.state === 'shootout';
  const bar = modell?.balken
    ? <ZeitBalken anteil={modell.balken.anteil} ton={modell.balken.ton} hoehe={displayHall.bar.height} spur={colors.progressTrack} testId="hall-zeitbalken" />
    : null;
  if (schiessen) {
    // Zwischenstand nur, wenn die Ansicht ihn liefert (sonst bleibt der Live-Stand aus, @ZM-194): ohne ihn steht nur das Abzeichen
    const penalty = finalScore?.penalty;
    const text = penalty === undefined ? null : t('liveMatch.penaltyNumbers', { home: penalty.a, away: penalty.b });
    return <HallLayout props={props} inhalt={{ bar, right: null, slot: { kind: 'shootout', text, testId: 'hall-shootout' } }} />;
  }
  // Pause ohne Pausen-Daten oder keine Uhr: nur Balken und Seitenangaben
  const keineZiffern = <HallLayout props={props} inhalt={{ bar, right: null, slot: null }} />;
  if (modell === null) { return keineZiffern; }
  if (modell.restSekunden === null) { return keineZiffern; }
  const phase = modell.schlussphase ? 'schlussphaseAngehalten' : modell.text === 'zeitAbgelaufen' ? 'abgelaufen' : 'normal';
  // Das Abzeichen links sagt schon „Halbzeit“ bzw. „Verlängerung“: rechts steht nur „Pause“, bei der Verlängerung nichts (das Wort wäre breiter als die Seitenspalte)
  const rechts = modell.text === 'verlaengerung' ? null : t(`liveMatch.clock.${UHR_TEXT_KEY[modell.text === 'pauseHalbzeit' ? 'pause' : modell.text]}`);
  return (
    <HallLayout
      props={props}
      inhalt={{ bar, right: rechts, slot: { kind: 'clock', text: formatRemaining(modell.restSekunden), testId: 'hall-clock', phase, schlussphase: modell.schlussphase } }}
    />
  );
}

/** Vor dem Anpfiff und nach dem Ende: keine laufende Uhr, kein Balken. */
function HallStaticBand(props: HallBandProps): ReactElement {
  const { t } = useTranslation('monitor');
  const { match, finalScore, hideScore, kickoff } = props;
  if (match.status === 'FINISHED') {
    // Nach Strafstoßschießen steht das Ergebnis an der Stelle der Restzeit (@ZM-214), sonst „Endstand“; im Kindermodus nie ein Stand
    const penalty = hideScore ? undefined : finalScore?.penalty;
    const text = penalty === undefined ? t('liveMatch.finalScore') : t('liveMatch.hall.afterShootout', { home: penalty.a, away: penalty.b });
    return <HallLayout props={props} inhalt={{ bar: null, right: null, slot: { kind: 'word', text, testId: penalty === undefined ? 'hall-endstand' : 'hall-shootout-result' } }} />;
  }
  if (kickoff) {
    return <HallLayout props={props} inhalt={{ bar: null, right: <>{t('slides.live.kickoff')}{kickoff.notes}</>, slot: { kind: 'clock', text: kickoff.time, testId: 'hall-kickoff', phase: 'anstoss' } }} />;
  }
  return <HallLayout props={props} inhalt={{ bar: null, right: null, slot: null }} />;
}

export function HallBand(props: HallBandProps): ReactElement {
  const timed = props.match.status === 'RUNNING' || props.match.status === 'PAUSED';
  return timed ? <HallTimedBand {...props} /> : <HallStaticBand {...props} />;
}
