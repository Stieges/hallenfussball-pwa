/**
 * NextMatchArea – bindet die Zeile „Nächstes“ an das nächste Spiel, die Trikotfarben und die Vorwarnung (Plan LT-3).
 *
 * Löst das alte Banner „Nächstes →“ ab (Befunde C-COCKPIT-NAECHSTES-WIE-FEHLER, C-COCKPIT-VORWARNUNG-VERLOREN): die Zeile steht im
 * Fluss unter der Tafel und verdeckt Uhr und Stand nie. Das Leibchen-Zeichen kommt aus `kitConflictWithLuminance` (Grenzen `KIT_SIMILAR_DELTA_E` und `KIT_SIMILAR_LUMINANCE_RATIO`,
 * keine eigene Rechnung, @SL-160). Die Vorwarnung rechnet `vorwarnungAktiv`; geblinkt wird je Spiel einmal beim ersten Aktivwerden und nie
 * bei „Bewegung reduzieren“ (@SL-156).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { kitConflictWithLuminance } from '../../../core/models/kit';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { NextMatchRow } from '../../ui/molecules/NextMatchRow';
import type { CockpitPhase } from '../model/cockpitPhase';
import { vorwarnungAktiv } from '../model/vorwarnung';
import type { MatchSummary } from '../types';

export interface NextMatchAreaProps {
  naechstes: MatchSummary | null;
  phase: CockpitPhase;
  /** Restzeit des ganzen Spiels (`restzeitSpielMs`), `null` ohne Ansicht. */
  restSpielMs: number | null;
  /**
   * Die eine Quelle `data-layout` der Hülle: am Laptop (`breit`) steht die Zeile immer; am Handy und Tablet hochkant (`daumen`) erst ab der
   * Vorwarnung und nach dem Abpfiff – davor bleibt ihr Platz reserviert, die Tasten springen nie (@SL-155, F3 Variante R).
   */
  layout?: 'daumen' | 'breit';
}

export function NextMatchArea({ naechstes, phase, restSpielMs, layout = 'breit' }: NextMatchAreaProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  const reduziert = usePrefersReducedMotion();
  const aktiv = naechstes !== null && vorwarnungAktiv(phase, restSpielMs);
  // Je Spiel einmal: gemerkt wird das erste Aktivwerden (`geblinktFuer`), `blinktNoch` endet mit der Animation (`onBlinkEnde`). Wird die Uhr danach
  // korrigiert (über 3:00 und zurück), startet nichts neu. Ob die Bewegung gezeigt wird, entscheidet allein die Einstellung des Geräts (unten).
  const [geblinktFuer, setGeblinktFuer] = useState<string | null>(null);
  const [blinktNoch, setBlinktNoch] = useState(false);
  const id = naechstes?.id ?? null;
  useEffect(() => {
    if (aktiv && id !== null && geblinktFuer !== id) { setGeblinktFuer(id); setBlinktNoch(true); }
  }, [aktiv, id, geblinktFuer]);

  if (naechstes === null) { return null; }
  const farben = naechstes.farben ?? { home: null, away: null };
  const verborgen = layout === 'daumen' && !aktiv && phase.zustand !== 'abgepfiffen';
  return (
    <NextMatchRow
      label={t('naechstes.label')}
      spielText={t('naechstes.spiel', { nummer: naechstes.number })}
      teams={[{ name: naechstes.homeTeam.name, farbe: farben.home }, { name: naechstes.awayTeam.name, farbe: farben.away }]}
      anstossText={t('naechstes.anstoss', { zeit: naechstes.scheduledKickoff })}
      leibchen={kitConflictWithLuminance(farben.home, farben.away) !== 'none' ? { ariaLabel: t('naechstes.leibchen') } : null}
      modus={aktiv ? 'vorwarnung' : 'normal'}
      blinken={aktiv && !reduziert && blinktNoch && geblinktFuer === id}
      onBlinkEnde={() => setBlinktNoch(false)}
      verborgen={verborgen}
      testId="cockpit-naechstes"
    />
  );
}
