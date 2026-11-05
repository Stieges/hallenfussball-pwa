/**
 * Build-Prüfung der Betreiberangaben (@RE-004): Ist ein Pflichtfeld in `src/config/legal.ts` leer oder noch ein Platzhalter
 * in eckigen Klammern, soll kein Platzhalter veröffentlicht werden.
 *
 * - Produktions-Build (Umgebungsvariable `LEGAL_REQUIRE_COMPLETE=1`, nur dort gesetzt, z. B. in Vercel "Production"): Build bricht ab.
 * - Alle anderen Builds (CI, Vorschau, lokal, Tests): nur Warnung, damit nichts rot wird, bis der Betreiber seine Angaben einträgt.
 */
import type { Plugin } from 'vite';
import { LEGAL_CONFIG, getUnfilledPlaceholders, type LegalConfig } from '../../src/config/legal';

export const LEGAL_STRICT_ENV = 'LEGAL_REQUIRE_COMPLETE';

interface LegalCheckOptions {
  /** Standard: `LEGAL_REQUIRE_COMPLETE=1` */
  strict?: boolean;
  /** Standard: die echte Betreiber-Konfiguration */
  config?: LegalConfig;
}

export function legalCheckPlugin(options: LegalCheckOptions = {}): Plugin {
  const strict = options.strict ?? process.env[LEGAL_STRICT_ENV] === '1';
  const config = options.config ?? LEGAL_CONFIG;
  return {
    name: 'legal-config-check',
    apply: 'build',
    buildStart() {
      const unfilled = getUnfilledPlaceholders(config);
      if (unfilled.length === 0) {
        return;
      }
      const message =
        `Betreiberangaben unvollständig (src/config/legal.ts): ${unfilled.join(', ')}. ` +
        'Impressum und Datenschutzerklärung würden Platzhalter zeigen.';
      if (strict) {
        this.error(message);
      } else {
        this.warn(`${message} Nur Warnung; im Produktions-Build (${LEGAL_STRICT_ENV}=1) bricht der Bau hier ab.`);
      }
    },
  };
}
