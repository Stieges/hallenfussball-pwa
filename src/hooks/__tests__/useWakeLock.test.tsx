/**
 * useWakeLock (B-48a): Zustand der Zusage zum Anlassen des Bildschirms.
 * Szenarien: @ME-006 (Beispielzeilen „Browser lässt das Anlassen nicht zu“ und „5 Sekunden weder Ja noch Nein“),
 * @ME-064 (Zustand zugesagt/abgelehnt/keine Antwort, Datenquelle der Meldung), @SL-122 (Cockpit leitet den Hinweis
 * aus dem Zustand ab). Zeit nur über Fake-Timer.
 * Gegenbeispiele: Antwort nach 4,9 s ist nie „keine Antwort“; eine Zusage ist nie „keine Antwort“.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { captureFeatureError } = vi.hoisted(() => ({ captureFeatureError: vi.fn() }));
vi.mock('../../lib/sentry', () => ({ captureFeatureError }));

import { useWakeLock, WAKE_LOCK_ANSWER_TIMEOUT_MS } from '../useWakeLock';

type Sentinel = {
  release: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

function sentinel(): Sentinel {
  return { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

function installiere(request: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}

/** Eine Anfrage, die der Test von Hand beantwortet (Ja, Nein) oder offen lässt. */
function offeneAnfrage() {
  let zusagen: (s: Sentinel) => void = () => undefined;
  let ablehnen: (e: Error) => void = () => undefined;
  const request = vi.fn().mockImplementation(
    () => new Promise<Sentinel>((res, rej) => { zusagen = res; ablehnen = rej; }),
  );
  installiere(request);
  return { request, zusagen: (s: Sentinel) => zusagen(s), ablehnen: (e: Error) => ablehnen(e) };
}

