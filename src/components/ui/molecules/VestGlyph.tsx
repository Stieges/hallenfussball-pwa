import type { ReactElement } from 'react';

/** Leibchen-Zeichen (Weste, Mockup `#i-vest`): im Ergebniskasten (`ScoreBox`) und in der Farbfläche des Profils „Halle (sehr fern)“. */
export function VestGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M9 3a3 3 0 0 0 6 0l6 3-2 5-3-1.2V21H8V9.8L5 11 3 6z" />
    </svg>
  );
}
