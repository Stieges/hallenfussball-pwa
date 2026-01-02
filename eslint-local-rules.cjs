/**
 * Local ESLint Rules
 *
 * Diese Datei wird von eslint-plugin-local-rules geladen.
 * Alle hier exportierten Rules sind unter dem Präfix "local-rules/" verfügbar.
 *
 * Beispiel: 'local-rules/prefer-css-vars': 'warn'
 */

'use strict';

module.exports = {
  'prefer-css-vars': require('./eslint-rules/prefer-css-vars.cjs'),
  'no-hardcoded-font-styles': require('./eslint-rules/no-hardcoded-font-styles.cjs'),
};
