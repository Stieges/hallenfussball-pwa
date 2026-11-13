/**
 * Befund C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS, Schicht A -- @W5-039: Der Assistent startet nur mit dem vollständig geladenen
 * Turnier. Bis dahin Ladeanzeige (kein Turnier), bei Scheitern eine Meldung; der Listen-Eintrag geht nie an den Assistenten.
 *
 * Mutation: das Laden in useWizardTournament überspringen (Eintrag/`selected` direkt als bereit melden) -> die Ladetests werden rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

const repo = vi.hoisted(() => ({ get: vi.fn<(id: string, options?: { fresh?: boolean }) => Promise<Tournament | null>>() }));
vi.mock('../useRepository', () => ({ useRepository: () => repo }));

import { useWizardTournament } from '../useWizardTournament';

const startT: { id: string | null } = { id: 'T' };
const startA: { id: string | null } = { id: 'A' };
const voll = (): Tournament => ({ id: 'T', title: 'Cup', teams: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `t${n}`, name: `Team ${n}` })), matches: [] }) as unknown as Tournament;
const eintrag = (): Tournament => ({ ...voll(), teams: [], listEntryOnly: true });

beforeEach(() => { vi.clearAllMocks(); });

describe('@W5-039 useWizardTournament', () => {
  it('lädt frisch über das Repository; bis dahin loading und kein Turnier', async () => {
    let fertig: (t: Tournament) => void = () => undefined;
    repo.get.mockReturnValue(new Promise<Tournament>((resolve) => { fertig = resolve; }));
    const { result } = renderHook(() => useWizardTournament('T', null));
    expect(result.current).toEqual({ status: 'loading' });
    expect(repo.get).toHaveBeenCalledWith('T', { fresh: true });
    fertig(voll());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.status === 'ready' && result.current.tournament?.teams).toHaveLength(6);
  });

  it('ein Listen-Eintrag mit derselben Kennung wird nie übergeben: es wird geladen', async () => {
    repo.get.mockResolvedValue(voll());
    const { result } = renderHook(() => useWizardTournament('T', eintrag()));
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(repo.get).toHaveBeenCalledTimes(1);
  });

  it('liefert auch das Repository nur einen Listen-Eintrag, gilt das Laden als gescheitert', async () => {
    repo.get.mockResolvedValue(eintrag());
    const { result } = renderHook(() => useWizardTournament('T', null));
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });

  it('Turnier nicht gefunden (null) und Fehler: failed, nichts wird übergeben', async () => {
    repo.get.mockResolvedValue(null);
    const a = renderHook(() => useWizardTournament('T', null));
    await waitFor(() => expect(a.result.current.status).toBe('failed'));
    repo.get.mockRejectedValue(new Error('offline'));
    const b = renderHook(() => useWizardTournament('T', null));
    await waitFor(() => expect(b.result.current.status).toBe('failed'));
  });

  it('Gegenbeispiel: das Turnier aus „Turnier bearbeiten“ (geladen, gleiche Kennung) ist sofort bereit, ohne Laden', () => {
    const geladen = voll();
    const { result } = renderHook(() => useWizardTournament('T', geladen));
    expect(result.current).toEqual({ status: 'ready', tournament: geladen });
    expect(repo.get).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein geladenes Turnier bleibt stehen, auch wenn die Auswahl danach geleert wird (kein Neuladen, kein Aushängen)', () => {
    const start: { s: Tournament | null } = { s: voll() };
    const { result, rerender } = renderHook(({ s }: { s: Tournament | null }) => useWizardTournament('T', s), { initialProps: start });
    rerender({ s: null });
    expect(result.current.status).toBe('ready');
    expect(repo.get).not.toHaveBeenCalled();
  });

  it('neues Turnier (keine Kennung): bereit ohne Turnier, es wird nichts geladen', () => {
    const { result } = renderHook(() => useWizardTournament(null, null));
    expect(result.current).toEqual({ status: 'ready', tournament: undefined });
    expect(repo.get).not.toHaveBeenCalled();
  });

  it('Wiederöffnen: Assistent verlassen und dasselbe Turnier erneut öffnen lädt frisch und zeigt die Änderungen (nicht den Stand vom ersten Öffnen)', async () => {
    const mitTeams = (n: number): Tournament => ({ ...voll(), teams: Array.from({ length: n }, (_, k) => ({ id: `t${k}`, name: `Team ${k}` })) });
    repo.get.mockResolvedValueOnce(mitTeams(6)).mockResolvedValueOnce(mitTeams(8));
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useWizardTournament(id, null), { initialProps: startT });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ id: null }); // Zurück zur Startseite (die App bleibt über alle Routen gemountet)
    rerender({ id: 'T' });
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.status === 'ready' && result.current.tournament?.teams).toHaveLength(8);
    expect(repo.get).toHaveBeenCalledTimes(2);
  });

  it('Wiederöffnen: auch der Wechsel auf ein anderes Turnier und zurück lädt neu', async () => {
    repo.get.mockImplementation((id: string) => Promise.resolve({ ...voll(), id }));
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useWizardTournament(id, null), { initialProps: startA });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ id: 'B' });
    await waitFor(() => expect(repo.get).toHaveBeenCalledTimes(2));
    rerender({ id: 'A' });
    await waitFor(() => expect(repo.get).toHaveBeenCalledTimes(3));
  });

  it('Browser-Zurück/Vor: ein nach dem Verlassen stehengebliebenes Turnier der Verwaltung (alter Stand) wird nicht noch einmal übergeben', async () => {
    const alt = voll();
    repo.get.mockResolvedValue({ ...voll(), title: 'Frisch' });
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useWizardTournament(id, alt), { initialProps: startT });
    expect(result.current).toEqual({ status: 'ready', tournament: alt }); // erstes Öffnen über die Verwaltung
    rerender({ id: null });
    rerender({ id: 'T' });
    await waitFor(() => expect(result.current.status === 'ready' && result.current.tournament?.title).toBe('Frisch'));
    expect(repo.get).toHaveBeenCalledTimes(1);
  });

  it('Y3: ohne Netz geladen (Stand dieses Geräts) meldet das Ergebnis offline, mit Netz nicht', async () => {
    repo.get.mockResolvedValue(voll());
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const a = renderHook(() => useWizardTournament('T', null));
    await waitFor(() => expect(a.result.current.status).toBe('ready'));
    expect(a.result.current).toMatchObject({ status: 'ready', offline: true });
    online.mockReturnValue(true);
    const b = renderHook(() => useWizardTournament('T', null));
    await waitFor(() => expect(b.result.current.status).toBe('ready'));
    expect(b.result.current).not.toHaveProperty('offline');
    online.mockRestore();
  });
});
