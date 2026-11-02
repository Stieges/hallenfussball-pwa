/**
 * ESLint-Regel `no-hardcoded-sport-terms` (Synonyme und Kürzel, @OB-075) unter Vitest.
 *
 * Die Fälle stehen in eslint-rules/__tests__/no-hardcoded-sport-terms.test.cjs (ESLint-`RuleTester`, läuft auch mit
 * `node eslint-rules/__tests__/no-hardcoded-sport-terms.test.cjs`). Hier wird die Datei eingebunden, damit `npm test` und die
 * CI sie mitlaufen lassen: der `RuleTester` legt seine Fälle beim Laden als Vitest-Tests an (globales describe/it).
 */
import '../../../eslint-rules/__tests__/no-hardcoded-sport-terms.test.cjs';
