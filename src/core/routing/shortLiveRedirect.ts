/**
 * Kurze Zuschauer-Adresse (@ZM-208): Die Monitor-Folie „Zuschauer-QR“ zeigt `host/live/CODE`, weil man „#/“ am Handy nur mühsam tippt.
 * Die App routet per Hash (`HashRouter`); `vercel.json` und der Service Worker liefern `/live/CODE` an `index.html` aus. Beim Start führt diese
 * Weiche genau diese eine Route auf `/#/live/CODE` (mit Suche) um. Alles andere bleibt unberührt: andere Pfade, Adressen mit Hash-Route
 * (der QR-Code trägt weiter die Hash-Adresse) und der Auth-Callback. Reine Funktion, kein React.
 */
const SHORT_LIVE = /^\/live\/([A-Za-z0-9]+)\/?$/;

/** Ziel der Umleitung (relativ zum Ursprung) oder `null`, wenn nichts umzuleiten ist. */
export function shortLiveTarget(pathname: string, search: string, hash: string): string | null {
  if (hash.startsWith('#/')) { return null; }
  const match = SHORT_LIVE.exec(pathname);
  return match === null ? null : `/#/live/${match[1]}${search}`;
}
