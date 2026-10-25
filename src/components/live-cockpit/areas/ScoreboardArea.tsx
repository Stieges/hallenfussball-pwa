/**
 * ScoreboardArea – bindet Tafel (`Scoreboard`) und Meldezeile (`NoticeLine`) an Phase, Uhr und Abzeichen (Aufgabe 2.4).
 *
 * Die Meldezeile liegt im Tafel-Block (Spec § 7): im Fluss, feste Höhe, überlagert nichts. Der Ton-Hinweis ist ein
 * stehendes Abzeichen der Tafel statt eines schwebenden Banners (C-COCKPIT-SOUNDHINWEIS-VERDECKT).
 */
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { MatchCockpitSettings } from '../../../types/tournament';
import { Icons } from '../../ui/Icons';
import { NoticeLine } from '../../ui';
import { Scoreboard, type ScoreboardAbzeichenKnopf } from '../../ui/molecules/Scoreboard';
import type { PhaseView } from '../engine/phaseView';
import type { UseCockpitNoticesReturn, NoticeStufe } from '../hooks/useCockpitNotices';
import type { CockpitPhase } from '../model/cockpitPhase';
import type { MindestpauseHinweis, Side } from '../model/cockpitTypes';
import type { LeerGrund } from '../model/cockpitPhase';
import type { SperrHinweis } from '../../../core/match';
import { useNow } from '../hooks/useNow';
import { alsUebersetzer } from '../model/alsUebersetzer';
import { toScoreboardModel } from '../model/toScoreboardModel';
import type { LiveMatch } from '../types';
import type { CockpitKasten } from '../typesFarben';

export interface ScoreboardAreaProps {
  match: LiveMatch | null;
  phase: CockpitPhase;
  view: PhaseView | null;
  settings: Pick<MatchCockpitSettings, 'clockMode' | 'finalPhaseMinutes'>;
  /** Anzeige-Reihenfolge der Seiten (`useSideOrder`). */
  order: { links: Side; rechts: Side };
  size: 'compact' | 'regular' | 'wide';
  /** Stufe der Fensterhöhe (nur Layout `breit`, @SL-187). */
  stufe?: 'knapp' | 'normal' | 'gross';
  /** Kästen des Spiels nach Heim/Gast (@SL-176). */
  kasten?: CockpitKasten;
  notices: Pick<UseCockpitNoticesReturn, 'aktuell' | 'schliesse'>;
  /** Wirklich wartende Einträge aus dem Ausgang (nie ein gesetzter Zähler, RF4). */
  eintraegeWarten: number;
  helferAnfragen?: number;
  onHelferAnfragen?: () => void;
  tonHinweis?: ScoreboardAbzeichenKnopf | null;
  /** Übergang bis zum schmalen Kopf (Aufgabe 3.8): Verbindungsanzeige. */
  sync?: ReactNode;
  fieldName?: string;
  tournamentName?: string;
  /** Kein Spiel dasteht: wartet auf die Herkunft bzw. kein Spiel mehr (Aufgabe 2.5). */
  leer?: LeerGrund | null;
  mindestpause?: MindestpauseHinweis | null;
  sperrHinweise?: readonly SperrHinweis[];
  /** Name des Geräts, von dem das Spiel übernommen wurde (@SL-015). */
  uebernahmeVon?: string | null;
  /** @FU-115: wer das Spiel im Spielplan beendet hat (`useEingetragenVon`). */
  eingetragenVon?: string | null;
}

