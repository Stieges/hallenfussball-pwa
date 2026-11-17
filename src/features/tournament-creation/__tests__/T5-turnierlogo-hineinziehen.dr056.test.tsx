/**
 * @DR-056 Das Turnierlogo lässt sich auch hineinziehen – im Assistenten, Schritt 1 „Stammdaten“, für die linke und die rechte Grafik.
 * Abgelegt = wie „Datei auswählen“ (dieselben Prüfungen und Hinweise über `prepareTournamentGraphic`). Mehrere Dateien oder
 * eine Datei falscher Art: die hinterlegte Grafik bleibt, die App nennt den Grund. Aufbereiten ersetzt (Canvas), Speicher im Arbeitsspeicher.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { IStorageAdapter } from '../../../core/storage/IStorageAdapter';
import type { PrepareResult } from '../../../lib/images/prepareTournamentGraphic';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../components/LocationForm', () => ({ LocationForm: () => null }));
vi.mock('../../../components/ContactForm', () => ({ ContactForm: () => null }));

const memory = vi.hoisted(() => ({ data: new Map<string, unknown>() }));
vi.mock('../../../core/storage/StorageFactory', () => ({
  createStorage: (): Promise<IStorageAdapter> => Promise.resolve({
    get: <T,>(key: string) => Promise.resolve((memory.data.has(key) ? structuredClone(memory.data.get(key)) : null) as T | null),
    set: <T,>(key: string, value: T) => { memory.data.set(key, structuredClone(value)); return Promise.resolve(); },
    delete: (key: string) => { memory.data.delete(key); return Promise.resolve(); },
    clear: () => { memory.data.clear(); return Promise.resolve(); },
    keys: () => Promise.resolve([...memory.data.keys()]),
  }),
}));

const prepareMock = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/images/prepareTournamentGraphic', () => ({ prepareTournamentGraphic: prepareMock }));

import { Step3_Metadata } from '../Step3_Metadata';
import { tournamentGraphicsStore } from '../../../core/storage/tournamentGraphicsStore';

const TURNIER_ID = 'turnier-dr056';
const dataUrl = (seed: string): string => `data:image/png;base64,${seed}`;
const ok = (seed: string): PrepareResult => ({ ok: true, graphic: { dataUrl: dataUrl(seed), widthPx: 600, heightPx: 600, originalHeightPx: 600 }, warnLowRes: false });
const datei = (name = 'wappen.svg', type = 'image/svg+xml'): File => new File(['x'], name, { type });
const ablegen = (prefix: string, files: File[]): void => {
  fireEvent.drop(screen.getByTestId(`${prefix}-feld`), { dataTransfer: { types: ['Files'], files, dropEffect: 'none' } });
};
const fertig = (): Promise<void> => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
const gespeichert = () => tournamentGraphicsStore.load(TURNIER_ID);

function zeige(): void {
  const formData = { id: TURNIER_ID, title: 'Hallencup Nord' } as unknown as Partial<Tournament>;
  render(<Step3_Metadata formData={formData} onUpdate={vi.fn()} />);
}

beforeEach(() => { memory.data.clear(); prepareMock.mockReset(); });

describe('@DR-056 Turnierlogo hineinziehen', () => {
  it('„wappen.svg“ auf die linke Grafik: übernommen wie nach „Datei auswählen“, dieselbe Aufbereitung mit Akzent', async () => {
    prepareMock.mockResolvedValue(ok('TElOS1M='));
    zeige();
    await screen.findByTestId('turnierlogo-hochladen');
    const wappen = datei();

    ablegen('turnierlogo', [wappen]);

    await screen.findByTestId('turnierlogo-vorschau');
    expect(prepareMock).toHaveBeenCalledWith(wappen, { computeAccent: true });
    expect((await gespeichert()).left?.dataUrl).toBe(dataUrl('TElOS1M='));
    expect(screen.getByTestId('turnierlogo-aendern')).toBeInTheDocument();
  });

  it('rechte Grafik: abgelegt wird sie rechts hinterlegt, ohne Akzent und ohne das Logo links zu berühren', async () => {
    prepareMock.mockResolvedValueOnce(ok('TElOS1M=')).mockResolvedValueOnce(ok('UkVDSFRT'));
    zeige();
    await screen.findByTestId('turnierlogo-hochladen');
    ablegen('turnierlogo', [datei()]);
    await screen.findByTestId('turnierlogo-vorschau');

    ablegen('zweite-grafik', [datei('sponsor.svg')]);

    await screen.findByTestId('zweite-grafik-vorschau');
    expect(prepareMock).toHaveBeenLastCalledWith(expect.any(File), { computeAccent: false });
    expect(await gespeichert()).toMatchObject({ left: { dataUrl: dataUrl('TElOS1M=') }, right: { dataUrl: dataUrl('UkVDSFRT') } });
  });

  it('Ablege-Zustand zeigt „Hier ablegen“ über dem Feld', async () => {
    zeige();
    const feld = await screen.findByTestId('turnierlogo-feld');

    fireEvent.dragEnter(feld, { dataTransfer: { types: ['Files'], files: [] } });

    expect(screen.getByTestId('turnierlogo-ablegen')).toHaveTextContent('Hier ablegen');
    expect(screen.queryByTestId('zweite-grafik-ablegen')).toBeNull();
  });

  it('Gegenbeispiel: mehrere Dateien: nichts wird aufbereitet, die hinterlegte Grafik bleibt, der Grund steht am Feld', async () => {
    prepareMock.mockResolvedValue(ok('TElOS1M='));
    zeige();
    await screen.findByTestId('turnierlogo-hochladen');
    ablegen('turnierlogo', [datei()]);
    await screen.findByTestId('turnierlogo-vorschau');
    prepareMock.mockClear();

    ablegen('turnierlogo', [datei('a.svg'), datei('b.svg')]);

    expect(prepareMock).not.toHaveBeenCalled();
    expect(await screen.findByTestId('turnierlogo-fehler')).toHaveTextContent('Bitte nur eine Datei auf einmal ablegen.');
    expect(screen.getByTestId('turnierlogo-fehler')).toHaveTextContent('Das bisherige Logo bleibt.');
    expect(screen.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', dataUrl('TElOS1M='));
    expect((await gespeichert()).left?.dataUrl).toBe(dataUrl('TElOS1M='));
  });

  it('Gegenbeispiel: Datei falscher Art (vom Aufbereiter abgelehnt): Grafik bleibt, Grund „Erlaubt sind PNG, JPG und SVG“', async () => {
    prepareMock.mockResolvedValueOnce(ok('TElOS1M=')).mockResolvedValueOnce({ ok: false, reason: 'type' });
    zeige();
    await screen.findByTestId('turnierlogo-hochladen');
    ablegen('turnierlogo', [datei()]);
    await screen.findByTestId('turnierlogo-vorschau');

    ablegen('turnierlogo', [datei('liste.pdf', 'application/pdf')]);

    expect(await screen.findByTestId('turnierlogo-fehler')).toHaveTextContent('Erlaubt sind PNG, JPG und SVG.');
    expect(screen.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', dataUrl('TElOS1M='));
    expect((await gespeichert()).left?.dataUrl).toBe(dataUrl('TElOS1M='));
    await fertig();
  });

  it('Gegenbeispiel: keine Datei (Text gezogen): Grund wird genannt, nichts gespeichert', async () => {
    zeige();
    await screen.findByTestId('turnierlogo-hochladen');

    fireEvent.drop(screen.getByTestId('turnierlogo-feld'), { dataTransfer: { types: ['text/plain'], files: [], dropEffect: 'none' } });

    expect(await screen.findByTestId('turnierlogo-fehler')).toHaveTextContent('Bitte eine Bilddatei');
    expect(prepareMock).not.toHaveBeenCalled();
    expect(memory.data.size).toBe(0);
  });

  it('die Taste „Logo hochladen“ und das Dateifeld bleiben, die Dateiwahl wirkt wie zuvor', async () => {
    prepareMock.mockResolvedValue(ok('TElOS1M='));
    zeige();
    expect(await screen.findByTestId('turnierlogo-hochladen')).toHaveTextContent('Logo hochladen');

    fireEvent.change(screen.getByTestId('turnierlogo-datei'), { target: { files: [datei('wappen.png', 'image/png')] } });

    await screen.findByTestId('turnierlogo-vorschau');
  });
});
