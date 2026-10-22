/**
 * useCockpitFieldControl (B-49): Steuer je Feld im Cockpit (Befund C-HELFER-FELD-OHNE-SPERRE).
 *
 * - Ein anderes Gerät steuert das Feld → dieses Gerät ist nur lesend (`kannSteuern = false`) und zeigt „Feld 2 wird von Tom
 *   gesteuert“ (@FU-026, @FU-030); hatte es die Steuer eben noch selbst, „Die Spielleitung hat jetzt Olli“ (@FU-027).
 * - Die Turnierleitung (`leadMatches`) bekommt dazu „Spielleitung übernehmen“ mit Rückfrage (@FU-027, @SL-046); Helfer nicht
 *   (Übernehmen erst nach 30 s Funkstille ist @FU-032, MVP+). Ohne Netz: „Übernehmen geht nur mit Netz“ (@FU-028).
 * - Nach einer Übernahme mitten im Spiel: Hinweis „Spielzeit beruht auf Toms Gerät – bitte prüfen“ (@SL-015, @FU-111), bis das
 *   Feld ein anderes Spiel zeigt. Übernahme kurz nach dem Abpfiff: der Rest der 30 Sekunden Endstand kommt aus `finishedAt`
 *   (`useEndstandHalten`, @SL-116), hier nichts Eigenes.
 * - Feldwahl: je Feld der Halter (@HE-049 „Feld 2: Tom (Handy)“, eigenes Gerät „dieses Gerät“).
 * Ohne bekannten Stand (Gast, ohne Netz seit dem Öffnen) sperrt nichts; der Server lehnt fremde Einträge ab (NOT_CONTROLLER).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fieldControlView, mayControlField, type FieldControlView } from '../../../core/fieldControl/fieldControlView';
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
  /** Turnierleitung (`leadMatches`): nur sie übernimmt ein gesteuertes Feld. */
  istLeitung: boolean;
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

const LAUFEND: ReadonlySet<LiveMatch['status']> = new Set(['RUNNING', 'PAUSED']);

export function useCockpitFieldControl(input: CockpitFieldControlInput): CockpitFieldControl {
  const { tournamentId, feld, feldName, canPlay, istLeitung, currentMatch } = input;
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

  const steuerung = useMemo<LiveCockpitLeisteProps['steuerung']>(() => {
    if (view.kind !== 'foreign') {
      return null;
    }
    const halter = fieldHolderText(view.info);
    const match = currentMatch;
    const onUebernehmen = istLeitung && canPlay
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
  }, [view, verloren, istLeitung, canPlay, openTakeover, feld, feldName, currentMatch]);

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
