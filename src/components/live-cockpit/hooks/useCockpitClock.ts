/**
 * useCockpitClock (B-08b/c): die Uhr- und Abschnittsbefehle der Cockpit-Hülle an einer Stelle – Befehle
 * (`useEngineClockCommands`), Abschnittsende und Abpfiff von selbst (`useAutoSectionEnd`), Ton und Vibration
 * (`useWhistle`, einzige Quelle) und der Wiederanpfiff. Die Hülle verdrahtet nur noch das Ergebnis.
 *
 * Regel 3 Hallenton (H3b-3, @HT-009, @HT-033 Zeilen 2, 9, 10, 11): Der Ton gilt nur, wenn `soundEnabled` und der
 * Hallen-Lautsprecher dieses Geräts für das Feld nicht bereit ist oder seine letzte Antwort des Servers älter als 5 s ist
 * (`cockpitTonSchweigtJetzt` mit der Serverzeit des Ton-Anlasses, jedes Mal neu gelesen; im Zweifel tönt das Cockpit). Die Vibration bleibt, ebenso der Ton des Abzeichens und die Testtöne im Cockpit (andere Wege).
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEngineClockCommands } from '../../../hooks/useEngineClockCommands';
import { useMatchEngineContextOptional } from '../../../features/match-engine/useMatchEngineContext';
import { cockpitTonSchweigtJetzt } from '../../../features/hallenton/cockpitTon';
import type { MatchCockpitSettings } from '../../../types/tournament';
import type { PhaseView } from '../../../core/match/client/phaseView';
import type { LiveMatch } from '../types';
import { useAutoSectionEnd, type SectionEnded } from './useAutoSectionEnd';
import { useWhistle } from './useWhistle';
import type { NoticeKennung } from './useCockpitNotices';

export interface CockpitClockArgs {
  tournamentId: string;
  match: Pick<LiveMatch, 'id' | 'homeTeam' | 'awayTeam'> & Partial<Pick<LiveMatch, 'fieldId'>> | null;
  readOnly: boolean;
  settings: Pick<MatchCockpitSettings, 'soundEnabled' | 'hapticEnabled'>;
  playSound: () => void;
  /** Engine-Ansicht des Spiels (`null` ohne Engine-Kopie). */
  engineView: PhaseView | null;
  /** Meldezeile: Stufe 3 = Bestätigung, Stufe 2 = Fehler. */
  melde: (stufe: 2 | 3, text: string, kennung?: NoticeKennung) => void;
}

export interface CockpitClock {
  /** `section_break`: die Taste „Weiter“ ist der Wiederanpfiff. */
  abschnittspause: boolean;
  wiederanpfiff: () => void;
  /** Ein Abpfiff von Hand ist gesendet: Ton und Vibration. */
  abgepfiffenVonHand: (eventId: string | null) => void;
  /** Uhr auf `clockMs` stellen (B-08d, CLOCK_ADJUST); `previousClockMs` ist der bisherige Stand. */
  korrigiereUhr: (clockMs: number, previousClockMs: number) => Promise<string | null>;
  /** „Spiel fortsetzen“ nach dem Abpfiff (LT-6, REOPEN): Uhr läuft ab `clockMs` weiter. */
  fortsetzen: (clockMs: number) => Promise<string | null>;
}

export function useCockpitClock(args: CockpitClockArgs): CockpitClock {
  const { tournamentId, match, readOnly, settings, playSound, engineView, melde } = args;
  const { t } = useTranslation('cockpit');
  const engine = useMatchEngineContextOptional()?.engine ?? null;
  const serverNow = useCallback(() => (engine ? engine.serverNow() : Date.now()), [engine]);
  const onError = useCallback((text: string) => { melde(2, text); }, [melde]);
  const commands = useEngineClockCommands({ tournamentId, match, onError });
  const feldId = match?.fieldId ?? null;
  const tonAnlass = useCallback(() => {
    if (!cockpitTonSchweigtJetzt(tournamentId, feldId, serverNow())) {
      playSound();
    }
  }, [tournamentId, feldId, playSound, serverNow]);
  const whistle = useWhistle({ soundEnabled: settings.soundEnabled, hapticEnabled: settings.hapticEnabled, play: tonAnlass });

  const onEnded = useCallback((ended: SectionEnded) => {
    whistle.pfeife(ended.eventId, ended.kind === 'match' ? 'spiel' : 'abschnitt');
    if (ended.kind === 'match' && ended.eventId !== null) {
      melde(3, t('meldung.abgepfiffen'), 'abgepfiffen');
    }
  }, [whistle, melde, t]);
  useAutoSectionEnd({
    matchId: match?.id ?? null, view: engineView, enabled: !readOnly, serverNow, commands, onEnded,
  });

  const wiederanpfiff = useCallback(() => {
    void commands.startSection().then((id) => { if (id !== null) { melde(3, t('meldung.wiederangepfiffen')); } });
  }, [commands, melde, t]);
  const abgepfiffenVonHand = useCallback((eventId: string | null) => { whistle.pfeife(eventId, 'spiel'); }, [whistle]);

  return {
    abschnittspause: engineView?.status === 'section_break', wiederanpfiff, abgepfiffenVonHand,
    korrigiereUhr: commands.adjustClock,
    fortsetzen: commands.reopen,
  };
}
