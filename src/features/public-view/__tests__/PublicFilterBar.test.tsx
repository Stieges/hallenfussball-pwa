/**
 * Render-Test der Filterleiste (B-13d2). Nötig, weil PublicFilterBar allein über die
 * eingefrorene Szenario-Datei unter 80 % Abdeckung bliebe.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PublicFilterBar, type PublicFilterBarProps } from '../components/PublicFilterBar';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

function renderBar(overrides: Partial<PublicFilterBarProps> = {}) {
  const props: PublicFilterBarProps = {
    groups: ['A', 'B'],
    selectedGroup: null,
    selectedPhase: 'all',
    selectedStatus: 'all',
    onGroupChange: vi.fn(),
    onPhaseChange: vi.fn(),
    onStatusChange: vi.fn(),
    ...overrides,
  };
  render(<PublicFilterBar {...props} />);
  return props;
}

describe('PublicFilterBar (B-13d2)', () => {
  it('zeigt die Gruppenzeile nur bei mehr als einer Gruppe', () => {
    const { unmount } = render(
      <PublicFilterBar
        groups={['A']}
        selectedGroup={null}
        selectedPhase="all"
        selectedStatus="all"
        onGroupChange={vi.fn()}
        onPhaseChange={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );
    expect(screen.queryByText('Gruppe:')).not.toBeInTheDocument();
    unmount();
    renderBar();
    expect(screen.getByText('Gruppe:')).toBeInTheDocument();
  });

  it('Gruppen-Chips melden Alle und die Gruppe', () => {
    const props = renderBar();
    const alle = screen.getAllByRole('button', { name: 'Alle' });
    fireEvent.click(alle[0]);
    expect(props.onGroupChange).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe B' }));
    expect(props.onGroupChange).toHaveBeenCalledWith('B');
  });

  it('Phasen-Chips melden alle, Gruppenphase und Finalrunde', () => {
    const props = renderBar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Alle' })[1]);
    expect(props.onPhaseChange).toHaveBeenCalledWith('all');
    fireEvent.click(screen.getByRole('button', { name: 'Finalrunde' }));
    expect(props.onPhaseChange).toHaveBeenCalledWith('final');
    fireEvent.click(screen.getByRole('button', { name: /Gruppenphase|tournament\.groupStage/ }));
    expect(props.onPhaseChange).toHaveBeenCalledWith('groupStage');
  });

  it('Status-Chips melden alle, geplant, live und beendet', () => {
    const props = renderBar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Alle' })[2]);
    expect(props.onStatusChange).toHaveBeenCalledWith('all');
    fireEvent.click(screen.getByRole('button', { name: 'Geplant' }));
    expect(props.onStatusChange).toHaveBeenCalledWith('scheduled');
    fireEvent.click(screen.getByRole('button', { name: '🔴 Live' }));
    expect(props.onStatusChange).toHaveBeenCalledWith('live');
    fireEvent.click(screen.getByRole('button', { name: 'Beendet' }));
    expect(props.onStatusChange).toHaveBeenCalledWith('finished');
  });
});
