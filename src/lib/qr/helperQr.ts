/**
 * Helfer-QR-Code (A-18a, @HE-001, R-GA5-2): die Adresse, die der QR-Code trägt. Sie führt zum Beitritt `/join/<Code>`
 * (HashRouter, deshalb `/#/join/…`, wie `generateLiveUrl`); der Code hat 10 Zeichen aus `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
 * Rein, ohne Dokument; die Zeichnung des QR-Codes steht in `HelperCodeCard`. Nie eine andere Adresse als die des Beitritts.
 */
export function helperJoinUrl(code: string, baseUrl?: string): string {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- leere Basis soll den Ursprung der App nehmen
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/#/join/${encodeURIComponent(code)}`;
}

/** Kurzadresse zum Abtippen: dieselbe Adresse ohne `https://`. */
export function shortHelperJoinAddress(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
