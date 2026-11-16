/**
 * HinweisMitTaste – ein Hinweis, dessen lösende Taste in DERSELBEN ZEILE steht (@OB-087, Entscheidung „A ist besser“): Symbol und Text links, die
 * Taste rechtsbündig. Passt sie nicht neben den Text (schmales Handy, langer Text), steht sie rechtsbündig unter dem Text – nie volle Breite, nie
 * über dem Text. Ohne `taste` ist es der Hinweis ohne Aktion im gleichen Kasten (so stehen beide Arten stimmig nebeneinander).
 * Töne: `warn` (Vorgabe, Warnrand 2 px), `ruhig` (Auskunft, 1 px), `fehler`. Text bleibt `textPrimary`; die Taste trägt den Ton über `--hinweis-bedien`
 * (`ArbeitsTaste` mit `imHinweis`). Das Symbol steht immer dabei: Farbe allein trägt keine Bedeutung. `role="status"`, bei `fehler` `role="alert"`.
 */
import type { ReactElement, ReactNode } from 'react';
import styles from './HinweisMitTaste.module.css';

export type HinweisTon = 'warn' | 'ruhig' | 'fehler';

export interface HinweisMitTasteProps {
  symbol: ReactNode;
  titel: ReactNode;
  /** Zweite Zeile (kleiner), z. B. „Grund: …“. */
  zusatz?: ReactNode;
  /** Auf dem kleinen Handy (Fenster ≤ 480 × 700 px) entfällt die zweite Zeile, wo die Taste dasselbe sagt (der Titel bleibt immer ganz stehen). */
  zusatzEntfaelltKlein?: boolean;
  /** Die Taste(n), die das Problem lösen; rechts in der Zeile. Mehrere dürfen umbrechen. */
  taste?: ReactNode;
  ton?: HinweisTon;
  'data-testid'?: string;
}

const TON_KLASSE: Record<HinweisTon, string> = { warn: '', ruhig: ` ${styles.ruhig}`, fehler: ` ${styles.fehler}` };

export function HinweisMitTaste({ symbol, titel, zusatz, zusatzEntfaelltKlein = false, taste, ton = 'warn', 'data-testid': testId }: HinweisMitTasteProps): ReactElement {
  const mitTaste = taste !== undefined && taste !== null;
  return (
    <div
      className={`${styles.hinweis}${TON_KLASSE[ton]}${mitTaste ? ` ${styles.mitTaste}` : ''}`}
      role={ton === 'fehler' ? 'alert' : 'status'} data-ton={ton} data-testid={testId}
    >
      <span className={styles.kopf} data-hinweis="kopf">
        <span className={styles.symbol} aria-hidden="true">{symbol}</span>
        <span className={styles.text}>
          <span className={styles.titel}>{titel}</span>
          {zusatz === undefined ? null : <span className={`${styles.zusatz}${zusatzEntfaelltKlein ? ` ${styles.zusatzEntfaelltKlein}` : ''}`}>{zusatz}</span>}
        </span>
      </span>
      {mitTaste ? <span className={styles.aktion} data-hinweis="aktion">{taste}</span> : null}
    </div>
  );
}
