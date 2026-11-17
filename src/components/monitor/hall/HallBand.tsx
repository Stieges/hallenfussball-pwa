/**
 * HallBand – Zeitbalken und Uhrband unter den Farbflächen (@ZM-213, @ZM-214, @ZM-215): der Balken (6 % der Höhe) läuft über die ganze Breite und
 * nimmt wie die Restzeit ab, die abgelaufene Strecke bleibt als Bahn sichtbar; darunter steht die Restzeit so groß wie möglich in der Mitte, klein links das Live-Abzeichen
 * (mit dem Feld nur bei mehr als einem Feld) und rechts die Gruppe (nur bei mehr als einer Gruppe), der Abschnitt (nur bei mehr als einem Abschnitt)
 * und ein Wort nur bei Abweichung vom laufenden Spiel („angehalten“, „Pause“, „Zeit abgelaufen“); das Wort „Restzeit“ gibt es nicht. Eine Kopfzeile gibt es nicht. Beide Zeilen liegen in jedem Zustand an derselben Stelle (@ZM-151):
 * - läuft das Spiel: Restzeit (weiß, auch bei angehaltener Uhr; nur der Balken wird grau, Entscheidung offen @ZM-212)
 * - vor dem Anpfiff: Anstoßzeit an der Stelle der Restzeit, daneben „Nächstes Spiel“ (Abzeichen der Live-Folie)
 * - Halbzeitpause: die Pausenzeit an der Stelle der Restzeit, daneben „Pause · Halbzeit“
 * - Strafstoßschießen: Zwischenstand an der Stelle der Restzeit, daneben „Strafstoßschießen“, kein Balken
 * - Ende: „Endstand“ bzw. „4 : 3 i. E.“ an der Stelle der Restzeit, kein Balken
 * Daten und Zustandsregeln dieselben wie in der übrigen Live-Folie (`useMonitorUhr`, `monitorUhrOf`, Abzeichen der Ansicht).
 */
import { useRef, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isSingleGroupId } from '../../../core/models/standingsGroups';
import { formatRemaining, regularKey, type FinalScore, type MatchBadgeModel, type MonitorUhrModell } from '../../../core/view';
import type { MonitorThemeColors } from '../../../design-tokens';
import { cssVars, displayHall } from '../../../design-tokens';
import type { MonitorTheme } from '../../../types/monitor';
import type { LiveMatch } from '../../../hooks/useLiveMatches';
import type { ClockMode } from '../../../core/match/clockDisplay';
import { MatchStatusBadge } from '../../ui/molecules/MatchStatusBadge';
import { monitorBadgeTone } from '../../ui/molecules/matchStatusBadgeStyle';
import { ZeitBalken } from '../../ui/atoms/ZeitBalken';
import { UHR_TEXT_KEY, useMonitorUhr, type MatchTimerUhrQuelle } from '../useMonitorUhr';
import { useBandFit } from './useBandFit';
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
  /** Feld im Band nur bei mehr als einem Feld im Turnier (@ZM-215) */
  showField?: boolean;
  /** Gruppe im Band nur bei mehr als einer Gruppe im Turnier (@ZM-215) */
  showGroup?: boolean;
  /** Vor dem Anpfiff: Anstoßzeit an der Stelle der Restzeit */
  kickoff?: { time: string; notes?: ReactNode };
}

type SlotKind = 'clock' | 'word' | 'shootout';

interface Slot { kind: SlotKind; /** `null`: nur das Abzeichen (Strafstoßschießen ohne sichtbaren Zwischenstand) */ text: string | null; testId: string; phase?: string; schlussphase?: boolean }

interface BandInhalt {
  bar: ReactNode;
  slot: Slot | null;
  /** Wort rechts neben der Uhr, nur bei Abweichung vom laufenden Spiel (unter Gruppe und Abschnitt) */
  right: ReactNode;
  /** Abschnitt („1. Halbzeit“), nur bei mehr als einem Abschnitt */
  section?: string;
}

