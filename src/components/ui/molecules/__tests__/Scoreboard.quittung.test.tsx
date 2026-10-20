/**
 * Scoreboard: Quittungszeile unter dem Endstand (@SL-152, Variante C): Zeile unter den Stand-Kästen, unter dem Abzeichen
 * „Ende“, mit Häkchen-Symbol (Farbe allein trägt nichts), höflich vorgelesen; ohne Text keine Zeile.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Scoreboard, type ScoreboardModel } from '../Scoreboard';

const ende: ScoreboardModel = {
  badge: { kind: 'badge', state: 'ended' }, links: { name: 'FC Nord', tore: 2 }, rechts: { name: 'SV Süd', tore: 1 },
  uhr: { rest: '6:00', gespielt: null, label: 'Spielzeit', unterzeile: null, hervorgehoben: false, steht: false, schlussphase: false, ton: 'gedaempft' },
  abschnittText: null, hinweise: [], eintraegeWartenText: null, helferAnfragenText: null, ariaStand: 'FC Nord 2, SV Süd 1',
  quittungText: 'Abgepfiffen · 2:1 gespeichert',
};

describe('Scoreboard: Quittungszeile (@SL-152)', () => {
  it('@SL-152 die Zeile „Abgepfiffen · 2:1 gespeichert“ steht unter dem Endstand, mit Symbol, höflich vorgelesen', () => {
    render(<Scoreboard model={ende} size="regular" meldezeile={null} testId="scoreboard" />);
    const zeile = screen.getByTestId('scoreboard-quittung');
    expect(zeile).toHaveTextContent('Abgepfiffen · 2:1 gespeichert');
    expect(zeile).toHaveAttribute('role', 'status');
    expect(zeile.querySelector('svg')).not.toBeNull();
    const stand = screen.getByTestId('scoreboard-clock');
    expect(stand.compareDocumentPosition(zeile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('scoreboard-abzeichen')).toBeInTheDocument();
  });

  it('@SL-152 Gegenbeispiel: ohne Quittungstext (vor dem Abpfiff, nach den 30 Sekunden) steht keine Zeile', () => {
    render(<Scoreboard model={{ ...ende, quittungText: null }} size="regular" meldezeile={null} testId="scoreboard" />);
    expect(screen.queryByTestId('scoreboard-quittung')).toBeNull();
    render(<Scoreboard model={{ ...ende, quittungText: undefined }} size="compact" meldezeile={null} testId="zweite" />);
    expect(screen.queryByTestId('zweite-quittung')).toBeNull();
  });
});
