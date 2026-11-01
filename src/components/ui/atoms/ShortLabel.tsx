/**
 * ShortLabel – Kurzform eines Begriffs mit dem ausgeschriebenen Begriff als Hinweis (@OB-075).
 *
 * Kurzformen („Sp.“, „Pkt.“, „#“, „n. V.“) stehen nur im Kopf einer Tabellenspalte, in einer Ergebniszelle und bei
 * Uhr-Beschriftungen – und dort immer mit dem ausgeschriebenen Begriff: als `title` zum Darüberfahren und als Text nur
 * für Screenreader (die Kurzform selbst ist für sie ausgeblendet, damit „Sp.“ nicht als „Sp“ vorgelesen wird).
 * Beide Texte kommen aus dem Glossar (`short`-Namensraum und `sport`-Namensraum), nie aus dem Code.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SHORT_TERMS, type ShortTerm } from './shortTerms';
import styles from './ShortLabel.module.css';

export interface ShortLabelProps {
  term: ShortTerm;
  testId?: string;
}

export function ShortLabel({ term, testId }: ShortLabelProps): ReactElement {
  const { t } = useTranslation();
  // Die Schlüssel stammen aus SHORT_TERMS (vom Glossar-Gleichlauftest geprüft); die Union aus allen ist für den
  // typisierten `t` zu groß, deshalb als einfache Übersetzungsfunktion.
  const translate = t as (key: string) => string;
  const keys = SHORT_TERMS[term];
  const short = translate(keys.short);
  const long = translate(keys.long);
  return (
    <span title={long} data-testid={testId} data-short-term={term}>
      <span aria-hidden="true">{short}</span>
      <span className={styles.nurVorlesen}>{long}</span>
    </span>
  );
}
