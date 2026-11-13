/**
 * Angebot „App installieren“ (H4-9, @HT-043): der Browser meldet `beforeinstallprompt` nur einmal und früh. Damit der Unterpunkt „Hallenton“
 * später eine Taste dafür zeigen kann, hört `starteInstallAngebot()` (beim Start der App, aus `HallLautsprecherLaufzeit`) darauf und hält
 * das Ereignis fest. Ohne Ereignis (Safari, schon installiert, Browser bietet es nicht an) bleibt die Taste weg, der Schritt erklärt den Weg.
 * Als Speicher für `useSyncExternalStore`: `abonniereInstallAngebot`, `installAngebotVorhanden`. Reiner Zustand ohne React.
 */
interface InstallEreignis extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const hoerer = new Set<() => void>();
let ereignis: InstallEreignis | null = null;
let gestartet = false;

function melden(): void {
  for (const fn of [...hoerer]) {
    fn();
  }
}

export function starteInstallAngebot(): void {
  if (gestartet || typeof window === 'undefined') {
    return;
  }
  gestartet = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // ohne das öffnet der Browser sein eigenes Angebot sofort; so kommt es erst auf unsere Taste
    ereignis = e as InstallEreignis;
    melden();
  });
  window.addEventListener('appinstalled', () => {
    ereignis = null;
    melden();
  });
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
  gestartet = false;
  hoerer.clear();
}
