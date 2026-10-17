import { useCallback, useEffect, useState } from 'react';
import type { OffenerEintrag } from '../model/cockpitTypes';

export interface UseEntryFlowsReturn {
  offen: OffenerEintrag | null;
  oeffne: (eintrag: OffenerEintrag) => void;
  schliesse: () => void;
}

/** Spec § 4.3: ersetzt die sieben Dialog-useState der Hülle. Reset NUR an der Spiel-ID (C1, RC13/PC20). */
export function useEntryFlows(matchId: string | undefined): UseEntryFlowsReturn {
  const [offen, setOffen] = useState<OffenerEintrag | null>(null);
  useEffect(() => { setOffen(null); }, [matchId]);
  const oeffne = useCallback((eintrag: OffenerEintrag) => { setOffen(eintrag); }, []);
  const schliesse = useCallback(() => { setOffen(null); }, []);
  return { offen, oeffne, schliesse };
}
