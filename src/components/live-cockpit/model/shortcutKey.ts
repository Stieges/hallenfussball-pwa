/**
 * tasteZuAktion – welche Aktion eine Taste im Cockpit auslöst (Plan Cockpit v2 K1; @SL-153, @SL-154, @SL-141 bis @SL-144, @SL-167).
 *
 * Rein, ohne React. Belegung: Leertaste = Uhr (anhalten, weiterlaufen), `1`/`2` = Tor für das links/rechts **angezeigte** Team,
 * `F`/`J` = Foul links/rechts, Strg/Cmd+Z = Rückgängig, `?` = Übersicht. Den Abpfiff löst keine Taste aus.
 * Regeln: in Eingabefeldern und bei offenem Dialog (jede Rolle, auch die Abpfiff-Rückfrage) wirkt nichts und der Browser behält seine Taste
 * (@SL-142, @SL-144, A4-1). Die Leertaste steuert immer nur die Uhr, auch nach einem Klick auf einen Knopf: `keyup` und gehaltene Taste werden
 * geschluckt, damit kein fokussierter Knopf auslöst (@SL-154, @SL-143). Einzige Ausnahme ist „Abpfiff halten“ mit Tastatur-Fokus
 * (`:focus-visible`): dort entscheidet der Halteknopf selbst, ein kurzer Druck tut nichts (@SL-167, A4-2). Strg/Cmd/Alt/AltGr mit
 * anderen Tasten bleiben dem Browser (Cmd+1 wechselt den Tab, AltGr+Q ist „@“).
 */
export type KurzAktion = 'uhr' | 'torLinks' | 'torRechts' | 'foulLinks' | 'foulRechts' | 'rueckgaengig' | 'uebersicht';

export interface TastenLage {
  /** Ziel ist `input`, `textarea`, `select` oder `contenteditable`. */
  istEingabe: boolean;
  /** Irgendein modaler Dialog ist offen (jede Rolle, `istModalerDialogOffen`). */
  dialogOffen: boolean;
  /** Der Fokus liegt per Tastatur (`:focus-visible`) auf „Abpfiff halten“. */
  halteFokus: boolean;
}

export interface TastenEreignis {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  type: 'keydown' | 'keyup';
}

export interface TastenErgebnis { aktion: KurzAktion | null; verhindern: boolean }

const NICHTS: TastenErgebnis = { aktion: null, verhindern: false };
const NUR_VERHINDERN: TastenErgebnis = { aktion: null, verhindern: true };

const EINZELTASTEN: Readonly<Record<string, KurzAktion>> = {
  '1': 'torLinks', '2': 'torRechts', f: 'foulLinks', j: 'foulRechts', '?': 'uebersicht',
};

export function tasteZuAktion(e: TastenEreignis, lage: TastenLage): TastenErgebnis {
  if (e.isComposing || lage.istEingabe || lage.dialogOffen) { return NICHTS; }
  const taste = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const befehl = e.ctrlKey || e.metaKey;
  if (befehl) {
    // Nur Strg/Cmd+Z; alles andere (Cmd+1, Strg+Q, Umschalt+Strg+Z) bleibt dem Browser, kein `preventDefault`
    if (taste !== 'z' || e.shiftKey || e.altKey || e.type !== 'keydown') { return NICHTS; }
    return e.repeat ? NUR_VERHINDERN : { aktion: 'rueckgaengig', verhindern: true };
  }
  if (e.altKey) { return NICHTS; } // AltGr+Q = „@“
  if (e.key === ' ') {
    if (lage.halteFokus) { return NICHTS; }
    return e.type === 'keydown' && !e.repeat ? { aktion: 'uhr', verhindern: true } : NUR_VERHINDERN;
  }
  if (e.type !== 'keydown' || e.repeat) { return NICHTS; }
  const aktion = EINZELTASTEN[taste];
  return aktion === undefined ? NICHTS : { aktion, verhindern: true };
}
