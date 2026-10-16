/**
 * ProtocolRow (M10): Bearbeiten-Knopf in der Sidebar mindestens 44 px (Design-Token).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtocolRow } from '../components/ProtocolRow';
import { touchTargets } from '../../../design-tokens';
import type { RuntimeMatchEvent } from '../../../types/tournament';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts?.description ? `${key}:${String(opts.description)}` : key,
  }),
}));

const event: RuntimeMatchEvent = {
  id: 'f1',
  matchId: 'match-1',
  timestampSeconds: 42,
  type: 'FOUL',
  payload: { teamId: 'team-a' },
  scoreAfter: { home: 0, away: 0 },
};

describe('ProtocolRow (M10)', () => {
  it('Bearbeiten-Knopf in der Sidebar: minWidth/minHeight ≥ 44 px (Token)', () => {
    render(
      <ProtocolRow
        entry={{ event, retracted: false }}
        description="Foul FC Alpha"
        variant="sidebar"
        onEventEdit={vi.fn()}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ minWidth: touchTargets.minimum, minHeight: touchTargets.minimum });
  });
});