function HallLayout({ props, inhalt }: { props: HallBandProps; inhalt: BandInhalt }): ReactElement {
  const { t } = useTranslation('monitor');
  const { match, group, badge, colors, showField = true, showGroup = true } = props;
  const bandRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const rechtsRef = useRef<HTMLDivElement>(null);
  useBandFit({ band: bandRef, slot: slotRef, text: textRef, links: linksRef, rechts: rechtsRef });
  const slot = inhalt.slot;
  const slotText = slot?.text ?? null;
  // Strafstoßschießen: das Wort steht über dem Zwischenstand in der Mitte (Mockup „schiessen“), nicht links (es ist breiter als die Seitenspalte)
  const mitteAbzeichen = slot?.kind === 'shootout';
  const abzeichen = <MatchStatusBadge model={badge} size="halle" tone={monitorBadgeTone(colors)} />;
  return (
    <>
      <div style={barRowStyle} data-testid="hall-bar-row">{inhalt.bar}</div>
      <div ref={bandRef} style={bandStyle} data-testid="hall-band">
        {/* Nah-Information: Live-Abzeichen und Feld (8 % der Höhe, @ZM-213); das Feld nur bei mehr als einem Feld (@ZM-215) */}
        <div ref={linksRef} style={sideColumnStyle('start')} data-monitor="nah" data-testid="hall-side-left">
          {!mitteAbzeichen && abzeichen}
          {showField && <span style={{ color: colors.textSecondary }} data-testid="hall-field">{t('fieldSelector.field', { field: match.field ?? 1 })}</span>}
        </div>
        <div ref={slotRef} style={{ ...slotStyle, fontSize: slot ? slotFontSize(slot.kind) : undefined, color: slot?.schlussphase === true ? cssVars.colors.scoreboardFinalPhase : colors.timerNormal }} data-testid="hall-slot">
          {mitteAbzeichen && <div style={slotBadgeStyle} data-monitor="nah" data-testid="hall-slot-badge">{abzeichen}</div>}
          {slot && slotText !== null && (
            <span ref={textRef} data-monitor="uhr" data-testid={slot.testId} {...(slot.phase === undefined ? {} : { 'data-phase': slot.phase })}>{slotText}</span>
          )}
        </div>
        <div ref={rechtsRef} style={sideColumnStyle('end')} data-monitor="nah" data-testid="hall-side-right">
          {showGroup && group !== undefined && !isSingleGroupId(group) && <span data-testid="hall-group">{t('liveMatch.group', { group })}</span>}
          {inhalt.section !== undefined && <span style={{ color: colors.textSecondary }} data-testid="hall-section">{inhalt.section}</span>}
          {inhalt.right !== null && inhalt.right !== undefined && <span style={{ color: colors.textSecondary }} data-testid="hall-phase-text">{inhalt.right}</span>}
        </div>
      </div>
    </>
  );
}

/** Spiel läuft oder ist unterbrochen: Uhr und Balken aus dem Modell der Monitor-Uhr. */
function HallTimedBand(props: HallBandProps): ReactElement {
  const { t } = useTranslation('monitor');
  const { t: tT } = useTranslation('tournament');
  const { match, theme, colors, clockMode, uhr, finalScore, badge } = props;
  const modell: MonitorUhrModell | null = useMonitorUhr({
    elapsedSeconds: match.elapsedSeconds, durationSeconds: match.durationSeconds, status: match.status, timerStartTime: match.timerStartTime,
    timerElapsedSeconds: match.timerElapsedSeconds, theme, clockMode, uhr,
  });
  const schiessen = badge.kind === 'badge' && badge.state === 'shootout';
  const bar = modell?.balken
    // Der Balken beginnt voll und nimmt mit der Restzeit ab (links verankert); die abgelaufene Strecke bleibt als Bahn sichtbar (@ZM-215)
    ? <ZeitBalken anteil={modell.balken.anteil} ton={modell.balken.ton} hoehe={displayHall.bar.height} spur={colors.background} rand={{ farbe: colors.textMuted, breite: displayHall.bar.border }} testId="hall-zeitbalken" />
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
  // Ein Wort nur bei Abweichung vom laufenden Spiel (@ZM-215): „angehalten“, „Pause“, „Zeit abgelaufen“; das Abzeichen links sagt schon „Halbzeit“ bzw. „Verlängerung“
  const abweichung = modell.text === 'restzeit' || modell.text === 'verlaengerung' ? null : t(`liveMatch.clock.${UHR_TEXT_KEY[modell.text === 'pauseHalbzeit' ? 'pause' : modell.text]}`);
  // Abschnitt nur bei mehr als einem Abschnitt und nicht in der Pause oder Verlängerung (dort sagt es das Abzeichen)
  const imAbschnitt = modell.text === 'restzeit' || modell.text === 'angehalten' || modell.text === 'zeitAbgelaufen';
  const abschnittKey = imAbschnitt && modell.abschnitt !== undefined && modell.abschnitte !== undefined ? regularKey(modell.abschnitt, modell.abschnitte) : null;
  const zaehler = { section: modell.abschnitt ?? 1, sections: modell.abschnitte ?? 1 };
  const abschnitt = abschnittKey === 'firstHalf' ? tT('matchClock.section.firstHalf')
    : abschnittKey === 'secondHalf' ? tT('matchClock.section.secondHalf')
      : abschnittKey === 'sectionOfN' ? tT('matchClock.section.sectionOfN', zaehler) : undefined;
  return (
    <HallLayout
      props={props}
      inhalt={{ bar, right: abweichung, section: abschnitt, slot: { kind: 'clock', text: formatRemaining(modell.restSekunden), testId: 'hall-clock', phase, schlussphase: modell.schlussphase } }}
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
