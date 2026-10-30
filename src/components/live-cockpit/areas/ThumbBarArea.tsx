/**
 * ThumbBarArea – bindet die Daumenleiste (`ThumbBar`) an Zustand, Befehle und Rechte (Plan PR 3, Aufgabe 3.6).
 *
 * `leisteFuer` sagt, welche Plätze der Zustand hat; hier werden sie zu Slots (Text `leiste.*`, Symbole `MatchIcons`,
 * Tasten-Hinweise). Ohne Steuerrecht steht statt der Leiste die Nur-Lesen-Zeile. Die Leiste steht im Fluss am unteren Rand
 * der Cockpit-Spalte (`position: sticky`), damit „Wiederanpfiff“ auch bei 360 × 640 im ersten Bildschirm liegt.
 * „Abpfiff halten“ ist ein Halteknopf (Entscheidung A2, @SL-157); „Spiel fortsetzen“ steht, solange `controls.onFortsetzen` da ist (LT-6,
 * @SL-074, @SL-075); „Korrigieren“ bindet LT-5.
 */
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { MatchIcons } from '../../ui/IconsMatch';
import { ThumbBar, type ThumbBarRolle, type ThumbBarSlot } from '../../ui/molecules/ThumbBar';
import type { CockpitPhase } from '../model/cockpitPhase';
import type { CockpitControls } from '../model/cockpitTypes';
import { istApple } from '../model/plattform';
import { useFeinerZeiger } from '../hooks/useFeinerZeiger';
import { leisteFuer, type LeistenAktion } from '../model/thumbBarModel';
import type { LiveCockpitLeisteProps, TiebreakWahl } from '../typesLeiste';
import { NurLesenLeiste } from './NurLesenLeiste';
import { TiebreakChoiceSheet } from './TiebreakChoiceSheet';

export interface ThumbBarAreaProps {
  phase: CockpitPhase;
  /** Die eine Quelle: `data-layout` der Hülle. */
  layout: 'daumen' | 'breit';
  kannSteuern: boolean;
  istLeitung: boolean;
  /** Turnier abgeschlossen: die Nur-lesen-Leiste nennt es (R3-3). */
  abgeschlossen?: boolean;
  fieldName: string;
  steuerung?: LiveCockpitLeisteProps['steuerung'];
  controls: CockpitControls;
  /** „Weiter“ nach dem Abpfiff: das nächste Spiel des Felds (@SL-162). */
  onWeiterNaechstes: () => void;
  /** „Korrigieren“ nach dem Abpfiff (@SL-159): öffnet die Korrektur mit Grund; ohne Handler keine Taste. */
  onKorrigieren?: () => void;
  onChooseTiebreak?: (wahl: TiebreakWahl) => void;
  /** Schalter „Tastenkürzel“ (Vorgabe an): aus → keine Hinweise und kein `aria-keyshortcuts` (@SL-189). */
  tastenAn?: boolean;
}

const klebtUnten = { flex: 'none', position: 'sticky', bottom: 0, zIndex: cssVars.zIndex.sticky } as const;

function plattformName(): string {
  if (typeof navigator === 'undefined') { return ''; }
  const n = navigator as Navigator & { userAgentData?: { platform?: string } };
  return n.userAgentData?.platform ?? n.platform ?? '';
}

