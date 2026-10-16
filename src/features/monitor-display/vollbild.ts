/**
 * Vollbild der Monitor-Seite über alle Browser (B-17 Fixrunde 2): zuerst die unpräfixierte API, sonst die
 * webkit-Variante (Safari vor 16.4), sonst nichts. Fehlt beides oder verweigert der Browser es, wirft nichts;
 * die Seite bleibt dann im Fenster.
 */

type VollbildElement = HTMLElement & { webkitRequestFullscreen?: () => unknown };
type VollbildDokument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => unknown;
};

/** Ruft den Browser-Aufruf ab, ohne dass ein Fehler oder ein abgelehntes Versprechen durchschlägt. */
function ausfuehren(aufruf: () => unknown): void {
  try {
    const ergebnis = aufruf();
    if (ergebnis instanceof Promise) { ergebnis.catch(() => undefined); }
  } catch {
    // Vollbild nicht erlaubt (z. B. ohne Nutzergeste): die Seite bleibt, wie sie ist.
  }
}

export function istImVollbild(doc: VollbildDokument = document): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function vollbildAnfordern(el: VollbildElement = document.documentElement): void {
  if (typeof el.requestFullscreen === 'function') {
    ausfuehren(() => el.requestFullscreen());
    return;
  }
  const webkit = el.webkitRequestFullscreen;
  if (typeof webkit === 'function') {
    ausfuehren(() => webkit.call(el));
  }
}

export function vollbildUmschalten(doc: VollbildDokument = document): void {
  if (istImVollbild(doc)) {
    if (typeof doc.exitFullscreen === 'function') {
      ausfuehren(() => doc.exitFullscreen());
      return;
    }
    const ende = doc.webkitExitFullscreen;
    if (typeof ende === 'function') {
      ausfuehren(() => ende.call(doc));
    }
    return;
  }
  vollbildAnfordern(doc.documentElement);
}
