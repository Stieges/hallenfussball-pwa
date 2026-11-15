/**
 * Versandweg der Zuschauer-Zählung (@RZ-026, @RZ-027): ein einfacher POST an die Server-Funktion `count_public_view`, nicht über den
 * Supabase-Client – so liest und schreibt die Zählung weder Sitzung noch Speicher des Geräts, löst keine Anmeldung aus und kommt nie
 * in die Offline-Warteschlange. Ohne Supabase (lokaler Modus) gibt es keinen Weg: die Zählung tut dann nichts.
 */
import { supabaseProjectUrl, supabasePublicKey } from '../../lib/supabase';
import type { ViewCountTransport } from '../../core/viewCount/publicViewCount';

export function createFetchViewCountTransport(baseUrl: string, publicKey: string): ViewCountTransport {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: publicKey };
  // Ein JWT-förmiger Schlüssel geht zusätzlich als Bearer mit; neue Schlüssel (sb_publishable_…) gehen nur als apikey.
  if (publicKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${publicKey}`;
  }
  return (args, signal) =>
    fetch(`${baseUrl.replace(/\/+$/, '')}/rest/v1/rpc/count_public_view`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      signal,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
}

/** Adresse und öffentlicher Schlüssel des Projekts; `null`, wenn Supabase nicht eingerichtet ist (oder die Einstellung nicht lesbar ist). */
function readProjectConfig(): { url: string; key: string } | null {
  try {
    const url = supabaseProjectUrl;
    const key = supabasePublicKey;
    return url !== undefined && url !== '' && key !== undefined && key !== '' ? { url, key } : null;
  } catch {
    return null;
  }
}

/**
 * Der Weg dieser App. Die Einstellung wird erst beim Senden gelesen: ohne Supabase (lokaler Modus) geschieht nichts, und ein
 * fehlender Eintrag darf die Seite nie beim Laden stören.
 */
export const defaultViewCountTransport: ViewCountTransport = (args, signal) => {
  const config = readProjectConfig();
  return config === null ? Promise.resolve(null) : createFetchViewCountTransport(config.url, config.key)(args, signal);
};
