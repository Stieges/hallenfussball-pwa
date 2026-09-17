/** MonitorDisplayPage — lädt das Turnier über die Repositories (L2). Vorher: alte lokale API-Schicht, nur ein Gerät. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// vi.mock factories are hoisted above all top-level statements, including plain `const`
// declarations further down the file — referencing those directly throws a TDZ error
// ("Cannot access '...' before initialization"). vi.hoisted() hoists the values themselves
// so the factories below can safely close over them. See https://vitest.dev/api/vi.html#vi-hoisted
const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
// Regular `function` (not an arrow function) so `new SupabaseRepository()` in the production
// code — matching the LiveViewScreen.tsx pattern — can actually invoke it as a constructor.
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));

const { useLiveMatchesSpy } = vi.hoisted(() => ({
  useLiveMatchesSpy: vi.fn(() => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: vi.fn(), lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  })),
}));
vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: useLiveMatchesSpy }));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

const cloudTournament = {
  id: 'tour-1', title: 'Cloud-Turnier', teams: [], matches: [],
  monitors: [{
    id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0,
    theme: 'dark', performanceMode: 'low',
    // CustomTextSlide rendert `config.headline`/`config.body` (siehe src/types/monitor.ts) — nicht `customText`.
    slides: [{ id: 's1', type: 'custom-text', config: { headline: 'Willkommen in der Halle' }, duration: 15, order: 0 }],
  }],
};

describe('MonitorDisplayPage — Datenherkunft (L2)', () => {
  beforeEach(() => { vi.clearAllMocks(); supabaseGet.mockResolvedValue(cloudTournament); localGet.mockResolvedValue(null); });

  it('L2: lädt das Turnier aus Supabase, wenn lokal nichts liegt', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(supabaseGet).toHaveBeenCalledWith('tour-1'));
    await waitFor(() => expect(screen.getByText('Willkommen in der Halle')).toBeInTheDocument());
  });

  it('L2: schaltet useLiveMatches bei Cloud-Herkunft auf Anon-Realtime', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(useLiveMatchesSpy).toHaveBeenCalledWith('tour-1', { allowPublicRealtime: true }));
  });

  it('Regression: fällt auf localStorage zurück, wenn die Cloud nichts liefert', async () => {
    supabaseGet.mockResolvedValue(null); localGet.mockResolvedValue(cloudTournament);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(localGet).toHaveBeenCalledWith('tour-1'));
    await waitFor(() => expect(useLiveMatchesSpy).toHaveBeenLastCalledWith('tour-1', { allowPublicRealtime: false }));
  });
});

// =============================================================================
// Fix-Runde nach Review: ein einzelner fehlgeschlagener Poll darf einen bereits
// erfolgreich geladenen Bildschirm nicht kaputt machen (weder Fehlerseite noch
// Realtime-Flapping). Braucht kontrollierte Zeit für den setInterval-Poll-Tick,
// daher eigener describe-Block mit Fake-Timern (Vorbild: RetryService.test.ts,
// OfflineBanner.test.tsx — vi.advanceTimersByTimeAsync für Timer-gated async Code).
// =============================================================================
describe('MonitorDisplayPage — Poll-Resilienz (Fix-Runde)', () => {
  // cloudTournament.monitors[0].performanceMode ist 'low' -> PERFORMANCE_PROFILES.low.pollingInterval (types/monitor.ts).
  const POLLING_INTERVAL_MS = 10_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    supabaseGet.mockResolvedValue(cloudTournament);
    localGet.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Critical: ein Poll-Aussetzer nach erfolgreichem Laden lässt den Bildschirm nicht auf der Fehlerseite einfrieren', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);

    // Initial-Load (aus einem useEffect direkt beim Mount) läuft über Microtasks, kein Timer nötig.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Willkommen in der Halle')).toBeInTheDocument();
    expect(screen.queryByTestId('monitor-error-state')).not.toBeInTheDocument();

    // Poll 2: Cloud UND lokal liefern nichts — genau das Zielgerät dieses Tasks
    // (Hallen-TV ohne eigenen localStorage-Stand) bei einem einzelnen WLAN-Aussetzer.
    supabaseGet.mockRejectedValueOnce(new Error('network blip'));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS); });

    expect(screen.getByText('Willkommen in der Halle')).toBeInTheDocument();
    expect(screen.queryByTestId('monitor-error-state')).not.toBeInTheDocument();

    // Poll 3: erholt sich wieder.
    await act(async () => { await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS); });
    expect(screen.getByText('Willkommen in der Halle')).toBeInTheDocument();
    expect(screen.queryByTestId('monitor-error-state')).not.toBeInTheDocument();
  });

  it('Important: ein vollständig fehlgeschlagener Poll (Cloud UND lokal leer) rührt die Realtime-Anbindung nicht an', async () => {
    // Fix-Runde-Review (M1): Der ursprüngliche Titel dieses Tests versprach "kein
    // Realtime-Flapping", auch wenn ein Poll auf lokale Daten zurückfällt. Mit
    // `localGet` auf `null` (beforeEach) erreicht der Code aber nie den
    // dataSource-Zweig — die `hadData && lookupFailed`-Guard in loadData() greift
    // vorher und verlässt die Funktion, bevor `setDataSource` überhaupt aufgerufen
    // würde. Der Test bestand daher unabhängig davon, ob die Guard existierte.
    // Empirisch geprüft: Lässt man stattdessen `localGet` in diesem Poll erfolgreich
    // auflösen (`localGet.mockResolvedValueOnce(cloudTournament)`), wechselt
    // `dataSource` tatsächlich auf 'local' und `useLiveMatches` bekommt
    // `allowPublicRealtime: false` — der Cloud-zu-Local-Flapping-Fall, den der
    // Titel ausschließen wollte, ist also (noch) NICHT abgesichert. Das ist ein
    // eigenständiger, hier nicht behobener Befund (kein Teil dieser Fix-Welle) und
    // gehört auf docs/findings/INDEX.md, nicht in diesen Test hineingemogelt.
    // Dieser Test bleibt bei dem, was er tatsächlich beweist: Bei einem TOTAL
    // fehlgeschlagenen Poll (beide Quellen liefern nichts) bleibt die
    // Realtime-Anbindung unverändert bestehen.
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(useLiveMatchesSpy).toHaveBeenLastCalledWith('tour-1', { allowPublicRealtime: true });

    supabaseGet.mockRejectedValueOnce(new Error('network blip'));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS); });

    expect(useLiveMatchesSpy).toHaveBeenLastCalledWith('tour-1', { allowPublicRealtime: true });
  });
});

// =============================================================================
// Fix-Runde 2 nach Re-Review: ein leeres Ergebnis und ein fehlgeschlagener Aufruf sind
// nicht dasselbe. SupabaseRepository.get() liefert bei fehlender Zeile sauber `null`
// zurück und wirft nicht — ein sauberer leerer Treffer ist eine bestätigte Löschung
// (Monitor oder ganzes Turnier), kein Aussetzer, und muss sichtbar werden. Nur ein
// echter Fehlschlag (Reject/Timeout) rechtfertigt es, den bestehenden Stand zu halten.
// =============================================================================
describe('MonitorDisplayPage — bestätigte Abwesenheit vs. transienter Fehler (Fix-Runde 2)', () => {
  const POLLING_INTERVAL_MS = 10_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    supabaseGet.mockResolvedValue(cloudTournament);
    localGet.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Important: ein gelöschter Monitor wird nach erfolgreichem Laden sichtbar gemeldet (kein hadData-Schutz)', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Willkommen in der Halle')).toBeInTheDocument();

    // Poll 2: Der Turnier-Abruf läuft sauber durch (kein Reject!), aber der Monitor
    // wurde vom Organisator gelöscht — monitors enthält "mon-1" nicht mehr.
    supabaseGet.mockResolvedValueOnce({ ...cloudTournament, monitors: [] });
    await act(async () => { await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS); });

    expect(screen.getByTestId('monitor-error-state')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-error-message')).toHaveTextContent('Monitor nicht gefunden: mon-1');
  });

  it('Important: ein bestätigt gelöschtes Turnier wird sichtbar gemeldet, obwohl vorher schon Daten da waren', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Willkommen in der Halle')).toBeInTheDocument();

    // Poll 2: beide Repos lösen sauber zu null auf (kein Reject) — bestätigt weg,
    // im Gegensatz zum "Critical"-Test oben, wo Supabase mit einem Reject scheitert
    // und der Bildschirm unverändert bleiben muss.
    supabaseGet.mockResolvedValueOnce(null);
    localGet.mockResolvedValueOnce(null);
    await act(async () => { await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS); });

    expect(screen.getByTestId('monitor-error-state')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-error-message')).toHaveTextContent('Turnier nicht gefunden: tour-1');
  });
});

// =============================================================================
// Wake Lock — Task 8
// =============================================================================
describe('MonitorDisplayPage — Wake Lock (L7)', () => {
  beforeEach(() => { vi.clearAllMocks(); supabaseGet.mockResolvedValue(cloudTournament); localGet.mockResolvedValue(null); });

  it('L7: fordert Wake Lock an, sobald der Monitor geladen ist', async () => {
    const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn(), removeEventListener: vi.fn() });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
  });

  it('L7: fordert keinen Wake Lock an, solange kein Monitor geladen ist', async () => {
    supabaseGet.mockResolvedValue(null); localGet.mockResolvedValue(null);
    const request = vi.fn();
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Turnier nicht gefunden/)).toBeInTheDocument());
    expect(request).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Fix 1 (M1-Fixwelle): Ein fehlgeschlagenes Erstladen darf den Bildschirm nicht für
// den Rest des Tages auf der Fehlerseite stehen lassen. Vorher war der Poll-Effekt
// mit `if (!monitor) { return; }` gated — lief also NIE an, solange das Erstladen nie
// erfolgreich war. Praxisfall: Der Hallen-TV schaltet ein, bevor das WLAN steht.
// =============================================================================
describe('MonitorDisplayPage — Fix 1: Erstladen-Fehlschlag erholt sich automatisch', () => {
  // Kein Monitor geladen -> schnellere Taktung laut Fix 1 (5s statt Profil-Intervall).
  const FAST_RETRY_MS = 5000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Critical: ein fehlgeschlagenes Erstladen (TV vor WLAN-Verbindung) erholt sich beim nächsten Poll ohne manuelles Neuladen', async () => {
    // Erstladen: Cloud-Timeout/Reject, lokal nichts (fremdes TV-Gerät ohne eigenen Cache).
    supabaseGet.mockRejectedValueOnce(new Error('network blip'));
    localGet.mockResolvedValueOnce(null);

    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId('monitor-error-state')).toBeInTheDocument();

    // Ohne Fix 1 pollt die Seite ab hier nie wieder (Poll-Effekt war auf `monitor` gated,
    // der wegen des Fehlschlags nie gesetzt wurde) — der Bildschirm bliebe für den Rest
    // des Tages auf der Fehlerseite stehen.
    supabaseGet.mockResolvedValue(cloudTournament);
    localGet.mockResolvedValue(null);
    await act(async () => { await vi.advanceTimersByTimeAsync(FAST_RETRY_MS); });

    expect(screen.getByText('Willkommen in der Halle')).toBeInTheDocument();
    expect(screen.queryByTestId('monitor-error-state')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Fix 6 (M1-Fixwelle): Auf dem allerersten Laden ist `lookupFailed` bislang ungenutzt
// geblieben — ein Verbindungsfehler (Cloud-Timeout/Reject) erzeugte dieselbe
// Sichtbarkeits-Meldung wie eine bestätigte Abwesenheit. Das schickt den Organisator im
// schlimmsten Moment (WLAN-Aussetzer beim Hochfahren) an eine bereits korrekte
// Einstellung. Gehört inhaltlich zu Fix 1: Erst wenn der Poll wirklich immer weiterläuft,
// stimmt das Versprechen "automatisch".
// =============================================================================
describe('MonitorDisplayPage — Fix 6: Erstladen-Fehler unterscheidet Netzwerk von Sichtbarkeit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('Critical: ein Cloud-Reject beim Erstladen zeigt die Verbindungs-Meldung, nicht die Sichtbarkeits-Meldung', async () => {
    supabaseGet.mockRejectedValueOnce(new Error('network blip'));
    localGet.mockResolvedValueOnce(null);

    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('monitor-error-state')).toBeInTheDocument());
    const message = screen.getByTestId('monitor-error-message').textContent ?? '';
    expect(message).toContain('Verbindung zum Server fehlgeschlagen');
    expect(message).not.toContain('Sichtbarkeits-Einstellungen');
  });
});
