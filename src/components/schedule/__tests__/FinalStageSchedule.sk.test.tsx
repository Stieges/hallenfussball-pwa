/**
 * Paket SK, Finalrunde:
 *  - C-FINALRUNDE-MOBIL-EINGABE (@FU-080 sinngemäß, @FU-094): ein offenes Finalrunden-Spiel lässt sich am Handy
 *    (Karten-Ansicht, hochkant) eintragen – beide Felder nacheinander, ohne dass die Eingabe zurückspringt.
 *  - @OB-064 in der Finalrunde: Halbfinale 1 „FC Nord gegen SG Mitte“ (Gherkin-Beispiele Z.1–Z.3), Karte und Tabelle.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Echte deutsche Texte prüfen (src/test/realDeI18n.ts).
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import type { ScheduledMatch } from '../../../core/generators';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { cssVars } from '../../../design-tokens';
import { FinalStageSchedule } from '../FinalStageSchedule';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const NORD = testUuid(1);
const MITTE = testUuid(2);
const HF1 = testUuid(101);
const teams = [{ id: NORD, name: 'FC Nord' }, { id: MITTE, name: 'SG Mitte' }];

function halbfinale(partial: Partial<ScheduledMatch> = {}): ScheduledMatch {
  const start = new Date('2026-11-14T14:20:00');
  return {
    id: HF1, matchNumber: 11, time: '14:20', field: 1,
    homeTeam: 'ALT', awayTeam: 'ALT', originalTeamA: NORD, originalTeamB: MITTE,
    slotA: teamSlot(NORD), slotB: teamSlot(MITTE),
    label: '1. Halbfinale', phase: 'semifinal', isFinal: true,
    startTime: start, endTime: start, duration: 10,
    ...partial,
  };
}

const mobile = (container: HTMLElement) => container.querySelector<HTMLElement>('.mobile-view')!;
const eingabe = (seite: 'home' | 'away') => screen.getByTestId<HTMLInputElement>(`final-score-input-${HF1}-${seite}`);

describe('C-FINALRUNDE-MOBIL-EINGABE: offenes Finalrunden-Spiel am Handy eintragbar', () => {
  it('beide Felder nacheinander: erst Heim bleibt stehen, dann Gast speichert 2:1', () => {
    const onScoreChange = vi.fn();
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={onScoreChange} />);

    fireEvent.change(eingabe('home'), { target: { value: '2' } });
    expect(eingabe('home').value).toBe('2'); // vorher sprang das Feld auf leer zurück
    expect(onScoreChange).not.toHaveBeenCalled(); // erst speichern, wenn beide Seiten einen Wert haben

    fireEvent.change(eingabe('away'), { target: { value: '1' } });
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(HF1, 2, 1);
  });

  it('auch in der anderen Reihenfolge: erst Gast, dann Heim', () => {
    const onScoreChange = vi.fn();
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={onScoreChange} />);
    fireEvent.change(eingabe('away'), { target: { value: '0' } });
    expect(eingabe('away').value).toBe('0');
    fireEvent.change(eingabe('home'), { target: { value: '3' } });
    expect(onScoreChange).toHaveBeenCalledWith(HF1, 3, 0);
  });

  it('Gegenbeispiel: nur lesen (nicht editierbar) zeigt keine Eingabefelder', () => {
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} />);
    expect(screen.queryByTestId(`final-score-input-${HF1}-home`)).toBeNull();
    expect(screen.getByTestId(`final-goals-${HF1}-home`).textContent).toBe('–');
  });

  it('Gegenbeispiel: ein beendetes Spiel bleibt gesperrt (Korrigieren statt Eingabe)', () => {
    render(
      <FinalStageSchedule matches={[halbfinale({ scoreA: 1, scoreB: 0 })]} tournament={{ teams }} editable onScoreChange={vi.fn()}
        finishedMatches={new Set([HF1])} onStartCorrection={vi.fn()} />,
    );
    expect(screen.queryByTestId(`final-score-input-${HF1}-home`)).toBeNull();
  });

  it('Eingabefelder erreichen die Mindestgröße 44 px und 16 px Schrift als Token', () => {
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={vi.fn()} />);
    expect(eingabe('home').style.minHeight || eingabe('home').style.height).toContain('--touch-target-minimum');
    expect(eingabe('home').style.fontSize).toContain('--font-size');
  });
});

describe('Eingabefelder der Tabelle (Laptop/Tablet quer) erfüllen Touch-Ziel und 16 px', () => {
  it('Tore-Felder in der Tabellenzeile: 44 px hoch und breit, Schrift 16 px (Token)', () => {
    const { container } = render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={vi.fn()} />);
    const felder = Array.from(container.querySelectorAll<HTMLInputElement>('.desktop-view table input'));
    expect(felder).toHaveLength(2);
    for (const feld of felder) {
      expect(feld.style.height).toBe(cssVars.touchTargets.minimum);
      expect(feld.style.width).toBe(cssVars.touchTargets.minimum);
      expect(feld.style.fontSize).toBe(cssVars.fontSizes.lg);
    }
  });
});

describe('@OB-064 Schriftstärke: nur der Sieger eines beendeten Spiels ist fett', () => {
  const zelle = (container: HTMLElement, name: string) => within(container.querySelector<HTMLElement>('.desktop-view table')!).getByText(name).closest('td')!;
  const gewichtVon = (el: HTMLElement) => el.style.fontWeight || getComputedStyle(el).fontWeight;

  it('offenes Spiel: Heim und Gast der Tabelle haben dieselbe Schriftstärke', () => {
    const { container } = render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={vi.fn()} />);
    expect(gewichtVon(zelle(container, 'FC Nord'))).toBe(gewichtVon(zelle(container, 'SG Mitte')));
    expect(gewichtVon(zelle(container, 'SG Mitte'))).not.toBe(cssVars.fontWeights.bold);
  });

  it('offenes Spiel: Heim und Gast der Handy-Karte haben dieselbe Schriftstärke', () => {
    const { container } = render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={vi.fn()} />);
    const karte = within(container.querySelector<HTMLElement>('.mobile-view')!);
    expect(karte.getByText('FC Nord').parentElement?.style.fontWeight).toBe(karte.getByText('SG Mitte').parentElement?.style.fontWeight);
    expect(karte.getByText('FC Nord').parentElement?.style.fontWeight).not.toBe(cssVars.fontWeights.bold);
  });

  it('Gegenbeispiel beendet: nur der Sieger ist fett, der Verlierer normal', () => {
    const { container } = render(<FinalStageSchedule matches={[halbfinale({ scoreA: 1, scoreB: 0 })]} tournament={{ teams }} finishedMatches={new Set([HF1])} />);
    expect(gewichtVon(zelle(container, 'FC Nord'))).toBe(cssVars.fontWeights.bold);
    expect(gewichtVon(zelle(container, 'SG Mitte'))).not.toBe(cssVars.fontWeights.bold);
  });
});

const AUSGANG = {
  strafstoss: { scoreA: 2, scoreB: 2, finalSource: { scoreA: 2, scoreB: 2, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' as const } },
  verlaengerung: { scoreA: 2, scoreB: 2, finalSource: { scoreA: 2, scoreB: 2, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'overtime' as const } },
  regulaer: { scoreA: 1, scoreB: 0 },
};

function beendet(ausgang: Partial<ScheduledMatch>) {
  return render(<FinalStageSchedule matches={[halbfinale(ausgang)]} tournament={{ teams }} finishedMatches={new Set([HF1])} />);
}

describe('@OB-064 Finalrunde: Karte (Handy) und Tabelle (Desktop)', () => {
  it('Z.1 Karte: 2 / 2, (4) bei FC Nord, (3) bei SG Mitte, „beendet i. E.“, FC Nord fett', () => {
    const { container } = beendet(AUSGANG.strafstoss);
    const karte = within(mobile(container));
    expect(screen.getByTestId(`final-goals-${HF1}-home`).textContent).toBe('2');
    expect(screen.getByTestId(`final-goals-${HF1}-away`).textContent).toBe('2');
    expect(screen.getByTestId(`final-penalty-${HF1}-home`).textContent).toBe('(4)');
    expect(screen.getByTestId(`final-penalty-${HF1}-away`).textContent).toBe('(3)');
    expect(screen.getByTestId(`final-decision-${HF1}`).textContent).toBe('beendet i. E.');
    expect(karte.getByText('FC Nord').getAttribute('data-winner')).toBe('true');
    expect(karte.getByText('SG Mitte').getAttribute('data-winner')).toBeNull();
    // Gewicht aus dem Zeilenstil: Sieger fett, Verlierer nicht
    expect(karte.getByText('FC Nord').parentElement?.style.fontWeight).toBe(cssVars.fontWeights.bold);
    expect(karte.getByText('SG Mitte').parentElement?.style.fontWeight).not.toBe(cssVars.fontWeights.bold);
  });

  it('Z.1 Tabelle: „2:2 (4:3 i. E.)“', () => {
    const { container } = beendet(AUSGANG.strafstoss);
    expect(container.querySelector('.match-score-cell-finished')?.textContent).toContain('2:2 (4:3 i. E.)');
  });

  it('Z.2 Karte: 3 / 2 und „n. V.“, Tabelle „3:2 n. V.“', () => {
    const { container } = beendet(AUSGANG.verlaengerung);
    expect(screen.getByTestId(`final-goals-${HF1}-home`).textContent).toBe('3');
    expect(screen.getByTestId(`final-goals-${HF1}-away`).textContent).toBe('2');
    expect(screen.getByTestId(`final-decision-${HF1}`).textContent).toBe('n. V.');
    expect(screen.queryByTestId(`final-penalty-${HF1}-home`)).toBeNull();
    expect(container.querySelector('.match-score-cell-finished')?.textContent).toContain('3:2 n. V.');
  });

  it('Z.3 Karte: 1 / 0 ohne Zusatz, Tabelle „1:0“', () => {
    const { container } = beendet(AUSGANG.regulaer);
    expect(screen.getByTestId(`final-goals-${HF1}-home`).textContent).toBe('1');
    expect(screen.getByTestId(`final-goals-${HF1}-away`).textContent).toBe('0');
    expect(screen.queryByTestId(`final-decision-${HF1}`)).toBeNull();
    expect(container.querySelector('.match-score-cell-finished')?.textContent).toContain('1:0');
    expect(container.querySelector('.match-score-cell-finished')?.textContent).not.toMatch(/n\. V\.|i\. E\./);
  });
});