/** Anstoßzeit als `HH:MM` (24 Stunden, auch in der englischen Anzeige) in Ortszeit; unlesbar → leer. */
function anstossText(kickoff: string | undefined, sprache: string): string {
  const datum = kickoff ? new Date(kickoff) : null;
  return datum && Number.isFinite(datum.getTime()) ? datum.toLocaleTimeString(sprache, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
}

/**
 * Namen ab dieser Länge brauchen am Handy (360 px, 14 px Schrift, ≈ 31 Zeichen je Zeile) für „Foul für <Name>“ und die übrigen
 * Meldungen mehr als eine Zeile. Gemessen im Review 2c: mit dem Namen von 50 Zeichen sind es drei Zeilen.
 */
const LANGER_NAME = 16;

/** Reservierte Zeilen der Meldezeile: am Handy 2, bei langen Namen 3, sonst 1 (je Spiel aus den Teamnamen); ändert sich im Spiel nie (B3). */
function meldezeilen(match: LiveMatch | null, size: ScoreboardAreaProps['size']): 1 | 2 | 3 {
  const lang = match !== null && Math.max(match.homeTeam.name.length, match.awayTeam.name.length) > LANGER_NAME;
  // Am Handy passt auch „SV Südpark: 5. Foul in dieser Halbzeit“ nicht in eine Zeile: mindestens 2, bei langem Namen 3 (N1)
  if (size !== 'compact') { return 1; }
  return lang ? 3 : 2;
}

/** Symbol je Stufe (Mockup `.msg.l2/.l3`): Farbe allein trägt keine Bedeutung. */
function noticeIcon(stufe: NoticeStufe | undefined): ReactElement | undefined {
  if (stufe === undefined) { return undefined; }
  const symbol = stufe === 3 ? <Icons.Check size={iconSizeValues.sm} /> : stufe === 2 ? <Icons.AlertTriangle size={iconSizeValues.sm} /> : <Icons.Info size={iconSizeValues.sm} />;
  const color = stufe === 3 ? cssVars.colors.scoreboardOk : stufe === 2 ? cssVars.colors.scoreboardHighlight : cssVars.colors.scoreboardInfo;
  return <span data-testid={`notice-icon-${stufe}`} style={{ display: 'flex', color }}>{symbol}</span>;
}

export function ScoreboardArea(props: ScoreboardAreaProps): ReactElement {
  const { match, phase, view, settings, order, size, stufe, kasten, notices, eintraegeWarten, helferAnfragen = 0, onHelferAnfragen, tonHinweis, sync, fieldName, tournamentName, leer = null, mindestpause = null, sperrHinweise = [], uebernahmeVon = null, eingetragenVon = null } = props;
  const { t, i18n } = useTranslation('cockpit');
  // Takt nur vor dem Anpfiff: „überfällig N Min“ (@OB-068) (@SL-118); sonst steht der Wert still
  const jetztMs = useNow(phase.zustand === 'vorAnpfiff' ? 30_000 : null);
  const kickoff = match?.scheduledKickoff;
  const model = useMemo(
    () => toScoreboardModel({
      match, phase, view, links: order.links, rechts: order.rechts, uhrArt: settings.clockMode,
      schlussphaseMinuten: settings.finalPhaseMinutes, kasten, eintraegeWarten, helferAnfragen, jetztMs, fieldName, tournamentName,
      vor: { anstoss: anstossText(kickoff, i18n.language), mindestpause, sperrHinweise, leer, uebernahmeVon }, eingetragenVon,
    }, alsUebersetzer(t)),
    [match, phase, view, kasten, order.links, order.rechts, settings.clockMode, settings.finalPhaseMinutes, eintraegeWarten, helferAnfragen, jetztMs, fieldName, tournamentName, kickoff, mindestpause, sperrHinweise, leer, uebernahmeVon, eingetragenVon, t, i18n.language],
  );
  // @SL-152: solange die Quittung steht, sagt sie dasselbe genauer („Abgepfiffen · 2:1 gespeichert“); nur diese Meldung entfällt
  const meldung = notices.aktuell?.kennung === 'abgepfiffen' && model.quittungText ? null : notices.aktuell;
  return (
    <Scoreboard
      testId="scoreboard"
      model={model}
      size={size}
      stufe={stufe}
      onHelferAnfragen={helferAnfragen > 0 ? onHelferAnfragen : undefined}
      tonHinweis={tonHinweis}
      kopfRechts={sync}
      meldezeile={(
        <NoticeLine
          testId="notice-line"
          text={meldung?.text ?? null}
          onClose={meldung?.stufe === 1 ? notices.schliesse : undefined}
          closeLabel={t('meldung.schliessen')}
          icon={noticeIcon(meldung?.stufe)}
          size={size === 'compact' ? 'compact' : 'regular'}
          zeilen={meldezeilen(match, size)}
          art={size === 'wide' ? 'einblendung' : 'zeile'}
          stufe={meldung?.stufe}
        />
      )}
    />
  );
}
