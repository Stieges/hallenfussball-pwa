/**
 * LeerLeiste – Leiste und Einstellungen, wenn das Feld noch kein Spiel zeigen kann (Plan LT-2, Befund C4 aus Review Teil 1).
 *
 * Ohne `currentMatch` kehrt die Hülle früh zurück; ohne diese Leiste gäbe es im Zustand „wartet auf Teams“ (Rahmen aktiv, @SL-140) weder
 * die Zeile `wartetAufHerkunft: mehr` der Tabelle noch „Mehr → Einstellungen“ (Spec § 6). Bewusste Lösung: `wartetAufHerkunft` bekommt
 * die Leiste nur mit „Mehr“ (Einstellungen; Seiten tauschen und Uhr gibt `darfImZustand` hier nicht her). `keinSpiel` bleibt ohne
 * Leiste und ohne Rahmen: die App-Navigation führt zum Reiter „Einstellungen“ des Turniers.
 */
import type { ReactElement } from 'react';
import type { CockpitCommands } from '../hooks/useCockpitCommands';
import type { CockpitPhase } from '../model/cockpitPhase';
import { mehrPunkteGrundgeruest } from '../model/mehrPunkte';
import type { MatchCockpitSettings } from '../../../types/tournament';
import type { LiveCockpitLeisteProps } from '../typesLeiste';
import { SettingsDialog } from '../components';
import { MoreSheet } from './MoreSheet';
import { ThumbBarArea } from './ThumbBarArea';

export interface LeerLeisteProps {
  phase: CockpitPhase;
  layout: 'daumen' | 'breit';
  kannSteuern: boolean;
  istLeitung: boolean;
  fieldName: string;
  steuerung?: LiveCockpitLeisteProps['steuerung'];
  cmd: CockpitCommands;
  settings: MatchCockpitSettings;
  tournamentId: string;
}

export function LeerLeiste(p: LeerLeisteProps): ReactElement {
  const { cmd } = p;
  return (
    <>
      <ThumbBarArea
        phase={p.phase} layout={p.layout} kannSteuern={p.kannSteuern} istLeitung={p.istLeitung} fieldName={p.fieldName}
        steuerung={p.steuerung} controls={cmd.controls} onWeiterNaechstes={() => undefined}
      />
      <MoreSheet
        isOpen={cmd.dialogs.showMore} onClose={cmd.overlayHandlers.closeMore}
        punkte={mehrPunkteGrundgeruest(p.phase, { kannSteuern: p.kannSteuern })} aktionen={cmd.mehrAktionen} tournamentId={p.tournamentId}
      />
      <SettingsDialog
        isOpen={cmd.dialogs.showSettings} onClose={cmd.overlayHandlers.closeSettings} settings={p.settings}
        onChange={cmd.overlayHandlers.changeSettings} tournamentId={p.tournamentId} onTestSound={cmd.overlayHandlers.testSound}
        readOnly={!p.kannSteuern}
      />
    </>
  );
}
