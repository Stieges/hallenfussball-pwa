/**
 * Paket SK, Finalrunde:
 *  - C-FINALRUNDE-MOBIL-EINGABE (@FU-080 sinngemäß, @FU-094): ein offenes Finalrunden-Spiel lässt sich am Handy
 *    (Karten-Ansicht, hochkant) eintragen – beide Felder nacheinander, ohne dass die Eingabe zurückspringt.
 *  - @OB-064 in der Finalrunde: Halbfinale 1 „FC Nord gegen SG Mitte“ (Gherkin-Beispiele Z.1–Z.3), Karte und Tabelle.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
import type { ScoreCommitResult } from '../../ui/molecules';
import { matchOf, viewOf, type Cache } from './scheduleViewFixture';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const NORD = testUuid(1);
const MITTE = testUuid(2);
const HF1 = testUuid(101);
const teams = [{ id: NORD, name: 'FC Nord' }, { id: MITTE, name: 'SG Mitte' }];

/** Die Ansicht der Leitung mit dem Zwischenspeicher des Halbfinales (Status, Stand, Entscheidung). */
const ansicht = (cache: Cache) => ({ teams, view: viewOf([matchOf(halbfinale(), cache)], teams) });

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
    expect(onScoreChange).not.toHaveBeenCalled(); // @FU-101: erst beim Verlassen oder mit Enter
    fireEvent.blur(eingabe('away'));
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(HF1, 2, 1);
  });

  it('auch in der anderen Reihenfolge: erst Gast, dann Heim', () => {
    const onScoreChange = vi.fn();
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={onScoreChange} />);
    fireEvent.change(eingabe('away'), { target: { value: '0' } });
    expect(eingabe('away').value).toBe('0');
    fireEvent.change(eingabe('home'), { target: { value: '3' } });
    fireEvent.blur(eingabe('home'));
    expect(onScoreChange).toHaveBeenCalledWith(HF1, 3, 0);
  });

  it('Gegenbeispiel: nur lesen (nicht editierbar) zeigt keine Eingabefelder', () => {
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} />);
    expect(screen.queryByTestId(`final-score-input-${HF1}-home`)).toBeNull();
    expect(screen.getByTestId(`final-goals-${HF1}-home`).textContent).toBe('–');
  });

  it('Gegenbeispiel: ein beendetes Spiel bleibt gesperrt (Korrigieren statt Eingabe)', () => {
    render(
      <FinalStageSchedule matches={[halbfinale({ scoreA: 1, scoreB: 0 })]} tournament={ansicht({ matchStatus: 'finished', scoreA: 1, scoreB: 0 })} editable onScoreChange={vi.fn()}
        onStartCorrection={vi.fn()} />,
    );
    expect(screen.queryByTestId(`final-score-input-${HF1}-home`)).toBeNull();
  });

  it('Eingabefelder erreichen die Mindestgröße 44 px und 16 px Schrift als Token', () => {
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={vi.fn()} />);
    expect(eingabe('home').style.minHeight || eingabe('home').style.height).toContain('--touch-target-minimum');
    expect(eingabe('home').style.fontSize).toContain('--font-size');
  });
});

