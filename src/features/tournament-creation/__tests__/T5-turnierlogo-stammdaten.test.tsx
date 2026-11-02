/**
 * T5 (PDF-Paket PR 2): Turnierlogo und zweite Grafik im Assistenten, Schritt 1 „Stammdaten“.
 * Gherkin: @W3-040 (Logo hochladen: Logo, Tupfer „Farbe für Spielplan und Aushang“, Tupfer nicht bedienbar, ohne Logo
 * weiter mit App-Grün, Hinweis „nur auf diesem Gerät“), @W3-030 (Grund bei abgelehnter Datei, Logo bleibt),
 * @DR-040 (Warnung unter 236 Bildpunkten), @DR-041 (Akzent nur aus dem Logo links).
 *
 * Echter Gerätespeicher (`tournamentGraphicsStore`) auf Speicher im Arbeitsspeicher; nur das Aufbereiten im Browser
 * (Canvas) ist ersetzt – es hat seine Tests in prepareTournamentGraphic.test.ts und tests/e2e/turnierlogo-pdf.spec.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { IStorageAdapter } from '../../../core/storage/IStorageAdapter';
import type { PrepareOptions, PrepareResult } from '../../../lib/images/prepareTournamentGraphic';
import { cssVars } from '../../../design-tokens';
import { printAccent } from '../../../design-tokens/print';
import { printHeader } from '../../../design-tokens/print-header';
import i18nDe from 'i18next';
import { setI18n } from 'react-i18next';
import { createRealI18n } from '../../../test/realI18n';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

// LocationForm/ContactForm brauchen einen RepositoryProvider; sie sind hier nicht Gegenstand.
vi.mock('../../../components/LocationForm', () => ({ LocationForm: () => null }));
vi.mock('../../../components/ContactForm', () => ({ ContactForm: () => null }));

const memory = vi.hoisted(() => ({ data: new Map<string, unknown>(), failSet: false, failGet: 0 }));
vi.mock('../../../core/storage/StorageFactory', () => ({
  createStorage: (): Promise<IStorageAdapter> => Promise.resolve({
    get: <T,>(key: string) => {
      if (memory.failGet > 0) { memory.failGet -= 1; return Promise.reject(new StorageError('Lesen fehlgeschlagen', new Error('UnknownError'))); }
      return Promise.resolve((memory.data.has(key) ? structuredClone(memory.data.get(key)) : null) as T | null);
    },
    set: <T,>(key: string, value: T) => {
      if (memory.failSet) { return Promise.reject(new Error('QuotaExceededError')); }
      memory.data.set(key, structuredClone(value)); return Promise.resolve();
    },
    delete: (key: string) => { memory.data.delete(key); return Promise.resolve(); },
    clear: () => { memory.data.clear(); return Promise.resolve(); },
    keys: () => Promise.resolve([...memory.data.keys()]),
  }),
}));

const prepareMock = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/images/prepareTournamentGraphic', () => ({ prepareTournamentGraphic: prepareMock }));

import { Step3_Metadata } from '../Step3_Metadata';
import { tournamentGraphicsStore } from '../../../core/storage/tournamentGraphicsStore';
import { StorageError } from '../../../core/storage/StorageError';

const BLAU = '#2A2576';
const GRUEN_APP = printAccent.fallback;
const dataUrl = (seed: string): string => `data:image/png;base64,${seed}`;
const ok = (seed: string, originalHeightPx = 600, accent?: string): PrepareResult => ({
  ok: true,
  graphic: { dataUrl: dataUrl(seed), widthPx: 600, heightPx: 600, originalHeightPx },
  warnLowRes: originalHeightPx < printHeader.logoWarnBelowHeightPx,
  ...(accent === undefined ? {} : { accent }),
});

/** Wie der echte Aufbereiter: der Akzent kommt nur, wenn der Aufrufer ihn anfordert (nur linke Grafik). */
function prepareAnswers(...answers: Array<PrepareResult & { accentIfAsked?: string }>): void {
  prepareMock.mockReset();
  for (const answer of answers) {
    prepareMock.mockImplementationOnce((_file: File, options: PrepareOptions = {}) => {
      if (!answer.ok) { return Promise.resolve(answer); }
      const { accentIfAsked, ...rest } = answer;
      return Promise.resolve(options.computeAccent === true && accentIfAsked !== undefined ? { ...rest, accent: accentIfAsked } : rest);
    });
  }
}
const mitAkzent = (result: PrepareResult, accent: string): PrepareResult & { accentIfAsked: string } => ({ ...result, accentIfAsked: accent });

