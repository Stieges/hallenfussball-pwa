import { createContext } from 'react';

/** Kontext fuer `resyncNow` (Brief A8). Ohne Provider ist die Funktion eine No-op. */
export const ResyncNowContext = createContext<() => Promise<void>>(() => Promise.resolve());