describe('@FU-101 Finalrunden-Karte (Handy, Tablet hochkant): zweistelliges Ergebnis', () => {
  const karte = (container: HTMLElement) => within(container.querySelector<HTMLElement>('.mobile-view')!);
  const rendern = (scoreB: number | undefined, onScoreChange: (id: string, a: number, b: number) => ScoreCommitResult = vi.fn()) => {
    const view = render(<FinalStageSchedule matches={[halbfinale({ scoreB })]} tournament={{ teams }} editable onScoreChange={onScoreChange} />);
    return { ...view, onScoreChange };
  };

  it('Gegeben das Feld für SG Mitte zeigt schon 2: „1“ und „0“ tippen speichert nichts, Verlassen speichert 10:2', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = rendern(2);
    await user.click(eingabe('home'));
    await user.keyboard('1');
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.keyboard('0');
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(HF1, 10, 2);
  });

  it('Enter bestätigt 10:2 genau einmal, auch beim späteren Verlassen', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = rendern(2);
    await user.click(eingabe('home'));
    await user.keyboard('10{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(HF1, 10, 2);
  });

  it('Escape verwirft die Eingabe', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = rendern(2);
    await user.click(eingabe('home'));
    await user.keyboard('1{Escape}');
    expect(eingabe('home').value).toBe('');
    await user.tab();
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  describe('rechtes Feld (Gast): Heim zeigt schon 2', () => {
    const rendernGast = () => {
      const onScoreChange = vi.fn();
      render(<FinalStageSchedule matches={[halbfinale({ scoreA: 2 })]} tournament={{ teams }} editable onScoreChange={onScoreChange} />);
      return onScoreChange;
    };

    it('„1“ und „0“ im rechten Feld, Verlassen speichert genau einmal 2:10', async () => {
      const user = userEvent.setup();
      const onScoreChange = rendernGast();
      await user.click(eingabe('away'));
      await user.keyboard('1');
      await user.keyboard('0');
      expect(onScoreChange).not.toHaveBeenCalled();
      await user.tab();
      expect(onScoreChange).toHaveBeenCalledTimes(1);
      expect(onScoreChange).toHaveBeenCalledWith(HF1, 2, 10);
    });

    it('Enter im rechten Feld speichert genau einmal, auch beim späteren Verlassen', async () => {
      const user = userEvent.setup();
      const onScoreChange = rendernGast();
      await user.click(eingabe('away'));
      await user.keyboard('10{Enter}');
      await user.tab();
      expect(onScoreChange).toHaveBeenCalledTimes(1);
      expect(onScoreChange).toHaveBeenCalledWith(HF1, 2, 10);
    });

    it('Escape im rechten Feld verwirft die Eingabe', async () => {
      const user = userEvent.setup();
      const onScoreChange = rendernGast();
      await user.click(eingabe('away'));
      await user.keyboard('1{Escape}');
      expect(eingabe('away').value).toBe('');
      await user.tab();
      expect(onScoreChange).not.toHaveBeenCalled();
    });
  });

  it('Buchstaben, negative und gebrochene Zahlen werden nicht gesendet, die Karte zeigt einen Hinweis', async () => {
    const user = userEvent.setup();
    const { container, onScoreChange } = rendern(2);
    for (const text of ['-3', '2.5', '1e1']) {
      await user.click(eingabe('home'));
      fireEvent.change(eingabe('home'), { target: { value: text } });
      await user.tab();
      expect(karte(container).getByTestId(`final-score-hint-${HF1}`).textContent).toBeTruthy();
    }
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('nach „Nein“ / „Abbrechen“ zeigt die Karte wieder den gespeicherten Stand und lässt sich erneut senden', async () => {
    const user = userEvent.setup();
    const onScoreChange = vi.fn().mockResolvedValue(false);
    rendern(undefined, onScoreChange);
    await user.click(eingabe('home'));
    await user.keyboard('2');
    await user.click(eingabe('away'));
    await user.keyboard('2{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect([eingabe('home').value, eingabe('away').value]).toEqual(['', '']));

    await user.click(eingabe('home'));
    await user.keyboard('2');
    await user.click(eingabe('away'));
    await user.keyboard('2{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(2);
  });

  it('beide Felder tragen die Beschriftung „Tore {Team}“', () => {
    rendern(undefined);
    expect(eingabe('home').getAttribute('aria-label')).toBe('Tore FC Nord');
    expect(eingabe('away').getAttribute('aria-label')).toBe('Tore SG Mitte');
  });
});

describe('@FU-093 / @FU-097 Finalrunden-Tabelle (Desktop): „Nein“ / „Abbrechen“ erreicht die Zelle', () => {
  const tabelle = (seite: 'home' | 'away') => screen.getByTestId<HTMLInputElement>(`match-score-input-${HF1}-${seite}`);

  it('liefert onScoreChange „nicht gespeichert“ (false), zeigt die Tabellenzelle wieder den gespeicherten Stand und lässt sich erneut senden', async () => {
    const user = userEvent.setup();
    const onScoreChange = vi.fn().mockResolvedValue(false);
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={onScoreChange} />);

    await user.click(tabelle('home'));
    await user.keyboard('2');
    await user.click(tabelle('away'));
    await user.keyboard('2{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(HF1, 2, 2);
    await waitFor(() => expect([tabelle('home').value, tabelle('away').value]).toEqual(['', '']));

    await user.click(tabelle('home'));
    await user.keyboard('2');
    await user.click(tabelle('away'));
    await user.keyboard('2{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(2);
  });

  it('Gegenbeispiel: wurde gespeichert (true), bleibt die Eingabe stehen', async () => {
    const user = userEvent.setup();
    const onScoreChange = vi.fn().mockResolvedValue(true);
    render(<FinalStageSchedule matches={[halbfinale()]} tournament={{ teams }} editable onScoreChange={onScoreChange} />);
    await user.click(tabelle('home'));
    await user.keyboard('2');
    await user.click(tabelle('away'));
    await user.keyboard('1{Enter}');
    await Promise.resolve();
    expect([tabelle('home').value, tabelle('away').value]).toEqual(['2', '1']);
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
    const { container } = render(<FinalStageSchedule matches={[halbfinale({ scoreA: 1, scoreB: 0 })]} tournament={ansicht({ matchStatus: 'finished', scoreA: 1, scoreB: 0 })} />);
    expect(gewichtVon(zelle(container, 'FC Nord'))).toBe(cssVars.fontWeights.bold);
    expect(gewichtVon(zelle(container, 'SG Mitte'))).not.toBe(cssVars.fontWeights.bold);
  });
});

/** Ergebnis wie am Spiel gespeichert (Zwischenspeicher): `scoreA/B` regulär, Verlängerung und Strafstoß getrennt. */
const AUSGANG: Record<'strafstoss' | 'verlaengerung' | 'regulaer', Cache> = {
  strafstoss: { matchStatus: 'finished', scoreA: 2, scoreB: 2, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' },
  verlaengerung: { matchStatus: 'finished', scoreA: 2, scoreB: 2, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'overtime' },
  regulaer: { matchStatus: 'finished', scoreA: 1, scoreB: 0 },
};

function beendet(ausgang: Cache) {
  return render(<FinalStageSchedule matches={[halbfinale()]} tournament={ansicht(ausgang)} />);
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
