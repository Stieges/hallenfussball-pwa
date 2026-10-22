/**
 * useCockpitFieldControl (B-49): Steuer je Feld im Cockpit (Befund C-HELFER-FELD-OHNE-SPERRE).
 *
 * - Ein anderes Gerät steuert das Feld → dieses Gerät ist nur lesend (`kannSteuern = false`) und zeigt „Feld 2 wird von Tom
 *   gesteuert“ (@FU-026, @FU-030); hatte es die Steuer eben noch selbst, „Die Spielleitung hat jetzt Olli“ (@FU-027).
 * - „Spielleitung übernehmen“ mit Rückfrage: die Turnierleitung (`leadMatches`) jederzeit (@FU-027, @SL-046), ein Helfer nur, wenn
 *   auf dem Feld gerade kein Spiel läuft (@FU-120, Daniel 22.10.). Nie von selbst: ein fremd gesteuertes Feld ist nur lesend, es gibt
 *   dort keinen Anpfiff. Ohne Netz: „Übernehmen geht nur mit Netz“ (@FU-028).
 * - Nach einer Übernahme mitten im Spiel: Hinweis „Spielzeit beruht auf Toms Gerät – bitte prüfen“ (@SL-015, @FU-111), bis das
 *   Feld ein anderes Spiel zeigt. Übernahme kurz nach dem Abpfiff: der Rest der 30 Sekunden Endstand kommt aus `finishedAt`
 *   (`useEndstandHalten`, @SL-116), hier nichts Eigenes.
 * - Feldwahl: je Feld der Halter (@HE-049 „Feld 2: Tom (Handy)“, eigenes Gerät „dieses Gerät“).
 * - Steuert dieses Gerät das Feld, tragen die Einträge des aktuellen Spiels die Epoche (`controlEpochs`, Brief A-34 L7).
 * Ohne bekannten Stand (Gast, ohne Netz seit dem Öffnen) sperrt nichts; der Server lehnt fremde Einträge ab (NOT_CONTROLLER).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fieldControlView, mayControlField, type FieldControlView } from '../../../core/fieldControl/fieldControlView';
import { setControlEpoch } from '../../../core/fieldControl/controlEpochs';
import type { LiveMatch } from '../../../components/live-cockpit/types';
import type { LiveCockpitLeisteProps } from '../../../components/live-cockpit/typesLeiste';
import { fieldHolderText } from '../../match-engine/fieldHolderText';
import { useFieldControl } from '../../match-engine/useFieldControl';
import { useTakeoverDialog } from '../../match-engine/useTakeoverDialog';

export interface CockpitFieldControlInput {
  tournamentId: string;
  feld: number;
  feldName: string;
  /** Recht auf den Spielbetrieb (`writeMatchData`). */
  canPlay: boolean;
  /** Turnierleitung (`leadMatches`): übernimmt jederzeit (@FU-027). */
  istLeitung: boolean;
  /**
   * Läuft auf dem Feld gerade ein Spiel (laufend, pausiert, Abschnittspause, Verlängerung, Strafstoßschießen, Entscheidung offen)?
   * Dann übernimmt nur die Turnierleitung; sonst auch ein Helfer, ausdrücklich mit Rückfrage (@FU-120, Daniel 22.10.).
   */
  feldLaeuft: boolean;
  currentMatch: LiveMatch | null;
}

export interface CockpitFieldControl {
  kannSteuern: boolean;
  steuerung: LiveCockpitLeisteProps['steuerung'];
  /** Vorgänger nach einer Übernahme im laufenden Spiel (`''` = ohne Namen), sonst `null`. */
  uebernahmeVon: string | null;
  halter: Readonly<Record<number, string>>;
  dialog: ReactNode;
}

interface Spur { tournamentId: string; feld: number; kind: FieldControlView['kind']; verlorenEpoch: number | null }

/** Laufend aus Sicht der Steuer: `RUNNING`, sowie `PAUSED` (= paused, section_break, decision_pending, shootout, `viewAdapters.mapStatus`). */
const LAUFEND: ReadonlySet<LiveMatch['status']> = new Set(['RUNNING', 'PAUSED']);

