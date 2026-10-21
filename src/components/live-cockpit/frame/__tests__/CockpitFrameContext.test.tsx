/**
 * Rahmen im laufenden Spiel (Plan LT-2, Entscheidung A1, @SL-140): `istCockpitVollbild` gilt in jedem Zustand außer „kein Spiel mehr“,
 * auch vor dem Anpfiff und während des Endstands; das Context meldet den Rahmen an und beim Verlassen wieder ab.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CockpitFrameProvider } from '../CockpitFrameContext';
import { istCockpitVollbild, useAnnounceCockpitFrame, useCockpitFrame } from '../cockpitFrame';
import type { CockpitZustand } from '../../model/cockpitPhase';

const ZUSTAENDE: CockpitZustand[] = ['vorAnpfiff', 'laeuft', 'pausiert', 'halbzeitpause', 'pauseVorVerlaengerung', 'entscheidung', 'strafstoss', 'abgepfiffen', 'wartetAufHerkunft', 'keinSpiel'];

describe('istCockpitVollbild (A1)', () => {
  it.each(ZUSTAENDE)('@SL-140 %s → nur „keinSpiel“ ist kein Vollbild', (zustand) => {
    expect(istCockpitVollbild(zustand)).toBe(zustand !== 'keinSpiel');
  });
  it('@SL-140 Gegenbeispiele: vor dem Anpfiff und im Endstand gilt der schmale Kopf, wartet-auf-Teams ebenfalls', () => {
    expect(istCockpitVollbild('vorAnpfiff')).toBe(true);
    expect(istCockpitVollbild('abgepfiffen')).toBe(true);
    expect(istCockpitVollbild('wartetAufHerkunft')).toBe(true);
  });
});

function Anzeige() {
  const { vollbild } = useCockpitFrame();
  return <span data-testid="rahmen">{String(vollbild)}</span>;
}
function Melder({ aktiv }: { aktiv: boolean }) {
  useAnnounceCockpitFrame(aktiv);
  return null;
}

describe('CockpitFrameProvider', () => {
  it('Außerhalb des Providers gilt kein Vollbild', () => {
    render(<Anzeige />);
    expect(screen.getByTestId('rahmen')).toHaveTextContent('false');
  });
  it('meldet den Rahmen an und beim Aushängen (Verlassen des Live-Bereichs) wieder ab', () => {
    const { rerender } = render(<CockpitFrameProvider><Anzeige /><Melder aktiv /></CockpitFrameProvider>);
    expect(screen.getByTestId('rahmen')).toHaveTextContent('true');
    rerender(<CockpitFrameProvider><Anzeige /></CockpitFrameProvider>);
    expect(screen.getByTestId('rahmen')).toHaveTextContent('false');
  });
  it('Gegenbeispiel: aktiv=false (kein Spiel mehr auf dem Feld) lässt die App-Navigation stehen', () => {
    render(<CockpitFrameProvider><Anzeige /><Melder aktiv={false} /></CockpitFrameProvider>);
    expect(screen.getByTestId('rahmen')).toHaveTextContent('false');
  });
});
