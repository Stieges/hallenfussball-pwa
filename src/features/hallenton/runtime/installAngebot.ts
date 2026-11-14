/**
 * Angebot „App installieren“ (H4-9, @HT-043): der Browser meldet `beforeinstallprompt` nur einmal und früh. Solange der Unterpunkt „Hallenton“
 * offen ist (`starteInstallAngebot()` beim Einhängen, das Ergebnis beim Aushängen aufrufen), hört die App darauf, hält das Ereignis fest und
 * hält das browsereigene Angebot zurück (`preventDefault`), damit die Taste im Schritt „App installieren“ es öffnen kann. Auf allen anderen
 * Seiten fasst die App das Ereignis nicht an: das Verhalten des Browsers bleibt unverändert. Kam das Ereignis schon vorher, bleibt die Taste weg
 * und der Schritt erklärt den Menüweg (wie bei Safari). Als Speicher für `useSyncExternalStore`: `abonniereInstallAngebot`, `installAngebotVorhanden`.
 */
interface InstallEreignis extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const hoerer = new Set<() => void>();
let ereignis: InstallEreignis | null = null;

function melden(): void {
  for (const fn of [...hoerer]) {
    fn();
  }
}

/** Beginnt zu lauschen (nur solange der Unterpunkt offen ist); gibt die Funktion zurück, die wieder aufhört. */
export function starteInstallAngebot(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const beiAngebot = (e: Event): void => {
    e.preventDefault(); // ohne das öffnet der Browser sein eigenes Angebot sofort; so kommt es erst auf unsere Taste
    ereignis = e as InstallEreignis;
    melden();
  };
  const beiInstalliert = (): void => {
    ereignis = null;
    melden();
  };
  window.addEventListener('beforeinstallprompt', beiAngebot);
  window.addEventListener('appinstalled', beiInstalliert);
  return () => {
    window.removeEventListener('beforeinstallprompt', beiAngebot);
    window.removeEventListener('appinstalled', beiInstalliert);
  };
}

export function abonniereInstallAngebot(fn: () => void): () => void {
  hoerer.add(fn);
  return () => {
    hoerer.delete(fn);
  };
}

export function installAngebotVorhanden(): boolean {
  return ereignis !== null;
}

/** Öffnet den Dialog des Browsers; das Angebot gilt nur einmal. Nichts wirft. */
export async function installiereApp(): Promise<void> {
  const aktuell = ereignis;
  if (aktuell === null) {
    return;
  }
  ereignis = null;
  melden();
  try {
    await aktuell.prompt();
    await aktuell.userChoice;
  } catch {
    // Browser lehnt ab: der Nutzer installiert über das Browser-Menü
  }
}

/** Nur für Tests. */
export function __setzeInstallAngebotFuerTests(neu: InstallEreignis | null = null): void {
  ereignis = neu;
  hoerer.clear();
}
