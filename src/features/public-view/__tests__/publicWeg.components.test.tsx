/**
 * Bausteine „Schneller zum Spielplan“ (@ZM-196, @ZM-197, @ZM-175, @OB-022): Verhalten aus dem Gherkin, echte DE-Texte.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Team } from '../../../types/tournament';
import { PublicMyTeam } from '../components/PublicMyTeam';
import { PublicFilterRow } from '../components/PublicFilterRow';
import { PublicFilterSheet } from '../components/PublicFilterSheet';
import { PublicFilterNote } from '../components/PublicFilterNote';
import { PublicParticipants } from '../components/PublicParticipants';
import { participantsByGroup } from '../publicParticipantsList';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const team = (id: string, name: string, group?: string): Team => ({ id, name, ...(group === undefined ? {} : { group }) });
const ACHT: Team[] = [
  team('1', 'TuS Tal', 'B'), team('2', 'FC Nord', 'A'), team('3', 'SV Süd', 'B'), team('4', 'DJK Berg', 'A'),
  team('5', 'TSV West', 'A'), team('6', 'SG Mitte', 'B'), team('7', 'VfB Ufer', 'B'), team('8', 'SC Ost', 'A'),
];

describe('@ZM-175 @ZM-196 PublicMyTeam', () => {
  const baseProps = { onOpenSelector: vi.fn(), onlyMine: false, onOnlyMineChange: vi.fn() };

  it('@ZM-196 ohne Wahl: eine Zeile „Mein Team“ mit „Team wählen“, kein Block', () => {
    const onOpenSelector = vi.fn();
    render(<PublicMyTeam {...baseProps} teamName={null} facts={{}} onOpenSelector={onOpenSelector} />);
    const zeile = screen.getByTestId('my-team-bar');
    expect(zeile.textContent).toContain('Mein Team');
    expect(screen.queryByTestId('my-team-name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Team wählen' }));
    expect(onOpenSelector).toHaveBeenCalledTimes(1);
  });

  it('@ZM-175 mit Wahl: Name ungekürzt, „ändern“, nächstes Spiel mit Uhrzeit, Feld und Gegner, Tabellenplatz mit Punkten', () => {
    render(<PublicMyTeam {...baseProps} teamName="Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921" facts={{ next: { number: 11, time: '10:00', field: 1, opponent: 'FC Nordstadt' }, table: { place: 4, group: 'A', points: 0 } }} />);
    expect(screen.getByTestId('my-team-name').textContent).toBe('Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921');
    expect(screen.getByRole('button', { name: 'ändern' })).toBeInTheDocument();
    expect(screen.getByTestId('my-team-next').textContent).toBe('Spiel 11 · 10:00 Uhr · Feld 1 gegen FC Nordstadt');
    expect(screen.getByTestId('my-team-table').textContent).toBe('Platz 4 in Gruppe A · 0 Punkte');
  });

  it('@ZM-175 ohne weiteres Spiel „Kein weiteres Spiel“; ohne Tabelle (Kindermodus, vor dem ersten Spiel) keine Tabellenzeile; eine Gruppe ohne „in Gruppe“', () => {
    const { rerender } = render(<PublicMyTeam {...baseProps} teamName="FC Nord" facts={{}} />);
    expect(screen.getByTestId('my-team-next').textContent).toBe('Kein weiteres Spiel');
    expect(screen.queryByTestId('my-team-table')).toBeNull();
    rerender(<PublicMyTeam {...baseProps} teamName="FC Nord" facts={{ table: { place: 2, points: 7 } }} />);
    expect(screen.getByTestId('my-team-table').textContent).toBe('Platz 2 · 7 Punkte');
  });

  it('Altlink „Nur meine“ bleibt schaltbar (Entscheidung offen, C-ZUSCHAUER-WEG-ZUM-SPIELPLAN)', () => {
    const onOnlyMineChange = vi.fn();
    render(<PublicMyTeam {...baseProps} teamName="FC Nord" facts={{}} onOnlyMineChange={onOnlyMineChange} />);
    fireEvent.click(screen.getByTestId('my-team-only-mine'));
    expect(onOnlyMineChange).toHaveBeenCalledWith(true);
  });
});

describe('@ZM-196 @ZM-197 PublicFilterRow', () => {
  const props = { groups: ['A', 'B'], selectedGroup: null, hiddenCount: 0, sheetOpen: false, onGroupChange: vi.fn(), onOpenSheet: vi.fn() };

  it('@ZM-196 Gruppen-Auswahl „Alle · A · B“ nur bei mehr als einer Gruppe, die Taste „Filter“ steht immer da', () => {
    const { rerender } = render(<PublicFilterRow {...props} />);
    expect(screen.getByTestId('public-group-chips')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'true');
    // Gegenbeispiel: eine Gruppe (oder keine) – keine Gruppen-Auswahl
    rerender(<PublicFilterRow {...props} groups={['A']} />);
    expect(screen.queryByTestId('public-group-chips')).toBeNull();
    rerender(<PublicFilterRow {...props} groups={[]} />);
    expect(screen.queryByTestId('public-group-chips')).toBeNull();
    expect(screen.getByTestId('public-filter-button').textContent).toBe('Filter');
  });

  it('@ZM-196 die Chips melden Alle und die Gruppe; Vorlesetext „Gruppe B“', () => {
    const onGroupChange = vi.fn();
    render(<PublicFilterRow {...props} onGroupChange={onGroupChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe B' }));
    expect(onGroupChange).toHaveBeenCalledWith('B');
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(onGroupChange).toHaveBeenCalledWith(null);
  });

  it('@ZM-197 gesetzter Filter: „Filter (1)“ und Vorlesetext „Filter, 1 gewählt“; ohne Filter keine Zahl', () => {
    const onOpenSheet = vi.fn();
    const { rerender } = render(<PublicFilterRow {...props} hiddenCount={1} onOpenSheet={onOpenSheet} />);
    const knopf = screen.getByRole('button', { name: 'Filter, 1 gewählt' });
    expect(knopf.textContent).toBe('Filter (1)');
    fireEvent.click(knopf);
    expect(onOpenSheet).toHaveBeenCalledTimes(1);
    rerender(<PublicFilterRow {...props} hiddenCount={0} />);
    expect(screen.getByTestId('public-filter-button')).not.toHaveAttribute('aria-label');
  });
});

describe('@ZM-196 PublicFilterSheet', () => {
  const props = { isOpen: true, showPhase: true, selectedPhase: 'all' as const, selectedStatus: 'all' as const, onPhaseChange: vi.fn(), onStatusChange: vi.fn(), onReset: vi.fn(), onClose: vi.fn() };

  it('@ZM-196 Phase und Status als Blatt; mit „Fertig“ als Haupttaste zuletzt', () => {
    render(<PublicFilterSheet {...props} />);
    expect(screen.getByTestId('public-filter-group-phase')).toBeInTheDocument();
    expect(screen.getByTestId('public-filter-group-status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fertig' })).toHaveAttribute('data-primary');
  });

  it('@ZM-196 Gegenbeispiel: ohne Finalrunde (Nikolaus) kein Phasen-Filter', () => {
    render(<PublicFilterSheet {...props} showPhase={false} />);
    expect(screen.queryByTestId('public-filter-group-phase')).toBeNull();
    expect(screen.getByTestId('public-filter-group-status')).toBeInTheDocument();
  });

  it('die Wahl gilt sofort: Optionen melden Phase und Status; „Zurücksetzen“ und „Fertig“ melden sich', () => {
    render(<PublicFilterSheet {...props} />);
    fireEvent.click(screen.getByTestId('public-filter-opt-phase-final'));
    expect(props.onPhaseChange).toHaveBeenCalledWith('final');
    fireEvent.click(screen.getByTestId('public-filter-opt-status-finished'));
    expect(props.onStatusChange).toHaveBeenCalledWith('finished');
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    expect(props.onReset).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('die gewählte Option steht nicht nur in der Farbe: aria-pressed und ein Häkchen', () => {
    render(<PublicFilterSheet {...props} selectedStatus="finished" />);
    const gewaehlt = screen.getByTestId('public-filter-opt-status-finished');
    expect(gewaehlt).toHaveAttribute('aria-pressed', 'true');
    expect(gewaehlt.querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('public-filter-opt-status-all').querySelector('svg')).toBeNull();
  });

  it('geschlossen steht kein Blatt da', () => {
    render(<PublicFilterSheet {...props} isOpen={false} />);
    expect(screen.queryByTestId('public-filter-sheet')).toBeNull();
  });
});

describe('@ZM-197 PublicFilterNote', () => {
  it('ohne gesetzten Filter keine Zeile', () => {
    const { container } = render(<PublicFilterNote keys={[]} onShowAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('Status „Beendet“: Zeile mit Wort und „Alle zeigen“; mehrere Filter mit Mittelpunkt, Phase zuerst', () => {
    const onShowAll = vi.fn();
    const { rerender } = render(<PublicFilterNote keys={['status:finished']} onShowAll={onShowAll} />);
    const zeile = screen.getByRole('status');
    expect(within(zeile).getByText('Beendet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Alle zeigen' }));
    expect(onShowAll).toHaveBeenCalledTimes(1);
    rerender(<PublicFilterNote keys={['phase:final', 'status:live']} onShowAll={onShowAll} />);
    expect(screen.getByRole('status').textContent).toContain('Finalrunde · Live');
  });
});

describe('@ZM-196 PublicParticipants', () => {
  it('eingeklappt: „Teilnehmer (8), eingeklappt“, keine Liste; Antippen klappt auf („aufgeklappt“) und zu', () => {
    render(<PublicParticipants teams={ACHT} />);
    const knopf = screen.getByTestId('public-participants-toggle');
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    expect(knopf.textContent).toBe('Teilnehmer (8), eingeklappt');
    expect(screen.queryByTestId('public-participants-list')).toBeNull();
    fireEvent.click(knopf);
    expect(knopf).toHaveAttribute('aria-expanded', 'true');
    expect(knopf.textContent).toBe('Teilnehmer (8), aufgeklappt');
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(knopf);
    expect(screen.queryByTestId('public-participants-list')).toBeNull();
  });

  it('aufgeklappt: nach Gruppen, in der Gruppe nach Namen, Nummern fortlaufend; bei einer Gruppe ohne Überschrift', () => {
    expect(participantsByGroup(ACHT).map((g) => [g.group, g.entries.map((e) => `${e.number}.${e.team.name}`)])).toEqual([
      ['A', ['1.DJK Berg', '2.FC Nord', '3.SC Ost', '4.TSV West']],
      ['B', ['5.SG Mitte', '6.SV Süd', '7.TuS Tal', '8.VfB Ufer']],
    ]);
    render(<PublicParticipants teams={ACHT} />);
    fireEvent.click(screen.getByTestId('public-participants-toggle'));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Gruppe A', 'Gruppe B']);
  });

  it('Jeder gegen jeden (keine Gruppen): „Teilnehmer (6)“, aufgeklappt ohne Gruppenüberschrift', () => {
    const sechs = ['DJK Kammer', 'TSV Waging rot', 'TSV Petting', 'DJK Otting', 'TSV 1921 Fridolfing', 'TSV Waging blau'].map((n, i) => team(String(i), n));
    render(<PublicParticipants teams={sechs} />);
    expect(screen.getByTestId('public-participants-toggle').textContent).toContain('Teilnehmer (6)');
    fireEvent.click(screen.getByTestId('public-participants-toggle'));
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
});
