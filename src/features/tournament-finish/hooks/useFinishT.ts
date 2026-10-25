/**
 * `t` mit Namensraum im Schlüssel (`tournament:finish.…`, `common:…`) für die reinen Text-Helfer in `model/` – die Schlüssel
 * entstehen dort aus Art und Grund, deshalb ohne Schlüssel-Typbindung (Muster `useLooseT` der Klärungsliste).
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { FinishT } from '../model/finishItems';

export function useFinishT(): FinishT {
  const { t } = useTranslation();
  return useCallback<FinishT>((key, options) => String(t(key as never, options as never)), [t]);
}