async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('useWakeLock Zustand (@ME-006, @ME-064, @SL-122)', () => {
  it('die Grenze für „keine Antwort“ ist 5 Sekunden', () => {
    expect(WAKE_LOCK_ANSWER_TIMEOUT_MS).toBe(5_000);
  });

  it('ohne Anforderung bleibt der Zustand „idle“', async () => {
    installiere(vi.fn().mockResolvedValue(sentinel()));
    const { result } = renderHook(() => useWakeLock(false));
    await vorspulen(0);
    expect(result.current.status).toBe('idle');
  });

  it('Zusage des Browsers: „granted“', async () => {
    installiere(vi.fn().mockResolvedValue(sentinel()));
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(0);
    expect(result.current.status).toBe('granted');
  });

  it('der Browser lässt das Anlassen nicht zu (NotAllowedError): „denied“, ein Fehlerbericht je Seitenaufruf', async () => {
    const abgelehnt = Object.assign(new Error('nicht erlaubt'), { name: 'NotAllowedError' });
    installiere(vi.fn().mockRejectedValue(abgelehnt));
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(0);
    expect(result.current.status).toBe('denied');
    await act(async () => { await result.current.request(); });
    expect(result.current.status).toBe('denied');
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
  });

  it('jede andere Ausnahme der Schnittstelle wird gefangen und als „denied“ gewertet', async () => {
    installiere(vi.fn().mockRejectedValue(new TypeError('kaputt')));
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(0);
    expect(result.current.status).toBe('denied');
  });

  it('die Schnittstelle fehlt: „unsupported“', async () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(0);
    expect(result.current.status).toBe('unsupported');
    expect(result.current.isSupported).toBe(false);
  });

  it('@ME-006 Lage 2: 5 Sekunden weder Ja noch Nein: „noAnswer“, davor „pending“', async () => {
    offeneAnfrage();
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(WAKE_LOCK_ANSWER_TIMEOUT_MS - 1);
    expect(result.current.status).toBe('pending');
    await vorspulen(1);
    expect(result.current.status).toBe('noAnswer');
  });

  it('Gegenbeispiel: Antwort nach 4,9 Sekunden ist nie „noAnswer“', async () => {
    const anfrage = offeneAnfrage();
    const { result } = renderHook(() => useWakeLock(true));
    const gesehen: string[] = [];
    await vorspulen(4_900);
    gesehen.push(result.current.status);
    anfrage.zusagen(sentinel());
    await vorspulen(0);
    gesehen.push(result.current.status);
    await vorspulen(WAKE_LOCK_ANSWER_TIMEOUT_MS);
    gesehen.push(result.current.status);
    expect(gesehen).toEqual(['pending', 'granted', 'granted']);
  });

  it('kommt die Zusage nach 6 Sekunden noch, wechselt „noAnswer“ auf „granted“', async () => {
    const anfrage = offeneAnfrage();
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(6_000);
    expect(result.current.status).toBe('noAnswer');
    anfrage.zusagen(sentinel());
    await vorspulen(0);
    expect(result.current.status).toBe('granted');
  });

  it('kommt die Ablehnung nach 6 Sekunden noch, wechselt „noAnswer“ auf „denied“', async () => {
    const anfrage = offeneAnfrage();
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(6_000);
    anfrage.ablehnen(new Error('nein'));
    await vorspulen(0);
    expect(result.current.status).toBe('denied');
  });

  it('@ME-064: das Ereignis „release“ nach der Zusage setzt „released“', async () => {
    const s = sentinel();
    installiere(vi.fn().mockResolvedValue(s));
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(0);
    expect(result.current.status).toBe('granted');
    const freigabe = s.addEventListener.mock.calls.find(([name]) => name === 'release')?.[1] as () => void;
    act(() => { freigabe(); });
    expect(result.current.status).toBe('released');
  });

  it('nach „released“ fordert die Rückkehr in den Vordergrund neu an und der Zustand wird wieder „granted“', async () => {
    const s = sentinel();
    const request = vi.fn().mockResolvedValue(s);
    installiere(request);
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(0);
    const freigabe = s.addEventListener.mock.calls.find(([name]) => name === 'release')?.[1] as () => void;
    act(() => { freigabe(); });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await vorspulen(0);
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('granted');
  });

  it('Gegenbeispiel: eine hängende Anfrage wird beim Sichtbarkeitswechsel nicht doppelt gestellt', async () => {
    const anfrage = offeneAnfrage();
    renderHook(() => useWakeLock(true));
    await vorspulen(1_000);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(anfrage.request).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: nach einer Zusage gibt es keine zweite Anfrage und nie „noAnswer“', async () => {
    const request = vi.fn().mockResolvedValue(sentinel());
    installiere(request);
    const { result } = renderHook(() => useWakeLock(true));
    await vorspulen(WAKE_LOCK_ANSWER_TIMEOUT_MS * 2);
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('granted');
  });

  it('wird die Anforderung zurückgenommen, gibt der Hook die Zusage frei und steht wieder auf „idle“', async () => {
    const s = sentinel();
    installiere(vi.fn().mockResolvedValue(s));
    const { result, rerender } = renderHook(({ an }) => useWakeLock(an), { initialProps: { an: true } });
    await vorspulen(0);
    rerender({ an: false });
    await vorspulen(0);
    expect(s.release).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('Fehlerpolitik: kein Zustand wirft; nach dem Abbau erzeugt eine späte Antwort keinen Fehler', async () => {
    const anfrage = offeneAnfrage();
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    anfrage.zusagen(sentinel());
    await vorspulen(WAKE_LOCK_ANSWER_TIMEOUT_MS);
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('@SL-060: eine Zusage, die erst nach dem Abbau eintrifft, wird sofort freigegeben (Gerätesperre gilt wieder)', async () => {
    const anfrage = offeneAnfrage();
    const { unmount } = renderHook(() => useWakeLock(true));
    await vorspulen(1_000);
    unmount();
    const s = sentinel();
    anfrage.zusagen(s);
    await vorspulen(0);
    expect(s.release).toHaveBeenCalledTimes(1);
  });

  it('@SL-060: wird die Anforderung zurückgenommen, während die Anfrage hängt, wird die spätere Zusage freigegeben, der Zustand bleibt „idle“', async () => {
    const anfrage = offeneAnfrage();
    const { result, rerender } = renderHook(({ an }) => useWakeLock(an), { initialProps: { an: true } });
    await vorspulen(WAKE_LOCK_ANSWER_TIMEOUT_MS + 1_000);
    expect(result.current.status).toBe('noAnswer');
    rerender({ an: false });
    await vorspulen(0);
    expect(result.current.status).toBe('idle');
    const s = sentinel();
    anfrage.zusagen(s);
    await vorspulen(0);
    expect(s.release).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });
});
