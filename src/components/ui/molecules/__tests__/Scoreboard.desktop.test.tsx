/**
 * Laptop-Tafel (Plan Cockpit v2 B1): Szenarien @SL-180 (Tafel wie Monitor: „Restzeit“ über der Uhr, Zeitbalken darunter, gespielte Zeit in der Kopfzeile,
 * „Live“ ohne rote Fläche), @SL-181 (Name klein über dem Kasten; unter 720 px nur „Heim“/„Gast“), @SL-182 (lange Namen brechen um, nie „…“),
 * @SL-183 (Einblendung in der Kopfzeile verdeckt nichts), @SL-179 (Doppelpunkt der Uhr unter dem der Kästen), @ZM-166 (Zeitbalken je Zustand, nie rot).
 * Texte kommen als Modell (kein i18n im Baustein); echte deutsche Texte für die Abzeichen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Scoreboard, type ScoreboardModel } from '../Scoreboard';
import { NoticeLine } from '../NoticeLine';
import { cssVars } from '../../../../design-tokens';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';

await initRealDeI18n();

const model = (aenderung: Partial<ScoreboardModel> = {}): ScoreboardModel => ({
  badge: { kind: 'badge', state: 'live' },
  links: { name: 'TSV Petting', label: 'Heim', tore: 2 }, rechts: { name: 'DJK Otting', label: 'Gast', tore: 0 },
  uhr: { rest: '5:54', gespielt: '4:06', label: 'Restzeit', unterzeile: 'Spielzeit 4:06', hervorgehoben: false, steht: false, schlussphase: false, balken: { anteil: 0.59, ton: 'gruen' } },
  abschnittText: '2. Halbzeit', kopfText: 'Spiel 3 · Feld 1 · 2. Halbzeit · Gespielt 4:06', hinweise: [],
  eintraegeWartenText: null, helferAnfragenText: null, ariaStand: 'TSV Petting 2, DJK Otting 0',
  ...aenderung,
});

const zeige = (m: ScoreboardModel, stufe: 'knapp' | 'normal' | 'gross' = 'normal', meldezeile: React.ReactNode = null) =>
  render(<Scoreboard model={m} size="wide" stufe={stufe} meldezeile={meldezeile} testId="scoreboard" />);

describe('@SL-180 Am Laptop zeigt die Tafel die Uhr wie der Hallenmonitor', () => {
  it('über der Uhr steht „Restzeit“, unter ihr der Zeitbalken (in dieser Reihenfolge)', () => {
    zeige(model());
    const uhr = screen.getByTestId('scoreboard-clock');
    expect(uhr).toHaveTextContent('Restzeit');
    const teile = Array.from(uhr.children);
    expect(teile.map((t) => t.getAttribute('data-testid') ?? t.textContent)).toEqual(['Restzeit', 'scoreboard-clock-rest', 'scoreboard-zeitbalken']);
  });

  it('die gespielte Zeit „4:06“ steht in der Kopfzeile neben „Spiel 3 · Feld 1 · 2. Halbzeit“, nicht mehr unter der Uhr', () => {
    zeige(model());
    expect(screen.getByTestId('scoreboard-kopf-text')).toHaveTextContent('Spiel 3 · Feld 1 · 2. Halbzeit · Gespielt 4:06');
    expect(screen.queryByTestId('scoreboard-clock-sub')).toBeNull();
  });

  it('Gegenbeispiel: in der Pause (keine gespielte Zeit) steht die Zeile „bis Wiederanpfiff“ unter der Uhr', () => {
    zeige(model({ uhr: { rest: '0:30', gespielt: null, label: 'Pause', unterzeile: 'bis Wiederanpfiff', hervorgehoben: false, steht: false, schlussphase: false, ton: 'gedaempft' } }));
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('bis Wiederanpfiff');
  });

  it('das Abzeichen „Live“ erscheint ohne rote Fläche: transparent, weiße Schrift, grüner Punkt', () => {
    zeige(model());
    const abzeichen = screen.getByTestId('scoreboard-abzeichen');
    expect(abzeichen).toHaveTextContent('Live');
    expect(abzeichen.style.background).toBe('transparent');
    expect(abzeichen.style.background).not.toContain(cssVars.colors.statusLive);
    expect(abzeichen.style.color).toBe(cssVars.colors.scoreboardText);
    expect(within(abzeichen).getByTestId('match-status-badge-dot').style.background).toBe(cssVars.colors.scoreboardOk);
  });

  it('@SL-179 Doppelpunkt der Uhr und Doppelpunkt der Kästen liegen in Spalten gleicher Breite (Raster 1fr · Achse · 1fr)', () => {
    zeige(model());
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveAttribute('data-uhr-achse');
    expect(screen.getByTestId('scoreboard-clock-rest').style.gridTemplateColumns).toBe('minmax(0, 1fr) auto minmax(0, 1fr)');
    expect(screen.getByTestId('scoreboard-colon')).toHaveTextContent(':');
  });

  it('Ziffern von Stand und Uhr tragen die Marker für die Messung (`cockpit.ziffern`)', () => {
    zeige(model());
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveAttribute('data-ziffern', 'uhr');
    expect(screen.getByTestId('scoreboard-box-links')).toHaveAttribute('data-ziffern', 'stand'); // neutraler Kasten ohne Teamfarben
  });

  it('mit Teamfarben trägt die Ziffer des Kastens den Marker', () => {
    zeige(model({ links: { name: 'TSV Petting', label: 'Heim', tore: 2, kasten: { fill: { kind: 'solid', color: '#6B21A8' }, bib: false } } }));
    expect(screen.getByTestId('scoreboard-box-links-digits')).toHaveAttribute('data-ziffern', 'stand');
  });
});

describe('@SL-181 Der Teamname steht klein über dem Kasten (ab 720 px), darunter nur „Heim“/„Gast“', () => {
  it.each([['normal'], ['gross']] as const)('Stufe %s: der Name steht über jedem Kasten', (stufe) => {
    zeige(model(), stufe);
    expect(screen.getByTestId('scoreboard-name-links')).toHaveTextContent('TSV Petting');
    expect(screen.getByTestId('scoreboard-name-rechts')).toHaveTextContent('DJK Otting');
    expect(screen.queryByTestId('scoreboard-label-links')).toBeNull();
  });

  it('Stufe knapp (Fensterhöhe unter 720 px, Variante a): über dem Kasten nur „Heim“ und „Gast“, der Name steht in der Leiste', () => {
    zeige(model(), 'knapp');
    expect(screen.getByTestId('scoreboard-label-links')).toHaveTextContent('Heim');
    expect(screen.getByTestId('scoreboard-label-rechts')).toHaveTextContent('Gast');
    expect(screen.queryByText('TSV Petting')).toBeNull();
    expect(screen.queryByTestId('scoreboard-name-links')).toBeNull();
  });
});

describe('@SL-182 Lange Teamnamen brechen um und werden nie gekürzt', () => {
  it.each([
    ['Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921', 50],
    ['Eintracht Oberweiler-Niederstetten 1919 e. V.', 45],
  ])('„%s“ (%i Zeichen) steht vollständig da, bricht um und endet nie mit „…“', (name) => {
    zeige(model({ links: { name, label: 'Heim', tore: 2 } }));
    const element = screen.getByTestId('scoreboard-name-links');
    expect(element).toHaveTextContent(name);
    expect(element).toHaveAttribute('data-teamname');
    expect(element.textContent).not.toMatch(/…|\.\.\.$/);
    // der Umbruch gehört dem Browser: keine Kürzung, kein Einzeiler
    expect(element.className).toBeTruthy();
    expect(element.style.textOverflow).toBe('');
    expect(element.style.whiteSpace).not.toBe('nowrap');
  });
});

describe('@ZM-166 Der Zeitbalken zeigt den Zustand, nie in Rot', () => {
  it.each([
    ['gruen', 0.5], ['grau', 0.5], ['gedaempft', 0.5], ['violett', 0.25],
  ] as const)('Ton %s, Anteil %s: der Balken trägt den Ton und füllt sich zu diesem Anteil', (ton, anteil) => {
    zeige(model({ uhr: { ...model().uhr!, balken: { anteil, ton } } }));
    const balken = screen.getByTestId('scoreboard-zeitbalken');
    expect(balken).toHaveAttribute('data-ton', ton);
    expect(Number(balken.getAttribute('data-anteil'))).toBeCloseTo(anteil, 3);
    expect(parseFloat((balken.firstElementChild as HTMLElement).style.width)).toBeCloseTo(anteil * 100, 1);
  });

  it('Gegenbeispiel: ohne Balken im Modell (Strafstoßschießen, beendet) steht kein Balken da', () => {
    zeige(model({ uhr: { ...model().uhr!, balken: null } }));
    expect(screen.queryByTestId('scoreboard-zeitbalken')).toBeNull();
  });

  it('keine Farbe des Balkens ist Rot (Rot gehört dem Live-Abzeichen)', () => {
    for (const ton of ['gruen', 'grau', 'gedaempft', 'violett'] as const) {
      const { unmount } = zeige(model({ uhr: { ...model().uhr!, balken: { anteil: 0.5, ton } } }));
      const farbe = (screen.getByTestId('scoreboard-zeitbalken').firstElementChild as HTMLElement).style.background;
      expect(farbe).not.toContain('statusLive');
      expect(farbe).not.toContain('error');
      expect(farbe).not.toContain('scoreboard-live');
      unmount();
    }
  });
});

describe('@SL-183 Die Einblendung liegt über der Kopfzeile und verschiebt nichts', () => {
  it('„Tor für TSV Petting“ steht in der Einblendung über der Kopfzeile, die Uhr und die Kästen bleiben im Bild', () => {
    zeige(model(), 'normal', <NoticeLine testId="notice-line" art="einblendung" stufe={3} text="Tor für TSV Petting" closeLabel="Schließen" size="regular" />);
    const einblendung = screen.getByTestId('notice-line');
    expect(einblendung).toHaveTextContent('Tor für TSV Petting');
    expect(einblendung.parentElement?.className).toContain('einblendung');
    expect(einblendung).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('scoreboard-clock-rest')).toBeVisible();
    expect(screen.getByTestId('scoreboard-box-links')).toBeVisible();
  });

  it('ohne Meldung bleibt nur ein leerer Ansagebereich ohne Höhe', () => {
    zeige(model(), 'normal', <NoticeLine testId="notice-line" art="einblendung" text={null} closeLabel="Schließen" size="regular" />);
    const bereich = screen.getByTestId('notice-line');
    expect(bereich.style.height).toBe('0px');
    expect(bereich).toHaveAttribute('aria-live', 'polite');
    expect(bereich).toBeEmptyDOMElement();
  });
});
