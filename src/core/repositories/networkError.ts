import { isCloudReadTimeout } from './cloudAdoption';
import { NetworkError, isAbortError } from '../errors';

/**
 * @RE-007: Ist das ein REINER Netzfehler? (Anfrage hat den Server nicht erreicht oder keine Antwort bekommen.)
 * Solche Fehler heilen von selbst (naechster Takt / naechstes Online) und werden nicht an den Fehlerbericht-Dienst gemeldet.
 *
 * Bewusst enger als `isTransientMutationError` (errors.ts): Das zaehlt jede Meldung mit „fetch“/„timeout“ und
 * jeden Status 408/429/5xx als vorlaeufig – fuer die Warteschlange richtig (erneut versuchen), fuer die Meldung falsch
 * (ein Server-Fehler mit Text, z. B. „statement timeout“, muss sichtbar bleiben). Hier gilt nur:
 *  - Abbruch (`isAbortError`) und Zeitueberschreitung des Abrufs (`CloudReadTimeoutError`, Name `TimeoutError`),
 *  - `NetworkError` der App,
 *  - die ganze Meldung ist eine bekannte Browser-Meldung fuer „kein Netz“ (Chrome „Failed to fetch“, Firefox
 *    „NetworkError when attempting to fetch resource.“, Safari „Load failed“), ggf. mit Vorsatz `TypeError: `/`FetchError: `
 *    (so verpackt `@supabase/postgrest-js` den Fetch-Fehler) – VOLLER Vergleich, kein Teilstueck.
 * Traegt irgendeine Ebene einen Fehlercode des Servers (nicht leer), ist es kein Netzfehler. Im Zweifel: melden.
 */
const NETWORK_MESSAGE =
    /^(?:(?:TypeError|FetchError): )?(?:Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|Network request failed|fetch failed)$/i;

const MAX_DEPTH = 4;

function layers(error: unknown): object[] {
    const found: object[] = [];
    let current: unknown = error;
    for (let depth = 0; depth < MAX_DEPTH && current && typeof current === 'object'; depth++) {
        found.push(current);
        const next = current as { originalError?: unknown; cause?: unknown };
        current = next.originalError ?? next.cause;
    }
    return found;
}

export function isPureNetworkError(error: unknown): boolean {
    if (isAbortError(error) || isCloudReadTimeout(error) || error instanceof NetworkError) { return true; }
    const chain = layers(error) as { name?: unknown; message?: unknown; code?: unknown }[];
    const hasServerCode = chain.some((layer) => typeof layer.code === 'string' && layer.code !== '');
    if (hasServerCode) { return false; }
    return chain.some((layer) => layer.name === 'TimeoutError' || (typeof layer.message === 'string' && NETWORK_MESSAGE.test(layer.message)));
}