/** Läuft eines der Spiele des Felds gerade (@FU-120)? */
export function laeuftAufFeld(matchIds: readonly string[], liveMatches: ReadonlyMap<string, Pick<LiveMatch, 'status'>>): boolean {
  return matchIds.some((id) => {
    const status = liveMatches.get(id)?.status;
    return status !== undefined && LAUFEND.has(status);
  });
}

export function useCockpitFieldControl(input: CockpitFieldControlInput): CockpitFieldControl {
  const { tournamentId, feld, feldName, canPlay, istLeitung, feldLaeuft, currentMatch } = input;
  const { t } = useTranslation('cockpit');
  const fc = useFieldControl(tournamentId);
  const view = fieldControlView(fc.list, feld);
  const { open: openTakeover, dialog } = useTakeoverDialog(fc.takeOver);

  // „Die Spielleitung hat jetzt Olli“: dieses Gerät steuerte das Feld, jetzt ein anderes (gleiche Epoche wie beim Verlust)
  const [spur, setSpur] = useState<Spur>({ tournamentId, feld, kind: view.kind, verlorenEpoch: null });
  if (spur.tournamentId !== tournamentId || spur.feld !== feld || spur.kind !== view.kind) {
    const gleichesFeld = spur.tournamentId === tournamentId && spur.feld === feld;
    const eben = gleichesFeld && spur.kind === 'mine' && view.kind === 'foreign' ? view.epoch : null;
    setSpur({ tournamentId, feld, kind: view.kind, verlorenEpoch: eben ?? (gleichesFeld && view.kind === 'foreign' ? spur.verlorenEpoch : null) });
  }
  const verloren = view.kind === 'foreign' && spur.verlorenEpoch === view.epoch;

  const [uebernahme, setUebernahme] = useState<{ matchId: string; name: string } | null>(null);

  // Brief A-34 L7: Einträge dieses Spiels tragen die Epoche, solange dieses Gerät das Feld steuert (sonst null)
  const matchId = currentMatch?.id ?? null;
  const eigeneEpoche = view.kind === 'mine' ? view.epoch : null;
  useEffect(() => {
    if (matchId === null) { return undefined; }
    setControlEpoch(matchId, eigeneEpoche);
    return () => { setControlEpoch(matchId, null); };
  }, [matchId, eigeneEpoche]);

  const steuerung = useMemo<LiveCockpitLeisteProps['steuerung']>(() => {
    if (view.kind !== 'foreign') {
      return null;
    }
    const halter = fieldHolderText(view.info);
    const match = currentMatch;
    // @FU-027: die Turnierleitung jederzeit; @FU-120: ein Helfer nur, wenn auf dem Feld kein Spiel läuft (immer mit Rückfrage)
    const onUebernehmen = canPlay && (istLeitung || !feldLaeuft)
      ? () => {
        openTakeover({
          field: feld, feldName, epoch: view.epoch, halter,
          onTaken: (result) => {
            if (result.kind === 'taken' && result.previous && match && LAUFEND.has(match.status)) {
              setUebernahme({ matchId: match.id, name: result.previous.holderName?.trim() ?? '' });
            }
          },
        });
      }
      : undefined;
    return { leitetName: halter, verloren, ...(onUebernehmen ? { onUebernehmen } : {}) };
  }, [view, verloren, istLeitung, feldLaeuft, canPlay, openTakeover, feld, feldName, currentMatch]);

  const halter = useMemo(() => {
    const map: Record<number, string> = {};
    for (const info of fc.list ?? []) {
      const v = fieldControlView(fc.list, info.field);
      if (v.kind === 'mine') { map[info.field] = ''; }
      if (v.kind === 'foreign') { map[info.field] = fieldHolderText(v.info) ?? t('steuer.anderesGeraet'); }
    }
    return map;
  }, [fc.list, t]);

  return {
    kannSteuern: canPlay && mayControlField(view),
    steuerung,
    uebernahmeVon: uebernahme !== null && uebernahme.matchId === currentMatch?.id && view.kind === 'mine' ? uebernahme.name : null,
    halter,
    dialog,
  };
}