const TURNIER_ID = 'turnier-t5';
const datei = (name = 'wappen.png', type = 'image/png'): File => new File(['x'], name, { type });

function zeige(id: string | undefined = TURNIER_ID) {
  const formData = { id, title: 'Nikolaus-Turnier', organizer: 'TSV Waging' } as unknown as Partial<Tournament>;
  return render(<Step3_Metadata formData={formData} onUpdate={vi.fn()} />);
}
const waehle = async (prefix: 'turnierlogo' | 'zweite-grafik', file = datei()): Promise<void> => {
  fireEvent.change(await screen.findByTestId(`${prefix}-datei`), { target: { files: [file] } });
  // warten, bis die Aufbereitung durch ist (die Tasten sind währenddessen aria-busy)
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
};
const tupfer = (): HTMLElement => screen.getByTestId('akzent-tupfer');
const gespeichert = () => tournamentGraphicsStore.load(TURNIER_ID);

beforeEach(() => { memory.data.clear(); memory.failSet = false; memory.failGet = 0; prepareMock.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe('@W3-040 Turnierlogo in den Stammdaten', () => {
  it('@W3-040 Tupfer zeigt den Akzent aus dem Logo, mit Farbname und „Farbe für Spielplan und Aushang“', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();

    await waehle('turnierlogo');

    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));
    expect(screen.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', dataUrl('TElOS1M='));
    expect(screen.getByTestId('akzent-name')).toHaveTextContent('Blau');
    expect(screen.getByTestId('turnierlogo-feld')).toHaveTextContent('Farbe für Spielplan und Aushang');
    expect(tupfer()).toHaveAccessibleName('Farbe für Spielplan und Aushang: Blau');
    expect(await gespeichert()).toMatchObject({ left: { dataUrl: dataUrl('TElOS1M=') }, accent: BLAU });
  });

  it('@W3-040 der Farbname steht in lesbarer Schrift (Token md, nicht das kleinere „small“ des Browsers; visual:metrics schrift.min-ziel)', async () => {
    zeige();

    await screen.findByTestId('turnierlogo-hochladen');

    expect(screen.getByTestId('akzent-name').style.fontSize).toBe(cssVars.fontSizes.md);
  });

  it('@W3-040 Tupfer ist nicht bedienbar: kein Knopf, keine Rolle button, tabIndex −1, ein Klick ändert nichts', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();
    await waehle('turnierlogo');
    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));
    const vorher = await gespeichert();

    const punkt = tupfer();
    fireEvent.click(punkt);
    fireEvent.keyDown(punkt, { key: 'Enter' });

    expect(punkt.tagName).not.toBe('BUTTON');
    expect(screen.queryByRole('button', { name: /Farbe für Spielplan/ })).toBeNull();
    expect(punkt.tabIndex).toBe(-1);
    expect(punkt).toHaveAttribute('data-accent', BLAU);
    expect(await gespeichert()).toEqual(vorher);
  });

  it('@W3-040 ohne Logo weiter: Tupfer zeigt das Grün der App, keine Meldung, nichts gespeichert', async () => {
    zeige();

    await screen.findByTestId('turnierlogo-hochladen');

    expect(tupfer()).toHaveAttribute('data-accent', GRUEN_APP);
    expect(screen.getByTestId('akzent-name')).toHaveTextContent('Grün der App');
    expect(screen.queryByTestId('turnierlogo-vorschau')).toBeNull();
    expect(screen.queryByTestId('turnierlogo-warnung')).toBeNull();
    expect(screen.queryByTestId('turnierlogo-fehler')).toBeNull();
    expect(memory.data.size).toBe(0);
  });

  it('@W3-040 Gegenbeispiel: ein Logo ohne brauchbare Farbe (weiß auf durchsichtig) lässt den Tupfer im Grün der App', async () => {
    prepareAnswers(ok('V0VJU1M=')); // kein Akzent
    zeige();

    await waehle('turnierlogo');

    await screen.findByTestId('turnierlogo-vorschau');
    expect(tupfer()).toHaveAttribute('data-accent', GRUEN_APP);
    expect(screen.getByTestId('akzent-name')).toHaveTextContent('Grün der App');
  });

  it('@W3-040 Entfernen → Tupfer wieder im Grün der App, Eintrag im Gerätespeicher weg', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();
    await waehle('turnierlogo');
    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));

    fireEvent.click(screen.getByTestId('turnierlogo-entfernen'));

    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', GRUEN_APP));
    expect(screen.queryByTestId('turnierlogo-vorschau')).toBeNull();
    expect(screen.getByTestId('turnierlogo-hochladen')).toBeInTheDocument();
    expect(await gespeichert()).toEqual({});
  });

  it('@W3-040 Entfernen des Logos lässt die zweite Grafik stehen (Gegenbeispiel)', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU), ok('UkVDSFRT'));
    zeige();
    await waehle('turnierlogo');
    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));
    await waehle('zweite-grafik');
    await screen.findByTestId('zweite-grafik-vorschau');

    fireEvent.click(screen.getByTestId('turnierlogo-entfernen'));

    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', GRUEN_APP));
    expect(screen.getByTestId('zweite-grafik-vorschau')).toHaveAttribute('src', dataUrl('UkVDSFRT'));
    expect(await gespeichert()).toEqual({ right: expect.objectContaining({ dataUrl: dataUrl('UkVDSFRT') }) });
  });

  it('@W3-040 Entfernen der zweiten Grafik lässt Logo und Tupfer stehen (Gegenbeispiel)', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU), ok('UkVDSFRT'));
    zeige();
    await waehle('turnierlogo');
    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));
    await waehle('zweite-grafik');
    await screen.findByTestId('zweite-grafik-vorschau');

    fireEvent.click(screen.getByTestId('zweite-grafik-entfernen'));

    await waitFor(() => expect(screen.queryByTestId('zweite-grafik-vorschau')).toBeNull());
    expect(tupfer()).toHaveAttribute('data-accent', BLAU);
    expect(screen.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', dataUrl('TElOS1M='));
    expect(await gespeichert()).toEqual({ left: expect.objectContaining({ dataUrl: dataUrl('TElOS1M=') }), accent: BLAU });
  });

  it('@W3-040 Hinweis „Nur auf diesem Gerät gespeichert. …“ steht unter dem Logo-Feld, nicht unter der zweiten Grafik (F1)', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();
    await waehle('turnierlogo');
    await screen.findByTestId('turnierlogo-vorschau');

    const hinweis = within(screen.getByTestId('turnierlogo-feld')).getByTestId('turnierlogo-geraet');
    expect(hinweis).toHaveTextContent('Nur auf diesem Gerät gespeichert. Ausdrucke von anderen Geräten erscheinen ohne Logo.');
    expect(screen.getByTestId('turnierlogo-entfernen').compareDocumentPosition(hinweis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(screen.getByTestId('zweite-grafik-feld')).queryByTestId('turnierlogo-geraet')).toBeNull();
    expect(screen.getAllByText(/Nur auf diesem Gerät gespeichert/)).toHaveLength(1);
  });

  it('@W3-040 beide Felder stehen im Schritt nach „Veranstalter“, das Logo zuerst', async () => {
    zeige();
    const veranstalter = screen.getByLabelText(/Veranstalter/);
    const logo = await screen.findByTestId('turnierlogo-feld');
    const zweite = screen.getByTestId('zweite-grafik-feld');

    expect(veranstalter.compareDocumentPosition(logo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(logo.compareDocumentPosition(zweite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('@W3-030 / @DR-040 Prüfung beim Hochladen', () => {
  it('@DR-040 Warnung sichtbar bei 141 Bildpunkten Höhe, das Logo wird trotzdem übernommen', async () => {
    prepareAnswers(mitAkzent(ok('S0xFSU4=', 141), BLAU));
    zeige();

    await waehle('turnierlogo');

    const warnung = await screen.findByTestId('turnierlogo-warnung');
    expect(warnung).toHaveTextContent('Das Logo ist nur 141 Bildpunkte hoch und kann im Druck unscharf wirken.');
    expect(warnung).toHaveTextContent('Empfohlen sind mindestens 236 Bildpunkte Höhe.');
    expect(screen.getByTestId('turnierlogo-vorschau')).toBeInTheDocument();
    expect((await gespeichert()).left?.originalHeightPx).toBe(141);
  });

  it.each([[235, true], [236, false]])('@DR-040 Grenze: %i Bildpunkte → Warnung %s', async (hoehe, warnt) => {
    prepareAnswers(ok('R1JFTlpF', hoehe));
    zeige();

    await waehle('turnierlogo');

    await screen.findByTestId('turnierlogo-vorschau');
    expect(screen.queryByTestId('turnierlogo-warnung') !== null).toBe(warnt);
  });

  it('@DR-040 die Warnung bleibt nach dem Neuladen des Schritts (sie kommt aus dem gespeicherten Original)', async () => {
    prepareAnswers(ok('S0xFSU4=', 141));
    const ersteAnsicht = zeige();
    await waehle('turnierlogo');
    await screen.findByTestId('turnierlogo-warnung');
    ersteAnsicht.unmount();

    zeige();

    expect(await screen.findByTestId('turnierlogo-warnung')).toHaveTextContent('141 Bildpunkte');
  });

  it('@DR-040 die Warnung der zweiten Grafik steht an der zweiten Grafik und nennt sie', async () => {
    prepareAnswers(ok('U1BPTlNPUg==', 141));
    zeige();

    await waehle('zweite-grafik');

    const warnung = await screen.findByTestId('zweite-grafik-warnung');
    expect(warnung).toHaveTextContent('Die Grafik ist nur 141 Bildpunkte hoch');
    expect(screen.queryByTestId('turnierlogo-warnung')).toBeNull();
  });

  it.each([
    ['type', /Erlaubt sind PNG, JPG und SVG/],
    ['unreadable', /weil sie sich nicht lesen lässt oder beschädigt ist/],
  ] as const)('@W3-030 abgelehnte Datei, Grund „%s“: der Text nennt den Grund', async (reason, text) => {
    prepareAnswers({ ok: false, reason });
    zeige();

    await waehle('turnierlogo', datei('notiz.txt', 'text/plain'));

    const fehler = await screen.findByTestId('turnierlogo-fehler');
    expect(fehler).toHaveTextContent(/^Diese Datei wurde nicht übernommen/);
    expect(fehler).toHaveTextContent(text);
    expect(fehler).toHaveAttribute('role', 'alert');
  });

  it('@W3-030 Grund „Größe“ nennt beide Grenzen: 2 MB und 4000 Bildpunkte an einer Seite', async () => {
    prepareAnswers({ ok: false, reason: 'size' });
    zeige();

    await waehle('turnierlogo');

    const fehler = await screen.findByTestId('turnierlogo-fehler');
    expect(fehler).toHaveTextContent('Die Datei ist größer als 2 MB oder hat zu viele Bildpunkte (mehr als 4.000 an einer Seite).');
  });

  it('@W3-030 EN: Grund „Größe“ nennt 2 MB und 4,000 pixels, die Hinweise stehen auf Englisch', async () => {
    const en = await createRealI18n('en'); // setzt die Instanz von react-i18next; danach zurück auf die deutsche
    try {
      prepareAnswers({ ok: false, reason: 'size' });
      const formData = { id: TURNIER_ID, title: 'Nikolaus-Turnier' } as unknown as Partial<Tournament>;
      render(<Step3_Metadata formData={formData} onUpdate={vi.fn()} />);

      await waehle('turnierlogo');

      expect(await screen.findByTestId('turnierlogo-fehler')).toHaveTextContent('It is larger than 2 MB or has too many pixels (more than 4,000 on one side).');
      expect(screen.getByTestId('turnierlogo-geraet')).toHaveTextContent('Saved on this device only. Printouts from other devices appear without a logo.');
      expect(screen.getByTestId('akzent-name')).toHaveTextContent('App green');
      expect(tupfer()).toHaveAccessibleName('Color for schedule and poster: App green');
      expect(en.language).toBe('en');
    } finally {
      setI18n(i18nDe);
    }
  });

  it('@W3-030 ungültige Datei bei vorhandenem Logo: Logo und Tupfer bleiben, der Eintrag im Speicher auch', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU), { ok: false, reason: 'size' });
    zeige();
    await waehle('turnierlogo');
    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));
    const vorher = await gespeichert();

    await waehle('turnierlogo', datei('riesig.png'));

    const fehler = await screen.findByTestId('turnierlogo-fehler');
    expect(fehler).toHaveTextContent('Das bisherige Logo bleibt.');
    expect(screen.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', dataUrl('TElOS1M='));
    expect(tupfer()).toHaveAttribute('data-accent', BLAU);
    expect(await gespeichert()).toEqual(vorher);
  });

  it('@W3-030 der Fehler verschwindet, sobald eine gültige Datei folgt', async () => {
    prepareAnswers({ ok: false, reason: 'type' }, mitAkzent(ok('TElOS1M='), BLAU));
    zeige();
    await waehle('turnierlogo');
    await screen.findByTestId('turnierlogo-fehler');

    await waehle('turnierlogo');

    await waitFor(() => expect(screen.queryByTestId('turnierlogo-fehler')).toBeNull());
    expect(tupfer()).toHaveAttribute('data-accent', BLAU);
  });

  it('@W3-030 Speicher voll: der Fehler steht am Feld, der gespeicherte Stand bleibt (nichts wird verschluckt)', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();
    await screen.findByTestId('turnierlogo-hochladen');
    memory.failSet = true;

    await waehle('turnierlogo');

    const fehler = await screen.findByTestId('turnierlogo-fehler');
    expect(fehler).toHaveTextContent('konnte auf diesem Gerät nicht gespeichert werden');
    expect(screen.queryByTestId('turnierlogo-vorschau')).toBeNull();
    expect(tupfer()).toHaveAttribute('data-accent', GRUEN_APP);
  });
});

describe('@DR-024 Gerätespeicher nicht lesbar: die App sagt es, nichts geht still verloren', () => {
  it('@DR-024 Lesefehler beim Laden (kein beschädigter Eintrag): der Hinweis steht am Logo-Feld, die Felder bleiben bedienbar', async () => {
    memory.failGet = 1;

    zeige();

    expect(await screen.findByTestId('turnierlogo-fehler')).toHaveTextContent('Die gespeicherten Grafiken konnten auf diesem Gerät nicht geladen werden.');
    expect(screen.getByTestId('turnierlogo-hochladen')).toBeEnabled(); // der Assistent bleibt benutzbar, „Weiter“ ist nicht gesperrt
    expect(screen.getByTestId('zweite-grafik-hochladen')).toBeEnabled();
    expect(screen.getByLabelText(/Turniername/)).toBeInTheDocument();
  });

  it('Gegenbeispiel: ein Eintrag ohne gültige Form ist kein Ladefehler, es gibt keine Meldung', async () => {
    memory.data.set(`tournament-graphics-${TURNIER_ID}`, 'kaputt'); // passt nicht zum Schema → leer, ohne Fehler

    zeige();

    await screen.findByTestId('turnierlogo-hochladen');
    expect(screen.queryByTestId('turnierlogo-fehler')).toBeNull();
  });

  it('nach einem Ladefehler überschreibt ein Logo-Upload eine vorhandene zweite Grafik nicht still', async () => {
    const rechts = { dataUrl: dataUrl('UkVDSFRT'), widthPx: 10, heightPx: 10, originalHeightPx: 600 };
    memory.data.set(`tournament-graphics-${TURNIER_ID}`, { right: rechts });
    memory.failGet = 1; // nur das Laden beim Öffnen scheitert
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();
    await screen.findByTestId('turnierlogo-fehler');
    expect(screen.queryByTestId('zweite-grafik-vorschau')).toBeNull();

    await waehle('turnierlogo');

    expect(await screen.findByTestId('turnierlogo-vorschau')).toHaveAttribute('src', dataUrl('TElOS1M='));
    expect(await screen.findByTestId('zweite-grafik-vorschau')).toHaveAttribute('src', dataUrl('UkVDSFRT'));
    const stand = await gespeichert();
    expect(stand.left?.dataUrl).toBe(dataUrl('TElOS1M='));
    expect(stand.right?.dataUrl).toBe(dataUrl('UkVDSFRT'));
  });

  it('Gegenbeispiel: lässt sich der Stand auch beim Speichern nicht lesen, wird nichts überschrieben und der Ladefehler steht da', async () => {
    const rechts = { dataUrl: dataUrl('UkVDSFRT'), widthPx: 10, heightPx: 10, originalHeightPx: 600 };
    memory.data.set(`tournament-graphics-${TURNIER_ID}`, { right: rechts });
    memory.failGet = 2; // beim Öffnen und noch einmal vor dem Speichern
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();
    await screen.findByTestId('turnierlogo-fehler');

    await waehle('turnierlogo');

    expect(await screen.findByTestId('turnierlogo-fehler')).toHaveTextContent('nicht geladen werden');
    expect(screen.queryByTestId('turnierlogo-vorschau')).toBeNull();
    const stand = await gespeichert();
    expect(stand.right?.dataUrl).toBe(dataUrl('UkVDSFRT')); // unverändert
    expect(stand.left).toBeUndefined();
  });
});

describe('@DR-041 Der Akzent kommt nur vom Logo links', () => {
  it('@DR-041 nur rechte Grafik: Tupfer bleibt Grün der App, der Aufbereiter rechnet dafür keinen Akzent', async () => {
    prepareAnswers(mitAkzent(ok('U1BPTlNPUg=='), '#B91C1C'));
    zeige();

    await waehle('zweite-grafik');

    await screen.findByTestId('zweite-grafik-vorschau');
    expect(prepareMock.mock.calls[0]?.[1]?.computeAccent ?? false).toBe(false);
    expect(tupfer()).toHaveAttribute('data-accent', GRUEN_APP);
    expect(screen.getByTestId('akzent-name')).toHaveTextContent('Grün der App');
    expect((await gespeichert()).accent).toBeUndefined();
  });

  it('@DR-041 Gegenbeispiel: die zweite Grafik ändert den Tupfer nicht, wenn links schon ein Logo steht', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU), mitAkzent(ok('U1BPTlNPUg=='), '#B91C1C'));
    zeige();
    await waehle('turnierlogo');
    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));

    await waehle('zweite-grafik');
    await screen.findByTestId('zweite-grafik-vorschau');

    expect(tupfer()).toHaveAttribute('data-accent', BLAU);
    expect(screen.getByTestId('akzent-name')).toHaveTextContent('Blau');
    expect((await gespeichert()).accent).toBe(BLAU);
  });

  it('@DR-041 Gegenbeispiel: meldet der Aufbereiter für die rechte Grafik trotzdem eine Farbe, bleibt der Tupfer bei der des Logos', async () => {
    prepareMock.mockReset();
    prepareMock.mockResolvedValueOnce(ok('TElOS1M=', 600, BLAU)).mockResolvedValueOnce(ok('U1BPTlNPUg==', 600, '#B91C1C'));
    zeige();
    await waehle('turnierlogo');
    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));

    await waehle('zweite-grafik');
    await screen.findByTestId('zweite-grafik-vorschau');

    expect(tupfer()).toHaveAttribute('data-accent', BLAU);
    expect((await gespeichert()).accent).toBe(BLAU);
  });

  it('@DR-041 Gegenbeispiel: eine abgelehnte zweite Grafik lässt Logo, Tupfer und zweite Grafik stehen', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU), ok('UkVDSFRT'), { ok: false, reason: 'type' });
    zeige();
    await waehle('turnierlogo');
    await waehle('zweite-grafik');
    await screen.findByTestId('zweite-grafik-vorschau');

    await waehle('zweite-grafik', datei('x.gif', 'image/gif'));

    expect(await screen.findByTestId('zweite-grafik-fehler')).toHaveTextContent('Die bisherige Grafik bleibt.');
    expect(screen.getByTestId('zweite-grafik-vorschau')).toHaveAttribute('src', dataUrl('UkVDSFRT'));
    expect(screen.queryByTestId('turnierlogo-fehler')).toBeNull();
    expect(tupfer()).toHaveAttribute('data-accent', BLAU);
  });

  it('@DR-041 ein neues Logo ersetzt den Akzent; ohne brauchbare Farbe fällt er auf das Grün der App zurück', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU), ok('V0VJU1M='));
    zeige();
    await waehle('turnierlogo');
    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));

    await waehle('turnierlogo');

    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', GRUEN_APP));
    expect((await gespeichert()).accent).toBeUndefined();
  });
});

