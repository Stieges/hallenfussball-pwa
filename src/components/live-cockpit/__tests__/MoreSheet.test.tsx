/**
 * Blatt „Mehr“ (Plan LT-1, Grundgerüst): welche Punkte je Zustand, K11 (eine Quelle: `darfImZustand`), @SL-079 (keine Uhr-Korrektur
 * in Halbzeitpause und nach dem Abpfiff), @SL-065 (Seiten tauschen bleibt erreichbar), Abpfiff nie hier (Entscheidung A2).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { MoreSheet } from '../areas/MoreSheet';
import { mehrPunkteGrundgeruest } from '../model/mehrPunkte';
import { darfImZustand } from '../model/darf';
import type { CockpitPhase, CockpitZustand } from '../model/cockpitPhase';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const ZUSTAENDE: CockpitZustand[] = [
  'vorAnpfiff', 'laeuft', 'pausiert', 'halbzeitpause', 'pauseVorVerlaengerung', 'entscheidung', 'strafstoss', 'abgepfiffen', 'wartetAufHerkunft', 'keinSpiel',
];
const phase = (zustand: CockpitZustand): CockpitPhase => ({ zustand, abschnittArt: 'regulaer', abschnitt: 1, abschnitte: 2, letzterAbschnitt: false });

describe('mehrPunkteGrundgeruest', () => {
  it('laeuft → alle drei Punkte', () => {
    expect(mehrPunkteGrundgeruest(phase('laeuft'), { kannSteuern: true })).toEqual(['uhrKorrigieren', 'seitenTauschen', 'einstellungen']);
  });

  it.each(ZUSTAENDE)('K11 %s: seitenTauschen und uhrKorrigieren folgen darfImZustand (eine Quelle)', (zustand) => {
    const punkte = mehrPunkteGrundgeruest(phase(zustand), { kannSteuern: true });
    expect(punkte.includes('seitenTauschen'), 'seitenTauschen').toBe(darfImZustand(zustand, true, 'seitenTauschen'));
    expect(punkte.includes('uhrKorrigieren'), 'uhrKorrigieren').toBe(darfImZustand(zustand, true, 'uhrKorrigieren'));
    expect(punkte).toContain('einstellungen');
  });

  it.each(ZUSTAENDE)('K11 Nur-Lesen, %s: nie „Uhr korrigieren“, „Seiten tauschen“ wie darfImZustand ohne Steuer, Einstellungen bleiben (gesperrt sichtbar)', (zustand) => {
    const punkte = mehrPunkteGrundgeruest(phase(zustand), { kannSteuern: false });
    expect(punkte).not.toContain('uhrKorrigieren');
    expect(punkte.includes('seitenTauschen')).toBe(darfImZustand(zustand, false, 'seitenTauschen'));
    expect(punkte).toContain('einstellungen');
  });

  it.each<[string, CockpitZustand]>([['@SL-079 halbzeitpause', 'halbzeitpause'], ['@SL-079 abgepfiffen', 'abgepfiffen']])('%s → ohne uhrKorrigieren', (_n, zustand) => {
    expect(mehrPunkteGrundgeruest(phase(zustand), { kannSteuern: true })).not.toContain('uhrKorrigieren');
  });

  it('@SL-065 Seiten tauschen bleibt in der Halbzeitpause und nach dem Abpfiff erreichbar', () => {
    expect(mehrPunkteGrundgeruest(phase('halbzeitpause'), { kannSteuern: true })).toContain('seitenTauschen');
    expect(mehrPunkteGrundgeruest(phase('abgepfiffen'), { kannSteuern: true })).toContain('seitenTauschen');
  });

  it('Gegenbeispiel (Entscheidung A2): nie ein Punkt „Abpfiff“, in keinem Zustand', () => {
    for (const z of ZUSTAENDE) {
      expect(mehrPunkteGrundgeruest(phase(z), { kannSteuern: true }) as string[]).not.toContain('abpfiffHalten');
      expect(mehrPunkteGrundgeruest(phase(z), { kannSteuern: true }) as string[]).not.toContain('abpfiff');
    }
  });
});

describe('MoreSheet', () => {
  const aktionen = () => ({ uhrKorrigieren: vi.fn(), seitenTauschen: vi.fn(), einstellungen: vi.fn() });

  it('Blatt ist modal; die Punkte stehen mit ihren Namen da', () => {
    render(<MoreSheet isOpen onClose={vi.fn()} punkte={['uhrKorrigieren', 'seitenTauschen', 'einstellungen']} aktionen={aktionen()} />);
    expect(screen.getByTestId('more-sheet')).toHaveAttribute('aria-modal', 'true');
    for (const name of ['Uhr korrigieren', 'Seiten tauschen', 'Einstellungen']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('ein Tipp schließt das Blatt und führt die Aktion genau einmal aus', async () => {
    const onClose = vi.fn();
    const a = aktionen();
    render(<MoreSheet isOpen onClose={onClose} punkte={['seitenTauschen', 'einstellungen']} aktionen={a} />);
    await userEvent.click(screen.getByRole('button', { name: 'Seiten tauschen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(a.seitenTauschen).toHaveBeenCalledTimes(1);
    expect(a.einstellungen).not.toHaveBeenCalled();
  });

  it('A-08c Gegenbeispiel: ein Punkt ohne Aktion erscheint nicht', () => {
    render(<MoreSheet isOpen onClose={vi.fn()} punkte={['uhrKorrigieren', 'einstellungen']} aktionen={{ einstellungen: vi.fn() }} />);
    expect(screen.queryByRole('button', { name: 'Uhr korrigieren' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Einstellungen' })).toBeInTheDocument();
  });
});

describe('B-12 mehrPunkteGrundgeruest: „Nicht angetreten“ (@SL-174, @SL-175)', () => {
  it('@SL-174 vor dem Anpfiff: nur mit istLeitung', () => {
    expect(mehrPunkteGrundgeruest(phase('vorAnpfiff'), { kannSteuern: true, istLeitung: true })).toContain('nichtAngetreten');
    expect(mehrPunkteGrundgeruest(phase('vorAnpfiff'), { kannSteuern: true, istLeitung: false })).not.toContain('nichtAngetreten');
    expect(mehrPunkteGrundgeruest(phase('vorAnpfiff'), { kannSteuern: true })).not.toContain('nichtAngetreten');
  });

  it.each(ZUSTAENDE.filter((z) => z !== 'vorAnpfiff'))('@SL-175 %s: auch die Turnierleitung bekommt keinen Eintrag', (zustand) => {
    expect(mehrPunkteGrundgeruest(phase(zustand), { kannSteuern: true, istLeitung: true })).not.toContain('nichtAngetreten');
  });
});
