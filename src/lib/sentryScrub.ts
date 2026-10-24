/**
 * Adressen für Sentry unkenntlich machen (A-17b, Review #335 M-2). Die App nutzt `HashRouter`: Jede Adresse im Ereignis und in
 * den Navigations-Breadcrumbs enthält den Hash, also auch `/join/<Helfer-Code>` und `?token=`. Der Code ist kein Zugang (S-1),
 * öffnet aber den Weg zu einer Anfrage; ein Einladungs-Token öffnet mehr. Beides wird auf `***` gekürzt, alles andere bleibt.
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/react';

const JOIN_CODE = /(\/join\/)[^/?#\s&]+/gi;
const TOKEN_PARAM = /([?&#]token=)[^&#\s]*/gi;

/** `/join/ABCDEFGH23` → `/join/***`, `token=abc` → `token=***`; jede andere Adresse bleibt unverändert. */
export function scrubUrl(value: string): string {
  return value.replace(JOIN_CODE, '$1***').replace(TOKEN_PARAM, '$1***');
}

function scrubData(data: Record<string, unknown> | undefined): void {
  if (!data) {
    return;
  }
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      data[key] = scrubUrl(value);
    }
  }
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.message) {
    breadcrumb.message = scrubUrl(breadcrumb.message);
  }
  scrubData(breadcrumb.data);
  return breadcrumb;
}

export function scrubEventUrls(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url);
  }
  if (event.transaction) {
    event.transaction = scrubUrl(event.transaction);
  }
  event.breadcrumbs?.forEach((breadcrumb) => scrubBreadcrumb(breadcrumb));
  return event;
}
