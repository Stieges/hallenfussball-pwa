/**
 * @SL-245 (spiel-leiten): Beide Team-Köpfe über den Tasten sind gleich aufgebaut – „Heim“/„Gast“ in der ersten Zeile, der Teamname darunter,
 * egal ob der Name kurz oder lang ist; nur am Handy bleibt der flache Kopf („Heim“/„Gast“ rechts in der ersten Zeile, der Name fließt darum).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamHeadBar } from '../TeamHeadBar';

const FLAECHE = { kind: 'solid', color: '#6B21A8' } as const;
const LANG_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const zeige = (name: string, label: string, testId: string, kompakt = false, breit = true) => render(
  <TeamHeadBar name={name} label={label} fill={FLAECHE} breit={breit} kompakt={kompakt} testId={testId} nameTestId={`${testId}-name`} />,
);
/** Sichtbare Reihenfolge der Zeilen: bei „column-reverse“ steht das zuletzt im Dokument stehende Kind oben. */
const sichtbareReihenfolge = (kopf: HTMLElement): string[] => {
  const kinder = Array.from(kopf.children).filter((k) => !k.hasAttribute('data-teil')).map((k) => (k.hasAttribute('data-teamname') ? 'name' : 'seite'));
  return kopf.style.flexDirection === 'column-reverse' ? kinder.reverse() : kinder;
};

describe('TeamHeadBar @SL-245: gleicher Aufbau in beiden Köpfen', () => {
  it('Laptop/Tablet: auch bei kurzem Namen steht die Seite über dem Namen (wie beim langen)', () => {
    zeige('TSV Waging 2', 'Gast', 'kopf');
    const kopf = screen.getByTestId('kopf');
    expect(sichtbareReihenfolge(kopf)).toEqual(['seite', 'name']);
    expect(kopf.style.flexDirection).not.toBe('row');
  });

  it('beide Köpfe einer Spalte haben denselben Aufbau, egal welcher Name länger ist', () => {
    render(<>
      <TeamHeadBar name="SG Tengling/Taching" label="Heim" fill={FLAECHE} breit testId="heim" nameTestId="heim-name" />
      <TeamHeadBar name="TSV Waging 2" label="Gast" fill={FLAECHE} breit testId="gast" nameTestId="gast-name" />
    </>);
    const heim = screen.getByTestId('heim');
    const gast = screen.getByTestId('gast');
    expect(sichtbareReihenfolge(heim)).toEqual(sichtbareReihenfolge(gast));
    for (const stil of ['flexDirection', 'alignItems', 'justifyContent'] as const) { expect(heim.style[stil], stil).toBe(gast.style[stil]); }
    expect(screen.getByTestId('heim-name').style.fontSize).toBe(screen.getByTestId('gast-name').style.fontSize);
    expect(screen.getByText('Heim').style.textAlign).toBe(screen.getByText('Gast').style.textAlign);
  });

  it('zwei Namen mit 50 Zeichen: derselbe Aufbau, nichts gekürzt', () => {
    zeige(LANG_50, 'Heim', 'a');
    const kopf = screen.getByTestId('a');
    expect(sichtbareReihenfolge(kopf)).toEqual(['seite', 'name']);
    expect(screen.getByTestId('a-name')).toHaveTextContent(LANG_50);
  });

  it('Gegenprobe Handy (kompakt): flacher Kopf unverändert, Seite rechts in der ersten Zeile, Name fließt darum', () => {
    zeige('TSV Waging 2', 'Gast', 'kopf', true, false);
    const kopf = screen.getByTestId('kopf');
    expect(kopf).toHaveAttribute('data-kompakt', 'true');
    expect(kopf).not.toHaveAttribute('data-gestapelt');
    expect(kopf.style.display).toBe('block');
    expect(screen.getByText('Gast').style.float).toBe('right');
    expect(kopf.firstElementChild?.tagName).toBe('SPAN'); // Seite steht im Dokument vor dem Namen
  });

  it('Laptop/Tablet: der Name bricht nur zwischen Wörtern – jedes Wort steht in einem eigenen nowrap-Span, der Text bleibt vollständig', () => {
    const name = 'TSV Nordheim-Süd 1921 Sportfreunde Oberweiler-Niederstetten';
    zeige(name, 'Heim', 'kopf');
    const nameEl = screen.getByTestId('kopf-name');
    const spans = Array.from(nameEl.querySelectorAll('span')).filter((s) => s.style.whiteSpace === 'nowrap');
    expect(spans.map((s) => s.textContent)).toEqual(name.split(' '));
    expect(nameEl.textContent).toBe(name);
  });

  it('Laptop/Tablet: ein sehr langes Einzelwort wird kleiner statt getrennt', () => {
    zeige('Sportfreundeoberweilerniederstetten', 'Heim', 'kopf', false, false);
    const nameEl = screen.getByTestId('kopf-name');
    expect(nameEl.style.fontSize).toBe('var(--font-size-sm)');
    expect(nameEl.textContent).toBe('Sportfreundeoberweilerniederstetten');
  });
});
