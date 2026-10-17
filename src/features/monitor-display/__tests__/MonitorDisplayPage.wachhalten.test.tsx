/**
 * Wachhalten-Hinweis der Monitor-Seite (B-48a, Variante B): „Bildschirm kann ausgehen – Energiesparen prüfen“ @ME-006, Gegenbeispiele @ME-006 und @ME-064 (Verwaltung, nicht hier).
 * Der Hinweis erscheint nur beim Start auf Folien ohne laufendes Spiel, 10 Sekunden lang, als Ecke oben rechts; startet
 * während der 10 Sekunden ein Spiel, verschwindet er sofort. Nie auf der Live-Folie mit Spiel, nie in der Browser-Quelle,
 * nie nach einer Zusage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { slide } from './monitorFixture';
import {
  HINWEIS,
  monitorTurnier,
  liveTurnier,
  liveTurnierOhneSpiel,
  wakeLockUnterstuetzt,
  wakeLockFehlt,
  wakeLockHaengt,
  wakeLockAbgelehnt,
  vorspulen,
  seite,
  hinweis,
  kopfzeile,
  LAGEN,
} from './wachhaltenFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return {
    QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }),
  };
});
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));



beforeEach(() => {
  vi.clearAllMocks();
  supabaseGet.mockResolvedValue(null);
  localGet.mockResolvedValue(monitorTurnier());
  wakeLockUnterstuetzt();
  window.history.replaceState(null, '', '/#/display/tour-1/mon-1');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  wakeLockFehlt();
});

describe('Hinweis auf Folien ohne laufendes Spiel (@ME-006)', () => {
  it.each(LAGEN)('Lage „%s“: der Hinweis steht 10 Sekunden als Ecke oben rechts', async (_lage, einrichten, wartezeit) => {
    einrichten();
    seite();
    // Die 5 Sekunden laufen ab der Anfrage; die Anfrage stellt die Seite, sobald der Monitor geladen ist.
    await vorspulen(0);
    await vorspulen(wartezeit);
    expect(hinweis()).toHaveTextContent(HINWEIS);
    expect(kopfzeile()).not.toBeInTheDocument();
    expect(hinweis()?.style.position).toBe('absolute');
    expect(hinweis()?.style.top).toBe('0px');
    expect(hinweis()?.style.right).toBe('0px');
    expect(hinweis()?.style.bottom).toBe('');
    await vorspulen(10_000 - 1);
    expect(hinweis()).toBeInTheDocument();
    await vorspulen(1);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it.each([
    ['Live-Folie ohne laufendes Spiel (Feld 2, Rückfall auf QR)', [slide('live', { fieldId: 'field-2' }, 30)]],
    ['Zuschauer-QR', [slide('qr-code', {}, 30)]],
    ['Einrichtung / Textfolie', [slide('custom-text', { headline: 'Folie A' }, 30)]],
  ] as const)('Startfolie „%s“: der Hinweis steht 10 Sekunden', async (_name, folien) => {
    wakeLockAbgelehnt();
    localGet.mockResolvedValue(monitorTurnier([...folien]));
    seite();
    await vorspulen(0);
    expect(hinweis()).toHaveTextContent(HINWEIS);
    await vorspulen(10_000);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('das Folienprogramm läuft weiter, während der Hinweis ansteht', async () => {
    wakeLockAbgelehnt();
    seite();
    await vorspulen(0);
    expect(screen.getByText('Folie A')).toBeInTheDocument();
    await vorspulen(4_000);
    expect(screen.getByText('Folie B')).toBeInTheDocument();
    expect(hinweis()).toBeInTheDocument();
  });

  it('ohne Wake Lock (Schnittstelle fehlt) erscheint der Hinweis und verschwindet nach 10 Sekunden', async () => {
    wakeLockFehlt();
    seite();
    await vorspulen(0);
    expect(hinweis()).toHaveTextContent(HINWEIS);
    await vorspulen(10_000);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: vor Ablauf der 5 Sekunden ohne Antwort steht noch kein Hinweis', async () => {
    wakeLockHaengt();
    seite();
    await vorspulen(0);
    await vorspulen(4_999);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('Gegenbeispiel: antwortet der Browser nach 4,9 Sekunden mit Ja, erscheint nie ein Hinweis', async () => {
    let zusagen: (s: unknown) => void = () => undefined;
    const request = vi.fn().mockReturnValue(new Promise((res) => { zusagen = res; }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    seite();
    await vorspulen(0);
    await vorspulen(4_900);
    zusagen({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() });
    await vorspulen(10_000);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('@ME-006: war der Bildschirm schon zugesagt, erscheint später nach Entzug und Ablehnung kein Hinweis mitten im Betrieb', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const request = vi.fn().mockResolvedValueOnce(sentinel).mockRejectedValue(new Error('Energiesparmodus'));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    seite();
    await vorspulen(0);
    const freigabe = sentinel.addEventListener.mock.calls.find(([name]) => name === 'release')?.[1] as () => void;
    act(() => { freigabe(); });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await vorspulen(0);
    expect(request).toHaveBeenCalledTimes(2);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('@ME-006: nimmt der Browser eine Zusage später zurück (release), zeigt der Monitor keinen Hinweis', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    seite();
    await vorspulen(0);
    const freigabe = sentinel.addEventListener.mock.calls.find(([name]) => name === 'release')?.[1] as () => void;
    act(() => { freigabe(); });
    await vorspulen(1_000);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it.each([
    ['Spielplan', [slide('schedule-field', { fieldId: 'field-1' }, 30)]],
    ['Zuschauer-QR', [slide('qr-code', {}, 30)]],
    ['Textfolie', [slide('custom-text', { headline: 'Folie A' }, 30)]],
  ] as const)('Gegenbeispiel: bei Zusage des Browsers erscheint auf „%s“ kein Hinweis', async (_name, folien) => {
    localGet.mockResolvedValue(monitorTurnier([...folien]));
    seite();
    await vorspulen(0);
    await vorspulen(11_000);
    expect(hinweis()).not.toBeInTheDocument();
  });
});

describe('Live-Folie mit laufendem Spiel (@ME-006, Kopfzeile)', () => {
  it.each(LAGEN)('Gegenbeispiel, Lage „%s“: läuft beim Start ein Spiel, zeigt der Monitor nie einen Hinweis', async (_lage, einrichten, wartezeit) => {
    einrichten();
    localGet.mockResolvedValue(liveTurnier());
    seite();
    await vorspulen(0);
    // A1: sofort prüfen, nicht erst nach Ablauf der 10 Sekunden (sonst wäre ein Hinweis längst wieder weg)
    expect(hinweis()).not.toBeInTheDocument();
    await vorspulen(wartezeit);
    expect(hinweis()).not.toBeInTheDocument();
    for (let s = 1; s <= 11; s += 1) {
      await vorspulen(1_000);
      expect(hinweis(), `${wartezeit / 1_000 + s} s nach dem Start`).not.toBeInTheDocument();
    }
  });

  it.each(LAGEN)('Gegenbeispiel, Lage „%s“: läuft ein Spiel, zeigt auch eine vorangehende Text- oder QR-Folie keinen Hinweis', async (_lage, einrichten, wartezeit) => {
    einrichten();
    // auf demselben Turnier läuft Spiel 7 auf Feld 1 (liveTurnier)
    localGet.mockResolvedValue({ ...liveTurnier(), monitors: monitorTurnier([
      slide('qr-code', {}, 30),
      slide('custom-text', { headline: 'Folie A' }, 30),
      slide('live', { fieldId: 'field-1' }, 30),
    ]).monitors });
    seite();
    await vorspulen(0);
    expect(hinweis()).not.toBeInTheDocument();
    await vorspulen(wartezeit);
    expect(hinweis()).not.toBeInTheDocument();
    await vorspulen(11_000);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('die Kopfzeile zeigt wie bisher Feld/Spiel und Gruppe, auch ohne Hinweis', async () => {
    wakeLockAbgelehnt();
    localGet.mockResolvedValue(liveTurnier());
    seite();
    await vorspulen(0);
    expect(kopfzeile()).toBeInTheDocument();
    expect(screen.getByTestId('live-info')).toHaveTextContent('Feld 1');
    expect(screen.getByTestId('live-group')).toHaveTextContent('monitor:liveMatch.group');
  });

  it('Spiel startet während der 10 Sekunden: der Hinweis verschwindet sofort, das Folienprogramm läuft weiter', async () => {
    wakeLockAbgelehnt();
    localGet.mockResolvedValue(liveTurnierOhneSpiel());
    seite();
    await vorspulen(0);
    expect(hinweis()).toBeInTheDocument();
    // Der Monitor fragt alle 5 Sekunden ab; danach läuft das Spiel auf Feld 1.
    localGet.mockResolvedValue(liveTurnier());
    await vorspulen(5_000);
    expect(hinweis()).not.toBeInTheDocument();
    await vorspulen(10_000);
    expect(hinweis()).not.toBeInTheDocument();
  });
});

describe('Bildschirm bleibt an im normalen Browser (@ME-005)', () => {
  it('Gherkin: nach 30 Minuten ohne Eingabe ist die Zusage zum Anlassen noch gehalten und das Folienprogramm läuft', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    seite();
    await vorspulen(0);
    expect(request).toHaveBeenCalledWith('screen');
    // 30 Minuten ohne Eingabe, simulierte Zeit
    await vorspulen(30 * 60 * 1_000);
    expect(request).toHaveBeenCalledTimes(1);
    expect(sentinel.release).not.toHaveBeenCalled();
    expect(screen.getByTestId('monitor-slide')).toHaveTextContent(/Folie [AB]/);
    expect(hinweis()).not.toBeInTheDocument();
  });
});
