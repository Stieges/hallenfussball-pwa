/**
 * B-50: `t` mit Namensraum im Schlüssel (`tournament:klaerung.…`, `common:outbox.…`) für die reinen Text-Helfer in
 * `reviewTexts.ts` – die Schlüssel entstehen dort aus Grund und Eintragsart, deshalb ohne Schlüssel-Typbindung.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from './reviewTexts';

export function useLooseT(): TFunction {
  const { t } = useTranslation();
  return useCallback<TFunction>((key, options) => String(t(key as never, options as never)), [t]);
}
