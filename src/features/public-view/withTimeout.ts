/**
 * Begrenzt das Warten auf eine Antwort (B-15): eine hängende Anfrage soll den Takt der Zuschauer-Seite nicht anhalten.
 * Kommt die Antwort später, wird sie verworfen.
 */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Keine Antwort nach ${String(ms)} ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new TimeoutError(ms)); }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); },
    );
  });
}
