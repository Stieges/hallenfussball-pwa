/**
 * H4-11 Zeile „Ausgang“ in „Dieses Gerät“ (@HT-053, @HT-054, @HT-055): Erwartungen aus dem Gherkin, nicht am Code abgelesen. Der echte Hook
 * `useHallAusgang` mit gefälschten `mediaDevices` und `AudioContext` (Test-Doppel aus H4-6); Texte aus den echten Sprachdateien.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import { FalscheMedienGeraete, type FalscherAusgang } from '../../../../test/hallenton/falscheMedienGeraete';
import { FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';
import { __setzeGeraetFuerTests } from '../../lautsprecherGeraet';
import { erzeugeAusgangListe } from '../../runtime/ausgang/ausgangListe';
import { erzeugeAusgangWaechter } from '../../runtime/ausgang/ausgangWaechter';
import { AUSGANG_SCHLUESSEL, erzeugeAusgangWahl } from '../../runtime/ausgang/ausgangWahl';
import { __setzeAusgangFuerTests } from '../../runtime/ausgang/browserAusgang';
import type { HallTonSpieler } from '../../runtime/hallTonSpieler';
import { useHallAusgang } from '../../useHallAusgang';
import { AusgangZeile } from '../AusgangZeile';
import { TesttonHalleKontext } from '../TesttonHalleKontext';
import type { TesttonHalle } from '../useTesttonHalle';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de' },
    t: (key: string, opts?: Record<string, unknown>) => {
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], de);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));

// Wie im Mockup (Hallencup Süd, sechs Ausgänge); die Kennungen sind absichtlich ungewöhnlich, damit der Attribut-Scan sie findet
const AUSGAENGE: readonly FalscherAusgang[] = [
  { id: 'default', name: 'Standard - MacBook Pro-Lautsprecher', gruppe: 'gruppe-mac-7f3a' },
  { id: 'kennung-dock-91c2', name: 'ThinkPad Thunderbolt 3 Dock USB Audio', gruppe: 'gruppe-dock-44b1' },
  { id: 'kennung-mac-17d0', name: 'MacBook Pro-Lautsprecher', gruppe: 'gruppe-mac-7f3a' },
  { id: 'kennung-poly-52e8', name: 'Poly VFOCUS2 Series (Bluetooth)', gruppe: 'gruppe-poly-0a9c' },
  { id: 'kennung-lg-83b6', name: 'LG Ultra HD (DisplayPort)', gruppe: 'gruppe-lg-6d25' },
  { id: 'kennung-teams-2c71', name: 'Microsoft Teams Audio Device (Virtual)', gruppe: 'gruppe-teams-b840' },
];
const DOCK = AUSGAENGE[1];
let medien: FalscheMedienGeraete;
let speicher: FalscherSpeicher;
let aktivieren: ReturnType<typeof vi.fn>;
const ausloesenMock = vi.fn<(feld: number) => void>();
let testton: TesttonHalle;

function baue(): void {
  const liste = erzeugeAusgangListe({ geraete: medien, berechtigungen: medien });
  const wahl = erzeugeAusgangWahl({ speicher, seite: null });
  __setzeAusgangFuerTests({ liste, wahl, waechter: erzeugeAusgangWaechter({ liste, wahl }) });
}

function Zeile({ darf = true }: { darf?: boolean }) {
  const ausgang = useHallAusgang();
  return (
    <TesttonHalleKontext.Provider value={testton}>
      <AusgangZeile ausgang={ausgang} darfAendern={darf} felder={[1]} />
    </TesttonHalleKontext.Provider>
  );
}

const mitSetSinkId = class { setSinkId(): Promise<void> { return Promise.resolve(); } };
const ohneSetSinkId = class { resume(): Promise<void> { return Promise.resolve(); } };
const fertig = async (): Promise<void> => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => {
  medien = new FalscheMedienGeraete(AUSGAENGE);
  speicher = new FalscherSpeicher();
  aktivieren = vi.fn(() => Promise.resolve(true));
  ausloesenMock.mockClear();
  testton = { ergebnisse: {}, ausloesen: (feld) => { ausloesenMock(feld); } };
  __setzeGeraetFuerTests({ spieler: { aktivieren } as unknown as HallTonSpieler });
  vi.stubGlobal('AudioContext', mitSetSinkId);
  baue();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __setzeAusgangFuerTests(null);
  __setzeGeraetFuerTests();
});

describe('@HT-053 Rückwärtsverträglichkeit: ohne gespeicherte Wahl fragt die Oberfläche den Browser nie, solange niemand „Ändern“ tippt', () => {
  it('Unterpunkt öffnen (Zeile eingebunden, Neuzeichnen, Warten) → 0 Aufrufe von enumerateDevices, permissions.query, Mikrofon, setSinkId; die Zeile zeigt „Standard (Ausgang des Systems)“ und „Ändern“', async () => {
    render(<Zeile />);
    await fertig();
    expect(screen.getByTestId('ausgang-zeile')).toHaveTextContent('Ausgang: Standard (Ausgang des Systems)');
    expect(screen.getByTestId('ausgang-aendern')).toHaveTextContent('Ändern');
    expect(medien.leseAufrufe).toBe(0);
    expect(medien.erlaubnisAbfragen).toBe(0);
    expect(medien.mikrofonAnfragen).toBe(0);
    expect(screen.queryByTestId('ausgang-liste')).toBeNull();
    expect(screen.queryByTestId('ausgang-mikrofon-hinweis')).toBeNull();
  });

  it('der Hook allein (Einbinden, Neuzeichnen) liest nichts: ohne Wahl 0 Aufrufe, erst `lesen()` fragt den Browser – auch dann ohne Mikrofon-Dialog', async () => {
    const { result, rerender } = renderHook(() => useHallAusgang());
    await fertig();
    rerender();
    expect(result.current).toMatchObject({ verfuegbar: true, gewaehlt: null, liste: [], zustand: 'standard' });
    expect(medien.leseAufrufe + medien.erlaubnisAbfragen + medien.mikrofonAnfragen).toBe(0);
    await act(async () => { await result.current.lesen(); });
    expect(medien.leseAufrufe).toBeGreaterThan(0);
    expect(medien.mikrofonAnfragen).toBe(0);
  });

  it('erst „Ändern“ liest die Liste – ohne Mikrofon-Dialog; das Mikrofon fragt erst der Tipp auf „Mikrofon erlauben“', async () => {
    render(<Zeile />);
    await fertig();
    fireEvent.click(screen.getByTestId('ausgang-aendern'));
    await fertig();
    expect(medien.leseAufrufe).toBeGreaterThan(0);
    expect(medien.mikrofonAnfragen).toBe(0);
    expect(screen.getByTestId('ausgang-liste')).toBeVisible();
    fireEvent.click(screen.getByTestId('mikrofon-erlauben'));
    await fertig();
    expect(medien.mikrofonAnfragen).toBe(1);
  });
});

describe('@HT-053 Ausgang wählen', () => {
  it('Zeile 1: Mikrofon nicht freigegeben → nur „Standard (Ausgang des Systems)“ und der Satz „Für die Liste aller Ausgänge einmal das Mikrofon erlauben – es wird nichts aufgenommen“ mit der Taste', async () => {
    render(<Zeile />);
    fireEvent.click(screen.getByTestId('ausgang-aendern'));
    await fertig();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio')).toHaveTextContent('Standard (Ausgang des Systems)');
    const hinweis = screen.getByTestId('ausgang-mikrofon-hinweis');
    expect(hinweis).toHaveTextContent('Für die Liste aller Ausgänge einmal das Mikrofon erlauben – es wird nichts aufgenommen');
    expect(hinweis).toHaveTextContent('Bei Besuchen dieser Website erlauben'); // Empfehlung vor der Freigabe (G2)
    expect(screen.getByTestId('mikrofon-erlauben')).toHaveTextContent('Mikrofon erlauben');
  });

  it('Zeile 2: Mikrofon einmal erlaubt → alle Ausgänge mit Namen, Standard zuerst, virtuelle am Ende mit „virtuell“, Bluetooth-Hinweis, das Mikrofon ist sofort wieder frei', async () => {
    render(<Zeile />);
    fireEvent.click(screen.getByTestId('ausgang-aendern'));
    fireEvent.click(screen.getByTestId('mikrofon-erlauben'));
    await fertig();
    const namen = screen.getAllByRole('radio').map((r) => r.textContent ?? '');
    expect(namen).toHaveLength(6); // Standard + fünf Ausgänge (der „default“ des Browsers ist die Wahl „Standard“)
    expect(namen[0]).toContain('Standard (Ausgang des Systems)');
    expect(namen[5]).toContain('Microsoft Teams Audio Device (Virtual)');
    expect(namen[5]).toContain('virtuell');
    expect(namen.join('|')).toContain('Bluetooth: Ton kann verzögert kommen – Kabel empfohlen');
    expect(medien.spuren.every((s) => s.gestoppt)).toBe(true);
    expect(screen.getByTestId('ausgang-mikrofon-frei')).toHaveTextContent('Das Mikrofon ist wieder frei. Es wurde nichts aufgenommen.');
    expect(screen.queryByTestId('mikrofon-erlauben')).toBeNull();
  });

  it('Zeile 3: Olli wählt „ThinkPad Thunderbolt 3 Dock USB Audio“ → die Wahl wird gespeichert (bleibt nach dem Neuladen), „gewählt“ steht daran, der Unterpunkt empfiehlt einen Testton; eingeklappt steht der Name mit „Ändern“', async () => {
    render(<Zeile />);
    fireEvent.click(screen.getByTestId('ausgang-aendern'));
    fireEvent.click(screen.getByTestId('mikrofon-erlauben'));
    await fertig();
    const dock = screen.getAllByRole('radio').find((r) => r.textContent?.includes('ThinkPad'));
    fireEvent.click(dock!);
    await fertig();
    expect(JSON.parse(speicher.getItem(AUSGANG_SCHLUESSEL) ?? 'null')).toEqual({ id: DOCK.id, name: DOCK.name, gruppe: DOCK.gruppe });
    expect(dock).toHaveAttribute('aria-checked', 'true');
    expect(dock).toHaveTextContent('gewählt');
    const empfehlung = screen.getByTestId('ausgang-testton-empfehlung');
    expect(empfehlung).toHaveTextContent('Testton empfohlen');
    expect(empfehlung).toHaveTextContent('Pflicht ist das nicht');
    fireEvent.click(screen.getByTestId('ausgang-testton'));
    expect(ausloesenMock).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId('ausgang-aendern')); // „Schließen“
    expect(screen.getByTestId('ausgang-name')).toHaveTextContent('ThinkPad Thunderbolt 3 Dock USB Audio');
    expect(screen.getByTestId('ausgang-aendern')).toHaveTextContent('Ändern');
  });

  it('Zeile 4: der Browser kann keinen Ausgang wählen → „Standard (Ausgang des Systems)“ ohne Wahl, mit dem Hinweis auf die Einstellungen des Systems; kein „Ändern“, nichts wird gelesen', async () => {
    vi.stubGlobal('AudioContext', ohneSetSinkId);
    render(<Zeile />);
    await fertig();
    expect(screen.getByTestId('ausgang-zeile')).toHaveTextContent('Standard (Ausgang des Systems)');
    expect(screen.getByTestId('ausgang-ohne-wahl')).toHaveTextContent('Dieser Browser kann den Ausgang nicht wählen. Lege den Ausgang in den Einstellungen des Systems fest.');
    expect(screen.queryByTestId('ausgang-aendern')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(medien.leseAufrufe).toBe(0);
    expect(medien.mikrofonAnfragen).toBe(0);
  });

  it('Zeile 6 (@HT-054): an der Auswahl steht „Wechsel wirkt sofort“', async () => {
    render(<Zeile />);
    fireEvent.click(screen.getByTestId('ausgang-aendern'));
    await fertig();
    expect(screen.getByTestId('ausgang-liste').parentElement).toHaveTextContent('Wechsel wirkt sofort');
  });

  it('nach der Wahl kein Pflicht-Dialog: die Wahl wirkt ohne Testton (der Testton blockiert nichts)', async () => {
    render(<Zeile />);
    fireEvent.click(screen.getByTestId('ausgang-aendern'));
    fireEvent.click(screen.getByTestId('mikrofon-erlauben'));
    await fertig();
    fireEvent.click(screen.getAllByRole('radio')[2]);
    await fertig();
    expect(ausloesenMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('@HT-054 Ausgang verloren', () => {
  it('das Dock gewählt und abgezogen → die Liste steht offen, der gewählte Ausgang bleibt mit „nicht verbunden“ stehen, dazu der Satz, dass aus den Lautsprechern des Laptops kein Hallenton kommt; „Standard“ ist wählbar', async () => {
    speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify({ id: DOCK.id, name: DOCK.name, gruppe: DOCK.gruppe }));
    medien.erlaubt = true;
    baue();
    render(<Zeile />);
    await fertig();
    await act(async () => { medien.abziehen(DOCK.id); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByTestId('ausgang-liste')).toBeVisible();
    const gewaehlt = screen.getAllByRole('radio').find((r) => r.getAttribute('data-fehlt') === 'true');
    expect(gewaehlt).toHaveTextContent('ThinkPad Thunderbolt 3 Dock USB Audio');
    expect(gewaehlt).toHaveTextContent('nicht verbunden');
    expect(screen.getByTestId('ausgang-verloren-hinweis')).toHaveTextContent('Aus den Lautsprechern des Laptops kommt kein Hallenton. Steckst du das Dock wieder an, tönt der Lautsprecher ohne neue Wahl wieder darüber. Oder wähle einen anderen Ausgang.');
    await act(async () => { medien.anstecken(DOCK); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.queryByTestId('ausgang-verloren-hinweis')).toBeNull();
  });
});

describe('@HT-055 Ausgang bestätigen', () => {
  beforeEach(() => {
    speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify({ id: DOCK.id, name: DOCK.name, gruppe: DOCK.gruppe }));
    medien.erlaubt = false; // neu geladen, „Nur dieses Mal“ ist vorbei
    baue();
  });

  it('Zeile 1: nach dem Neuladen steht die Taste „Ausgang bestätigen“ (auch eingeklappt); es wird nichts über „Standard“ gespielt (der Hook meldet unbestätigt) und kein Mikrofon-Dialog ohne Tipp', async () => {
    render(<Zeile />);
    await fertig();
    expect(screen.getByTestId('ausgang-bestaetigen-taste')).toHaveTextContent('Ausgang bestätigen');
    expect(screen.getByTestId('ausgang-zeile')).toHaveAttribute('data-offen', 'false');
    expect(medien.mikrofonAnfragen).toBe(0);
  });

  it('Zeile 2: „Ausgang bestätigen“ tippen und das Mikrofon erlauben → „Ton aktivieren“ und die Mikrofon-Frage starten im selben Tipp, danach gilt das Dock ohne neue Wahl, das Mikrofon ist frei, die Taste verschwindet', async () => {
    render(<Zeile />);
    await fertig();
    fireEvent.click(screen.getByTestId('ausgang-bestaetigen-taste'));
    expect(aktivieren).toHaveBeenCalledTimes(1);
    expect(medien.mikrofonAnfragen).toBe(1);
    await fertig();
    expect(medien.spuren.every((s) => s.gestoppt)).toBe(true);
    expect(screen.queryByTestId('ausgang-bestaetigen')).toBeNull();
    expect(screen.getByTestId('ausgang-name')).toHaveTextContent('ThinkPad Thunderbolt 3 Dock USB Audio');
  });

  it('Zeile 3: Mikrofon abgelehnt → „nicht bereit – Ausgang bestätigen“ bleibt, darunter steht „Oder ‚Standard‘ wählen“; die Taste wählt „Standard“', async () => {
    medien.ablehnen = true;
    render(<Zeile />);
    await fertig();
    expect(screen.queryByTestId('ausgang-oder-standard')).toBeNull();
    fireEvent.click(screen.getByTestId('ausgang-bestaetigen-taste'));
    await fertig();
    expect(screen.getByTestId('ausgang-bestaetigen')).toBeVisible();
    expect(screen.getByTestId('ausgang-oder-standard')).toHaveTextContent('Oder ‚Standard‘ wählen');
    fireEvent.click(screen.getByTestId('ausgang-oder-standard'));
    await fertig();
    expect(screen.queryByTestId('ausgang-bestaetigen')).toBeNull();
    expect(screen.getByTestId('ausgang-name')).toHaveTextContent('Standard (Ausgang des Systems)');
    expect(speicher.getItem(AUSGANG_SCHLUESSEL)).toBeNull();
  });

  it('Zeile 4: Mikrofon beim ersten Mal „bei Besuchen dieser Website“ erlaubt → nach dem Neuladen kein „Ausgang bestätigen“ nötig', async () => {
    medien.erlaubt = true;
    medien.dauerhaft = true;
    baue();
    render(<Zeile />);
    await fertig();
    expect(screen.queryByTestId('ausgang-bestaetigen')).toBeNull();
    expect(medien.mikrofonAnfragen).toBe(0);
  });

  it('nach dem Turnierende (nicht änderbar) gibt es weder „Ändern“ noch „Ausgang bestätigen“', async () => {
    render(<Zeile darf={false} />);
    await fertig();
    expect(screen.queryByTestId('ausgang-aendern')).toBeNull();
    expect(screen.queryByTestId('ausgang-bestaetigen-taste')).toBeNull();
  });
});

describe('Datenschutz: Name und Kennung eines Ausgangs stehen in keinem Attribut', () => {
  it('geöffnete Liste mit allen sechs Ausgängen, einem gewählten und einem fehlenden → in keinem Attribut (data-testid, id, aria-label, title, name, value …) steht ein Name oder eine Kennung; die Namen stehen nur als sichtbarer Text', async () => {
    speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify({ id: DOCK.id, name: DOCK.name, gruppe: DOCK.gruppe }));
    medien.erlaubt = true;
    baue();
    const { container } = render(<Zeile />);
    await fertig();
    fireEvent.click(screen.getByTestId('ausgang-aendern'));
    await fertig();
    await act(async () => { medien.abziehen(DOCK.id); await Promise.resolve(); await Promise.resolve(); }); // auch der fehlende Eintrag
    expect(container.querySelectorAll('[role="radio"]').length).toBeGreaterThanOrEqual(5);
    const geheim = AUSGAENGE.flatMap((a) => [a.id, a.name, a.gruppe]).filter((g) => g !== 'default');
    const attribute: string[] = [];
    for (const el of Array.from(container.querySelectorAll('*'))) {
      for (const a of Array.from(el.attributes)) {
        attribute.push(`${a.name}=${a.value}`);
      }
    }
    expect(attribute.length).toBeGreaterThan(20);
    for (const g of geheim) {
      expect(attribute.filter((a) => a.includes(g)), g).toEqual([]);
    }
    expect(container.textContent).toContain('ThinkPad Thunderbolt 3 Dock USB Audio'); // sichtbar bleibt der Name
    const ids = Array.from(container.querySelectorAll('[role="radio"]')).map((r) => r.getAttribute('data-testid'));
    expect(ids.every((i) => /^ausgang-wahl-\d+$/.test(i ?? ''))).toBe(true); // neutrale Kennungen (Position)
  });
});
