/**
 * Eine Quelle der Schiedsrichter-Auswahl (@W3-011, Befund R3 Review 01.11.): Bearbeiten-Modus (Karten, Finalrunde) und
 * Block „Manuelle Schiedsrichter-Zuweisung“ bieten dieselben Einträge an.
 * - Veranstalter stellt Schiedsrichter: Nummern 1…n, mit Namen, wenn eingetragen.
 * - Teams pfeifen: die Teams des Turniers mit Namen (Nummer = Platz in der Teamliste, wie bei der Zuteilung).
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { RefereeConfig } from '../../types/tournament';

export interface RefereeChoice {
  value: number;
  label: string;
}

interface ChoiceTeam {
  name: string;
  isRemoved?: boolean;
}

type Labels = {
  numbered: (n: number) => string;
  named: (n: number, name: string) => string;
};

export function refereeChoices(config: RefereeConfig | undefined, teams: readonly ChoiceTeam[], labels: Labels): RefereeChoice[] {
  if (!config || config.mode === 'none') { return []; }
  if (config.mode === 'teams') {
    return teams
      .map((team, index) => ({ team, value: index + 1 }))
      .filter(({ team }) => !team.isRemoved)
      .map(({ team, value }) => ({ value, label: team.name }));
  }
  const count = config.numberOfReferees ?? 2;
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const name = config.refereeNames?.[n];
    return { value: n, label: name ? labels.named(n, name) : labels.numbered(n) };
  });
}

/** Auswahl mit übersetzten Beschriftungen („SR 1“ / „Ref 1“). */
export function useRefereeChoices(config: RefereeConfig | undefined, teams: readonly ChoiceTeam[] | undefined): RefereeChoice[] {
  const { t } = useTranslation('tournament');
  return useMemo(() => refereeChoices(config, teams ?? [], {
    numbered: (number) => t('refereeOptions.numbered', { number }),
    named: (number, name) => t('refereeOptions.named', { number, name }),
  }), [config, teams, t]);
}
