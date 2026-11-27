/**
 * HallBand – Zeitbalken und Uhrband unter den Farbflächen (@ZM-213, @ZM-214, @ZM-215): der Balken (6 % der Höhe) läuft über die ganze Breite und
 * nimmt wie die Restzeit ab, die abgelaufene Strecke bleibt als Bahn sichtbar; darunter steht die Restzeit so groß wie möglich in der Mitte, klein links das Live-Abzeichen
 * (mit dem Feld als Spielfeld-Symbol mit Nummer, nur bei mehr als einem Feld) und rechts die Gruppe (Buchstabe im Kasten, nur bei mehr als einer Gruppe), der Abschnitt
 * (Punkte, nur bei mehr als einem Abschnitt) und die Symbole des Uhr-Zustands (nur bei Abweichung vom laufenden Spiel); das Wort „Restzeit“ gibt es nicht, Wörter an der Uhr auch nicht mehr
 * (Daniel 2026-11-19: Symbole statt Text; jedes Symbol trägt das bisherige Wort als zugänglichen Namen, `uhrZustand`). Jede Angabe steht nur an einer Stelle: das Abzeichen sagt, was die
 * Folie zeigt („Live“, „Nächstes Spiel“, „Strafstoßschießen“), die Uhr sagt, was mit der Uhr ist. Eine Kopfzeile gibt es nicht. Beide Zeilen liegen in jedem Zustand an derselben Stelle (@ZM-151):
 * - läuft das Spiel: Restzeit (Themenfarbe; bei angehaltener Uhr gedämpft und nur der Balken grau); bei zu wenig Höhe in den Seitenspalten rücken die Zeilen zusammen (Schrift kleiner, nie weggelassen, `useBandFit`)
 * - vor dem Anpfiff: Anstoßzeit an der Stelle der Restzeit, daneben „Nächstes Spiel“ (Abzeichen der Live-Folie) und das Uhr-Symbol
 * - Halbzeitpause: die Pausenzeit an der Stelle der Restzeit, daneben der halbe Kreis (das Abzeichen links bleibt „Live“)
 * - Strafstoßschießen: Zwischenstand an der Stelle der Restzeit, daneben „Strafstoßschießen“, kein Balken
 * - Ende: „Endstand“ bzw. „4 : 3 i. E.“ an der Stelle der Restzeit, kein Balken, kein Abzeichen „Ende“ (Daniel 2026-11-19: jede Angabe nur an einer Stelle)
 * - Die Symbole des Zustands stehen in Textfarbe und zur Uhr hin ausgerichtet (linker Rand der rechten Spalte), nicht am rechten Rand
 * Daten und Zustandsregeln dieselben wie in der übrigen Live-Folie (`useMonitorUhr`, `monitorUhrOf`, Abzeichen der Ansicht).
 */
import { useRef, type ReactElement, type ReactNode } from 'react';
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
import { useMonitorUhr, type MatchTimerUhrQuelle } from '../useMonitorUhr';
import { FeldSymbol, GruppenKasten, MonitorSymbol } from '../../ui/atoms/MonitorSymbole';
import { AbschnittAnzeige, UhrZustand } from '../uhrZustand';
import { abschnittVon, uhrSymbole, ziffernGedaempft, type UhrSymbolDef } from '../uhrSymbole';
import { useBandFit } from './useBandFit';
import { bandStyle, barRowStyle, sideColumnStyle, slotBadgeStyle, slotFontSize, slotStyle } from './hallStyles';