export function ThumbBarArea(p: ThumbBarAreaProps): ReactElement | null {
  const { phase, layout, kannSteuern, istLeitung, controls } = p;
  const { t } = useTranslation('cockpit');
  const feinerZeiger = useFeinerZeiger(); // Chips nur mit Maus oder Trackpad (@SL-188)
  const tastenAn = p.tastenAn ?? true;
  const [entscheidungOffen, setEntscheidungOffen] = useState(false);
  // Die 1-s-Sperre von „Rückgängig“ steckt in `controls.onUndo` (eine Instanz für Knopf und Tastenkürzel, @SL-108)
  const rueckgaengig = controls.onUndo ?? (() => undefined);

  // „Spiel fortsetzen“ nur mit Handler (30 Sekunden Endstand, einmal, Ende durch Ablauf; LT-6); „Korrigieren“ mit Weg und Leitungsrecht (@SL-159).
  const modell = leisteFuer(phase, { layout, istLeitung, fortsetzenMoeglich: controls.onFortsetzen !== undefined, korrigierenMoeglich: p.onKorrigieren !== undefined });
  if (modell.aktionen.length === 0) { return null; }

  if (!kannSteuern) {
    return (
      <div style={klebtUnten}>
        <NurLesenLeiste
          fieldName={p.fieldName} steuerung={p.steuerung} abgeschlossen={p.abgeschlossen} mitEreignissen={modell.aktionen.includes('ereignisse')}
          onEreignisse={controls.onEventLog} onMehr={controls.onMore}
        />
      </div>
    );
  }

  const aktion = (label: string, testId: string, rolle: ThumbBarRolle, onPress: () => void, icon: ReactElement, extra: Partial<Extract<ThumbBarSlot, { art: 'aktion' }>> = {}): ThumbBarSlot => (
    { art: 'aktion', label, icon, onPress, rolle, testId, ...extra }
  );
  const leertaste = tastenAn ? { text: t('leiste.tasteLeertaste'), aria: 'Space' } : undefined;
  const slotFuer = (a: LeistenAktion): ThumbBarSlot | null => {
    switch (a) {
      case 'anpfiff': return aktion(t('leiste.anpfiff'), 'match-start-button', 'haupt', controls.onStart, <MatchIcons.Play />);
      case 'pause': return aktion(t('leiste.pause'), 'match-pause-button', 'haupt', controls.onPauseResume, <MatchIcons.Pause />, { taste: leertaste });
      case 'weiter': return aktion(t('leiste.weiter'), 'match-resume-button', 'haupt', controls.onPauseResume, <MatchIcons.Play />, { taste: leertaste });
      case 'wiederanpfiff': return aktion(t('leiste.wiederanpfiff'), 'match-wiederanpfiff-button', 'haupt', controls.onPauseResume, <MatchIcons.Play />);
      case 'anpfiffVerlaengerung': return aktion(t('leiste.anpfiffVerlaengerung'), 'match-anpfiff-verlaengerung-button', 'haupt', controls.onPauseResume, <MatchIcons.Play />);
      case 'entscheidung': return aktion(t('leiste.entscheidung'), 'match-tiebreak-button', 'haupt', () => { setEntscheidungOffen(true); }, <MatchIcons.Flag />, { disabled: !p.onChooseTiebreak });
      case 'weiterNaechstes': return aktion(t('leiste.weiterNaechstes'), 'match-next-button', 'haupt', p.onWeiterNaechstes, <MatchIcons.Play />);
      case 'rueckgaengig': {
        // Der Platz bleibt immer stehen (die Leiste springt nicht); ohne Ziel oder Engine-Weg ist der Knopf gesperrt (@FU-071)
        const taste = tastenAn ? { text: istApple(plattformName()) ? t('leiste.tasteRueckgaengigCmd') : t('leiste.tasteRueckgaengigStrg'), aria: 'Control+Z Meta+Z' } : undefined;
        return aktion(t('leiste.rueckgaengig'), 'match-undo-button', 'neben', rueckgaengig, <MatchIcons.Undo />, {
          disabled: !controls.onUndo || !controls.canUndo, gestrichelt: layout === 'breit', taste,
          ariaLabel: controls.undoLabel ? t('leiste.rueckgaengigAria', { ziel: controls.undoLabel }) : undefined,
        });
      }
      case 'ereignisse': return aktion(t('leiste.ereignisse'), 'match-event-log-button', 'neben', controls.onEventLog, <MatchIcons.List />);
      case 'mehr': return aktion(t('leiste.mehr'), 'cockpit-more-button', 'mehr', controls.onMore, <MatchIcons.More />);
      case 'abpfiffHalten':
        return {
          art: 'halten',
          halten: {
            label: t('abpfiff.label'), sublabel: t('abpfiff.halten'), icon: <MatchIcons.Whistle />, onHold: controls.onFinish,
            testId: 'match-finish-button', beschreibung: t('abpfiff.beschreibung'),
          },
        };
      case 'korrigieren': {
        const onKorrigieren = p.onKorrigieren;
        return onKorrigieren ? aktion(t('leiste.korrigieren'), 'match-correct-button', 'neben', onKorrigieren, <MatchIcons.Edit />) : null;
      }
      case 'fortsetzen': {
        const onFortsetzen = controls.onFortsetzen;
        return onFortsetzen ? aktion(t('leiste.fortsetzen'), 'match-continue-button', 'neben', onFortsetzen, <MatchIcons.Stopwatch />) : null;
      }
    }
  };
  const slots = modell.aktionen.map(slotFuer).filter((s): s is ThumbBarSlot => s !== null);
  // Nach dem Abpfiff steht der Hinweis „Korrektur über die Turnierleitung“ nur für Helfer (@HE-043); der Hinweis „Korrektur folgt“ für die
  // Turnierleitung entfällt, sie hat „Korrigieren“ (@SL-159). Die Leiste hat dort kein Rückgängig, ein Grund dafür wäre ohne Platz.
  const hinweis = modell.hinweis === 'beendetHelfer'
    ? { text: t('leiste.beendet'), testId: 'bar-finished' }
    : controls.undoHint && phase.zustand !== 'abgepfiffen' ? { text: controls.undoHint, testId: 'match-undo-hint' } : undefined;

  return (
    <div style={klebtUnten}>
      <ThumbBar ariaLabel={t('leiste.aria')} slots={slots} layout={layout} hinweis={hinweis} tastenChips={feinerZeiger} />
      <TiebreakChoiceSheet
        isOpen={entscheidungOffen}
        onClose={() => { setEntscheidungOffen(false); }}
        onWaehle={(wahl) => { setEntscheidungOffen(false); p.onChooseTiebreak?.(wahl); }}
      />
    </div>
  );
}
