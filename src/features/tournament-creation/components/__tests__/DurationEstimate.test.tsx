import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DurationEstimate } from '../DurationEstimate';
import type { Tournament } from '../../../../types/tournament';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (!opts) {
        return key;
      }
      return `${key}:${JSON.stringify(opts)}`;
    },
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

const baseFormData: Partial<Tournament> = {
  numberOfTeams: 8,
  numberOfFields: 2,
  numberOfGroups: 2,
  groupSystem: 'roundRobin',
};

describe('DurationEstimate — F-112 division-by-zero guards', () => {
  it('renders normally for valid defaults', () => {
    const { container } = render(<DurationEstimate formData={baseFormData} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('returns null when numberOfFields is 0 (would cause division by zero)', () => {
    const { container } = render(
      <DurationEstimate formData={{ ...baseFormData, numberOfFields: 0 }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when numberOfTeams is 0', () => {
    const { container } = render(
      <DurationEstimate formData={{ ...baseFormData, numberOfTeams: 0 }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when numberOfGroups is 0 in groupsAndFinals mode', () => {
    const { container } = render(
      <DurationEstimate
        formData={{ ...baseFormData, groupSystem: 'groupsAndFinals', numberOfGroups: 0 }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when numberOfFields is negative', () => {
    const { container } = render(
      <DurationEstimate formData={{ ...baseFormData, numberOfFields: -1 }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('still renders in roundRobin mode even if numberOfGroups is 0 (unused)', () => {
    const { container } = render(
      <DurationEstimate
        formData={{ ...baseFormData, groupSystem: 'roundRobin', numberOfGroups: 0 }}
      />
    );
    expect(container.firstChild).not.toBeNull();
  });
});
