/**
 * B-50 Review m4: Die Klärungsliste wird nur abgefragt mit Recht der Turnierleitung, mit Netz und bei Turnieren in der Cloud
 * (nicht Gast). Gegenbeispiele: Gast, ohne Netz, Helfer.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const lage = { lead: true, online: true, accountId: 'olli' as string | null };
const read = vi.fn().mockResolvedValue({ ok: true, reviews: [] });
vi.mock('../../auth/hooks/useCan', () => ({ useCan: () => lage.lead }));
vi.mock('../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: lage.online }) }));
vi.mock('../../match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => (lage.accountId === null ? null : { accountId: lage.accountId }),
}));
vi.mock('../../../core/repositories/matchReviewsRpc', () => ({ readMatchReviews: (...args: unknown[]) => read(...args) as unknown }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
const { useMatchReviews } = await import('../useMatchReviews');

function lauf(over: Partial<typeof lage>) {
  Object.assign(lage, { lead: true, online: true, accountId: 'olli' }, over);
  read.mockClear();
  return renderHook(() => useMatchReviews('live-cup'));
}

describe('useMatchReviews (Review m4)', () => {
  it('Turnierleitung, Cloud, mit Netz: fragt list_match_reviews ab', async () => {
    lauf({});
    await waitFor(() => expect(read).toHaveBeenCalledWith({}, 'live-cup'));
  });

  it.each([
    ['Gast-Turnier', { accountId: 'guest' }],
    ['ohne Netz', { online: false }],
    ['Helfer (kein leadMatches)', { lead: false }],
  ])('Gegenbeispiel %s: keine Abfrage', async (_name, over) => {
    lauf(over);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(read).not.toHaveBeenCalled();
  });
});
