/** Gespielter `UseEntryFlowsReturn` für Tests der Bindung: jede Funktion ein `vi.fn()`, `offen` und die Rückfrage vorgebbar. */
import { vi } from 'vitest';
import type { UseEntryFlowsReturn } from '../hooks/useEntryFlows';
import type { OffenerEintrag } from '../model/cockpitTypes';

export function makeFlows(offen: OffenerEintrag | null = null, rueckfrage: { nummer: number } | null = null): UseEntryFlowsReturn {
  return {
    offen, oeffne: vi.fn(), schliesse: vi.fn(), tippeTor: vi.fn(), waehleNummer: vi.fn().mockResolvedValue(undefined),
    schliesseAuswahl: vi.fn().mockResolvedValue(undefined), waehleEigentor: vi.fn().mockResolvedValue(undefined),
    tippeFoul: vi.fn(), tippeZeitstrafe: vi.fn(), tippeKarte: vi.fn(), waehleKartenArt: vi.fn(),
    rueckfrageZweiteGelbe: rueckfrage, antworteZweiteGelbe: vi.fn().mockResolvedValue(undefined),
  };
}