export interface HallBandProps {
  match: LiveMatch;
  group?: string;
  badge: MatchBadgeModel;
  theme: MonitorTheme;
  colors: MonitorThemeColors;
  /** Aufgelöstes Thema (Farben des Zeitbalkens je Thema) */
  resolvedTheme: 'light' | 'dark';
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

interface Slot { kind: SlotKind; /** `null`: nur das Abzeichen (Strafstoßschießen ohne sichtbaren Zwischenstand) */ text: string | null; testId: string; phase?: string; schlussphase?: boolean; /** Uhr angehalten: Ziffern gedämpft */ gedaempft?: boolean }

interface BandInhalt {
  bar: ReactNode;
  slot: Slot | null;
  /** Symbole des Uhr-Zustands rechts neben der Uhr, nur bei Abweichung vom laufenden Spiel (unter Gruppe und Abschnitt); vor dem Anpfiff das Uhr-Symbol */
  symbole: UhrSymbolDef[];
  /** Vor dem Anpfiff: das Uhr-Symbol „Anstoß“ und die Hinweise unter der Anstoßzeit (z. B. „war 14:00“) */
  anstoss?: ReactNode;
  /** Abschnitt (Punkte), nur bei mehr als einem Abschnitt */
  section: { current: number; total: number } | null;
  /** `MonitorUhrText` des Modells (Prüfhilfe am Symbol) */
  uhrText?: string;
}

function HallLayout({ props, inhalt }: { props: HallBandProps; inhalt: BandInhalt }): ReactElement {
  const { t } = useTranslation('monitor');
  const { match, group, badge, colors, showField = true, showGroup = true } = props;
  const bandRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const rechtsRef = useRef<HTMLDivElement>(null);
  const slot = inhalt.slot;
  const symbols = displayHall.symbols;
  const slotText = slot?.text ?? null;
  // Neu messen nur, wenn sich Text oder Aufbau ändern, nicht bei jedem Uhrtakt: die Ziffern der Uhr zählen nicht (tabellarische Ziffern, gleiche Breite)
  const schluessel = [slot?.kind, slotText?.replace(/\d/g, '0'), showField, showGroup, group, JSON.stringify(inhalt.section), inhalt.symbole.map((x) => x.kind).join(','), inhalt.anstoss === undefined ? '' : 'anstoss', JSON.stringify(badge)].join('|');
  useBandFit({ band: bandRef, slot: slotRef, text: textRef, links: linksRef, rechts: rechtsRef }, schluessel);
  // Strafstoßschießen: das Wort steht über dem Zwischenstand in der Mitte (Mockup „schiessen“), nicht links (es ist breiter als die Seitenspalte)
  const mitteAbzeichen = slot?.kind === 'shootout';
  // Nach dem Abpfiff steht „Endstand“ (bzw. das Strafstoßergebnis) groß an der Stelle der Uhr: das Abzeichen „Ende“ entfällt, jede Angabe nur an einer Stelle (@ZM-214, Daniel 2026-11-19)
  const ohneEndeAbzeichen = slot?.kind === 'word' && badge.kind === 'badge' && badge.state === 'ended';
  // Solange das Spiel läuft (auch Uhr angehalten, Halbzeitpause, Verlängerung) steht kein Abzeichen „Live“; „Nächstes Spiel“, „Strafstoßschießen“ und „Endstand“ bleiben (@ZM-220, Daniel 2026-11-27)
  const ohneLive = badge.kind === 'badge' && badge.state === 'live';
  const ohneAbzeichen = ohneEndeAbzeichen || ohneLive;
  const abzeichen = ohneAbzeichen ? null : <MatchStatusBadge model={badge} size="halle" tone={monitorBadgeTone(colors)} />;
  return (
    <>
      <div style={barRowStyle} data-testid="hall-bar-row">{inhalt.bar}</div>
      <div ref={bandRef} style={bandStyle} data-testid="hall-band">
        {/* Nah-Information: Abzeichen (nicht „Live“, @ZM-220) und Feld (8 % der Höhe, @ZM-213); das Feld nur bei mehr als einem Feld (@ZM-215) */}
        <div ref={linksRef} style={sideColumnStyle('start')} data-monitor="nah" data-testid="hall-side-left">
          {!mitteAbzeichen && abzeichen}
          {showField && <FeldSymbol number={match.field ?? 1} label={t('fieldSelector.field', { field: match.field ?? 1 })} size={symbols.field} color={colors.textSecondary} testId="hall-field" />}
        </div>
        <div ref={slotRef} style={{ ...slotStyle, fontSize: slot ? slotFontSize(slot.kind) : undefined, color: slot?.schlussphase === true ? cssVars.colors.scoreboardFinalPhase : slot?.gedaempft === true ? colors.textSecondary : colors.timerNormal }} data-testid="hall-slot">
          {mitteAbzeichen && <div style={slotBadgeStyle} data-monitor="nah" data-testid="hall-slot-badge">{abzeichen}</div>}
          {slot && slotText !== null && (
            <span ref={textRef} data-monitor="uhr" data-testid={slot.testId} {...(slot.phase === undefined ? {} : { 'data-phase': slot.phase })}>{slotText}</span>
          )}
        </div>
        <div ref={rechtsRef} style={sideColumnStyle('end')} data-monitor="nah" data-testid="hall-side-right">
          {showGroup && group !== undefined && !isSingleGroupId(group) && (
            <GruppenKasten group={group} label={t('liveMatch.group', { group })} size={symbols.group} border={symbols.groupBorder} radius={symbols.groupRadius} testId="hall-group" />
          )}
          {inhalt.section !== null && (
            <AbschnittAnzeige current={inhalt.section.current} total={inhalt.section.total} size={symbols.dot} gap={symbols.dotGap} border={symbols.dotBorder} color={colors.textSecondary} testId="hall-section" />
          )}
          {inhalt.symbole.length > 0 && (
            <UhrZustand symbole={inhalt.symbole} size={symbols.state} gap={symbols.stateGap} color={colors.text} alignSelf="flex-start" testId="hall-phase-text" text={inhalt.uhrText ?? ''} />
          )}
          {inhalt.anstoss}
        </div>
      </div>
    </>
  );
}

/** Spiel läuft oder ist unterbrochen: Uhr und Balken aus dem Modell der Monitor-Uhr. */
function HallTimedBand(props: HallBandProps): ReactElement {
  const { t } = useTranslation('monitor');
  const { match, theme, clockMode, uhr, finalScore, badge, resolvedTheme } = props;
  const barColors = displayHall.barColors[resolvedTheme];
  const modell: MonitorUhrModell | null = useMonitorUhr({
    elapsedSeconds: match.elapsedSeconds, durationSeconds: match.durationSeconds, status: match.status, timerStartTime: match.timerStartTime,
    timerElapsedSeconds: match.timerElapsedSeconds, theme, clockMode, uhr,
  });
  const schiessen = badge.kind === 'badge' && badge.state === 'shootout';
  const bar = modell?.balken
    // Der Balken beginnt voll und nimmt mit der Restzeit ab (links verankert); die abgelaufene Strecke bleibt als Bahn sichtbar (@ZM-215)
    ? <ZeitBalken anteil={modell.balken.anteil} ton={modell.balken.ton} hoehe={displayHall.bar.height} spur={barColors.track} farben={barColors} testId="hall-zeitbalken" />
    : null;
  if (schiessen) {
    // Zwischenstand nur, wenn die Ansicht ihn liefert (sonst bleibt der Live-Stand aus, @ZM-194): ohne ihn steht nur das Abzeichen
    const penalty = finalScore?.penalty;
    const text = penalty === undefined ? null : t('liveMatch.penaltyNumbers', { home: penalty.a, away: penalty.b });
    return <HallLayout props={props} inhalt={{ bar, symbole: [], section: null, slot: { kind: 'shootout', text, testId: 'hall-shootout' } }} />;
  }
  // Pause ohne Pausen-Daten oder keine Uhr: nur Balken und Seitenangaben
  const keineZiffern = <HallLayout props={props} inhalt={{ bar, symbole: modell === null ? [] : uhrSymbole(modell), section: null, slot: null, ...(modell === null ? {} : { uhrText: modell.text }) }} />;
  // Auch ohne Pausen-Daten (Restzeit unbekannt) steht der Zustand der Uhr als Symbol: das Abzeichen sagt dort „Live“, sonst stünde die Pause nirgends (Review PR #563 D2)
  if (modell === null) { return keineZiffern; }
  if (modell.restSekunden === null) { return keineZiffern; }
  const phase = modell.schlussphase ? 'schlussphaseAngehalten' : modell.text === 'zeitAbgelaufen' ? 'abgelaufen' : 'normal';
  // Symbole nur bei Abweichung vom laufenden Spiel (@ZM-215): angehalten, Pause, Zeit abgelaufen, Verlängerung; das Abzeichen links bleibt „Live“. Der Abschnitt steht als Punkte,
  // nur bei mehr als einem Abschnitt und nicht in der Pause oder Verlängerung (dort gibt es keinen regulären Abschnitt)
  return (
    <HallLayout
      props={props}
      inhalt={{
        bar, symbole: uhrSymbole(modell), section: abschnittVon(modell), uhrText: modell.text,
        slot: { kind: 'clock', text: formatRemaining(modell.restSekunden), testId: 'hall-clock', phase, schlussphase: modell.schlussphase, gedaempft: ziffernGedaempft(modell) },
      }}
    />
  );
}

/** Vor dem Anpfiff und nach dem Ende: keine laufende Uhr, kein Balken. */
function HallStaticBand(props: HallBandProps): ReactElement {
  const { t } = useTranslation('monitor');
  const { match, finalScore, hideScore, kickoff, colors } = props;
  if (match.status === 'FINISHED') {
    // Nach Strafstoßschießen steht das Ergebnis an der Stelle der Restzeit (@ZM-214), sonst „Endstand“; im Kindermodus nie ein Stand
    const penalty = hideScore ? undefined : finalScore?.penalty;
    const text = penalty === undefined ? t('liveMatch.finalScore') : t('liveMatch.hall.afterShootout', { home: penalty.a, away: penalty.b });
    return <HallLayout props={props} inhalt={{ bar: null, symbole: [], section: null, slot: { kind: 'word', text, testId: penalty === undefined ? 'hall-endstand' : 'hall-shootout-result' } }} />;
  }
  if (kickoff) {
    const anstoss = (
      <>
        <MonitorSymbol kind="uhr" size={displayHall.symbols.state} label={t('slides.live.kickoff')} color={colors.text} alignSelf="flex-start" testId="hall-kickoff-symbol" />
        {kickoff.notes}
      </>
    );
    return <HallLayout props={props} inhalt={{ bar: null, symbole: [], section: null, anstoss, slot: { kind: 'clock', text: kickoff.time, testId: 'hall-kickoff', phase: 'anstoss' } }} />;
  }
  return <HallLayout props={props} inhalt={{ bar: null, symbole: [], section: null, slot: null }} />;
}

export function HallBand(props: HallBandProps): ReactElement {
  const timed = props.match.status === 'RUNNING' || props.match.status === 'PAUSED';
  return timed ? <HallTimedBand {...props} /> : <HallStaticBand {...props} />;
}
