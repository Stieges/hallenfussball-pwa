/** Welcher Browser? (für die vorgewählte Anleitung gegen das Schlafenlegen, H4-9, @HT-043). */
export type BrowserArt = 'chrome' | 'edge' | 'safari';

/** Der Browser aus der Kennung (Edge meldet auch „Chrome“, Chrome auf iOS meldet „Safari“ – die Reihenfolge zählt). */
export function erkenneBrowser(kennung: string): BrowserArt {
  if (kennung.includes('Edg/')) {
    return 'edge';
  }
  if (kennung.includes('Chrome/') || kennung.includes('CriOS/')) {
    return 'chrome';
  }
  return kennung.includes('Safari/') ? 'safari' : 'chrome';
}