describe('@W3-030 Gerätespeicher: unter der Turnier-ID des Entwurfs, dauerhaft angefragt', () => {
  it('Neuladen: derselbe Entwurf zeigt Logo und Tupfer wieder; ein anderes Turnier zeigt sie nicht', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU), ok('UkVDSFRT'));
    const ersteAnsicht = zeige();
    await waehle('turnierlogo');
    await waehle('zweite-grafik');
    await screen.findByTestId('zweite-grafik-vorschau');
    ersteAnsicht.unmount();

    const neu = zeige();
    expect(await screen.findByTestId('turnierlogo-vorschau')).toHaveAttribute('src', dataUrl('TElOS1M='));
    expect(tupfer()).toHaveAttribute('data-accent', BLAU);
    expect(screen.getByTestId('zweite-grafik-vorschau')).toHaveAttribute('src', dataUrl('UkVDSFRT'));
    neu.unmount();

    zeige('anderes-turnier');
    await screen.findByTestId('turnierlogo-hochladen');
    expect(screen.queryByTestId('turnierlogo-vorschau')).toBeNull();
    expect(tupfer()).toHaveAttribute('data-accent', GRUEN_APP);
  });

  it('gespeichert wird unter tournament-graphics-<Turnier-ID> und sonst nirgends', async () => {
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();

    await waehle('turnierlogo');
    await waitFor(() => expect(memory.data.size).toBe(1));

    expect([...memory.data.keys()]).toEqual([`tournament-graphics-${TURNIER_ID}`]);
  });

  it('R8: beim ersten Speichern einer Grafik fragt die App navigator.storage.persist() an, beim zweiten nicht mehr', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', { ...navigator, storage: { persist } });
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU), ok('UkVDSFRT'));
    zeige();

    await waehle('turnierlogo');
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    await waehle('zweite-grafik');
    await screen.findByTestId('zweite-grafik-vorschau');

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('R8 Gegenbeispiel: eine abgelehnte Datei löst keine Anfrage aus', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', { ...navigator, storage: { persist } });
    prepareAnswers({ ok: false, reason: 'type' });
    zeige();

    await waehle('turnierlogo');
    await screen.findByTestId('turnierlogo-fehler');

    expect(persist).not.toHaveBeenCalled();
  });

  it('R8 Gegenbeispiel: lehnt der Browser ab oder wirft er, wird die Grafik trotzdem gespeichert', async () => {
    vi.stubGlobal('navigator', { ...navigator, storage: { persist: () => Promise.reject(new Error('gesperrt')) } });
    prepareAnswers(mitAkzent(ok('TElOS1M='), BLAU));
    zeige();

    await waehle('turnierlogo');

    await waitFor(() => expect(tupfer()).toHaveAttribute('data-accent', BLAU));
    expect(screen.queryByTestId('turnierlogo-fehler')).toBeNull();
  });
});
