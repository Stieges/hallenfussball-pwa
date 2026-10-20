/**
 * ThumbBarArea – bindet die Daumenleiste (`ThumbBar`) an Zustand, Befehle und Rechte (Plan PR 3, Aufgabe 3.6).
 *
 * `leisteFuer` sagt, welche Plätze der Zustand hat; hier werden sie zu Slots (Text `leiste.*`, Symbole `MatchIcons`,
 * Tasten-Hinweise). Ohne Steuerrecht steht statt der Leiste die Nur-Lesen-Zeile. Die Leiste steht im Fluss am unteren Rand
 * der Cockpit-Spalte (`position: sticky`), damit „Wiederanpfiff“ auch bei 360 × 640 im ersten Bildschirm liegt.
 * „Abpfiff halten“ ist ein Halteknopf (Entscheidung A2, @SL-157); Fortsetzen und Korrigieren binden LT-4 bis LT-6.
 */
import { useCallback, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { MatchIcons } from '../../ui/IconsMatch';
import { ThumbBar, type ThumbBarRolle, type ThumbBarSlot } from '../../ui/molecules/ThumbBar';
import { useUndoGuard } from '../hooks/useUndoGuard';
import type { CockpitPhase } from '../model/cockpitPhase';
import type { CockpitControls } from '../model/cockpitTypes';
import { istApple } from '../model/plattform';
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
  fieldName: string;
  steuerung?: LiveCockpitLeisteProps['steuerung'];
  controls: CockpitControls;
  /** „Weiter“ nach dem Abpfiff: das nächste Spiel des Felds (@SL-162). */
  onWeiterNaechstes: () => void;
  onChooseTiebreak?: (wahl: TiebreakWahl) => void;
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
  const [entscheidungOffen, setEntscheidungOffen] = useState(false);
  const onUndo = controls.onUndo;
  const rueckgaengig = useUndoGuard(useCallback(async () => { onUndo?.(); }, [onUndo]));

  // PR 3: Fortsetzen (LT-6) und Korrigieren (LT-5) sind noch nicht gebunden.
  const modell = leisteFuer(phase, { layout, istLeitung, fortsetzenMoeglich: false, korrigierenMoeglich: false });
  if (modell.aktionen.length === 0) { return null; }

  if (!kannSteuern) {
    return (
      <div style={klebtUnten}>
        <NurLesenLeiste
          fieldName={p.fieldName} steuerung={p.steuerung} mitEreignissen={modell.aktionen.includes('ereignisse')}
          onEreignisse={controls.onEventLog} onMehr={controls.onMore}
        />
      </div>
    );
  }

  const aktion = (label: string, testId: string, rolle: ThumbBarRolle, onPress: () => void, icon: ReactElement, extra: Partial<Extract<ThumbBarSlot, { art: 'aktion' }>> = {}): ThumbBarSlot => (
    { art: 'aktion', label, icon, onPress, rolle, testId, ...extra }
  );
  const leertaste = { text: t('leiste.tasteLeertaste'), aria: 'Space' };
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
        const taste = { text: istApple(plattformName()) ? t('leiste.tasteRueckgaengigCmd') : t('leiste.tasteRueckgaengigStrg'), aria: 'Control+Z Meta+Z' };
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
      case 'fortsetzen':
      case 'korrigieren':
        return null;
    }
  };
  const slots = modell.aktionen.map(slotFuer).filter((s): s is ThumbBarSlot => s !== null);
  const hinweis = modell.hinweis === 'beendetHelfer'
    ? { text: t('leiste.beendet'), testId: 'bar-finished' }
    : controls.undoHint ? { text: controls.undoHint, testId: 'match-undo-hint' } : undefined;

  return (
    <div style={klebtUnten}>
      <ThumbBar ariaLabel={t('leiste.aria')} slots={slots} layout={layout} hinweis={hinweis} />
      <TiebreakChoiceSheet
        isOpen={entscheidungOffen}
        onClose={() => { setEntscheidungOffen(false); }}
        onWaehle={(wahl) => { setEntscheidungOffen(false); p.onChooseTiebreak?.(wahl); }}
      />
    </div>
  );
}
