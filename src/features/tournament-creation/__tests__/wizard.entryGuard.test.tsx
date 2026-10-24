/**
 * A-08f3e4 Punkt 2 – @FU-090 Beispiel „im Assistenten den Spielplan neu erzeugen“ (Brief A-08f3e4c1c2 § 3).
 * Zwei Einstiege im Assistenten: Schritt 2 „Turnier zurücksetzen“ (`useTournamentWizard.handleResetTournament`) und die
 * Vorschau, die den Spielplan bei jeder Änderung neu erzeugt (`TournamentPreview`). Mit Einträgen: nicht ausführen,
 * Text wörtlich, Einträge bleiben. Ohne Einträge: wie heute. Echte Spiel-Engine, echte DE-Texte, echter Toast.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../hooks/useRepository', () => ({ useRepository: () => ({}) }));
const generate = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../../../core/generators', async (original) => {
  const actual = await original<typeof import('../../../core/generators')>();
  return { ...actual, generateFullSchedule: (...args: Parameters<typeof actual.generateFullSchedule>) => { generate.calls += 1; return actual.generateFullSchedule(...args); } };
});
vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: ({ onFieldChange }: { onFieldChange?: (matchId: string, field: number) => void }) => (
    <button data-testid="change-field-stub" onClick={() => onFieldChange?.('spiel-9', 2)}>Feld ändern</button>
  ),
}));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { ToastProvider } from '../../../components/ui/Toast';
import { MatchEngineContext } from '../../match-engine/matchEngineContextInstance';
import { makeScheduleEngine, scheduleTournament, SPIEL_7, type ScheduleEngine } from '../../../test/scheduleEngineHarness';
import { entryCount, seedEntries } from '../../../test/matchEntrySeed';
import { generateFullSchedule } from '../../../core/generators';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { TournamentPreview } from '../TournamentPreview';

await initRealDeI18n();

/** 2:1 = Anpfiff, drei Tore, Abpfiff = 5 Einträge (@FU-090). */
const ZWEI_ZU_EINS = { home: 2, away: 1 };

const BLOCKED_7 = 'Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen';
const mitErgebnis = () => scheduleTournament({ [SPIEL_7]: { scoreA: 4, scoreB: 0, matchStatus: 'finished' } });

describe('A-08f3e4 Assistent: Zurücksetzen und Neu erzeugen löschen keine Einträge still (@FU-090)', () => {
  let h: ScheduleEngine;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ToastProvider><MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider></ToastProvider>
  );

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    generate.calls = 0;
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-090 Schritt 2 „Turnier zurücksetzen“ mit 5 Einträgen an Spiel 7 → nicht ausgeführt, Text wörtlich, Einträge bleiben', async () => {
    await seedEntries(h, SPIEL_7, ZWEI_ZU_EINS);
    const browserConfirm = vi.spyOn(window, 'confirm');
    const confirm = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useTournamentWizard(mitErgebnis(), confirm), { wrapper });

    act(() => { result.current.handleResetTournament(); });

    expect(await screen.findByText(BLOCKED_7)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(browserConfirm).not.toHaveBeenCalled(); // @OB-017
    expect(result.current.formData.matches?.find((m) => m.id === SPIEL_7)).toMatchObject({ scoreA: 4, matchStatus: 'finished' });
    expect(await entryCount(h, SPIEL_7)).toBe(5);
  });

  it('Gegenbeispiel: Schritt 2 ohne Einträge → Rückfrage und Zurücksetzen wie heute', async () => {
    const browserConfirm = vi.spyOn(window, 'confirm');
    const confirm = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useTournamentWizard(mitErgebnis(), confirm), { wrapper });

    act(() => { result.current.handleResetTournament(); });

    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(browserConfirm).not.toHaveBeenCalled(); // @OB-017: nie ein Fenster des Browsers
    await vi.waitFor(() => expect(result.current.formData.matches?.find((m) => m.id === SPIEL_7)?.matchStatus).toBe('scheduled'));
    expect(result.current.formData.matches?.find((m) => m.id === SPIEL_7)).toMatchObject({ scoreA: undefined, matchStatus: 'scheduled' });
    expect(screen.queryByText(BLOCKED_7)).not.toBeInTheDocument();
  });

  function renderPreview() {
    const tournament = mitErgebnis();
    const onTournamentChange = vi.fn();
    render(
      <TournamentPreview tournament={tournament} schedule={generateFullSchedule(tournament)} onEdit={vi.fn()} onPublish={vi.fn()} onTournamentChange={onTournamentChange} />,
      { wrapper },
    );
    generate.calls = 0;
    return { onTournamentChange };
  }

  it('@FU-090 Vorschau: Spielplan neu erzeugen mit 5 Einträgen an Spiel 7 → nicht ausgeführt, Text wörtlich, Einträge bleiben', async () => {
    await seedEntries(h, SPIEL_7, ZWEI_ZU_EINS);
    const { onTournamentChange } = renderPreview();

    fireEvent.click(screen.getByTestId('change-field-stub'));

    expect(await screen.findByText(BLOCKED_7)).toBeInTheDocument();
    expect(generate.calls).toBe(0);
    expect(onTournamentChange).not.toHaveBeenCalled();
    expect(await entryCount(h, SPIEL_7)).toBe(5);
  });

  it('Gegenbeispiel: Vorschau ohne Einträge → Spielplan wird neu erzeugt wie heute', async () => {
    const { onTournamentChange } = renderPreview();

    fireEvent.click(screen.getByTestId('change-field-stub'));

    await vi.waitFor(() => expect(onTournamentChange).toHaveBeenCalledTimes(1));
    expect(generate.calls).toBe(1);
  });
});
