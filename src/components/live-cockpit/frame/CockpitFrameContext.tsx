/**
 * CockpitFrameProvider – hält den Rahmen-Zustand der App (Plan LT-2, @SL-140); Regeln und Hooks in `cockpitFrame.ts`.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { CockpitFrameContext } from './cockpitFrame';

export function CockpitFrameProvider({ children }: { children: ReactNode }) {
  const [vollbild, setVollbild] = useState(false);
  const wert = useMemo(() => ({ vollbild, setVollbild }), [vollbild]);
  return <CockpitFrameContext.Provider value={wert}>{children}</CockpitFrameContext.Provider>;
}
