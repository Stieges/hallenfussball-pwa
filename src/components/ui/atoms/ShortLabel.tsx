/**
 * ShortLabel – Kurzform eines Tabellenkopfs mit dem ausgeschriebenen Begriff als Hinweis (@OB-075).
 *
 * Kurzformen („Sp.“, „Pkt.“, „#“) stehen nur im Kopf einer Tabellenspalte – und dort immer mit dem ausgeschriebenen Begriff.
 * Der Hinweis hat zwei getrennte Wege, damit nichts doppelt vorgelesen wird:
 * - Maus und Touch: `title` an der sichtbaren Kurzform, die selbst für Screenreader ausgeblendet ist (`aria-hidden`; ein `title`
 *   an einem versteckten Element liest kein Screenreader vor).
 * - Screenreader: der ausgeschriebene Begriff als Text nur zum Vorlesen („Spiele“ statt „Sp“).
 * Beide Texte kommen aus dem Glossar (`short`- und `sport`-Namensraum), nie aus dem Code. Die Kurzform der Ergebniszelle
 * („n. V.“) steht nicht hier, sondern in `matchResult.ts` (Text in der Zelle, die Zelle trägt ihre Bedeutung selbst).
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SHORT_TERMS, type TableHeadTerm } from './shortTerms';
import styles from './ShortLabel.module.css';

export interface ShortLabelProps {
  term: TableHeadTerm;
  testId?: string;
}

export function ShortLabel({ term, testId }: ShortLabelProps): ReactElement {
  const { t } = useTranslation();
  // Die Schlüssel stammen aus SHORT_TERMS (vom Gleichlauftest in `src/i18n/__tests__/kurzformen.test.ts` geprüft); die Union aus
  // allen ist für den typisierten `t` zu groß, deshalb als einfache Übersetzungsfunktion.
  const translate = t as (key: string) => string;
  const keys = SHORT_TERMS[term];
  const short = translate(keys.short);
  const long = translate(keys.long);
  return (
    <span data-testid={testId} data-short-term={term}>
      <span aria-hidden="true" title={long}>{short}</span>
      <span className={styles.nurVorlesen}>{long}</span>
    </span>
  );
}
