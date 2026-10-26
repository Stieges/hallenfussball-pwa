/**
 * R3-5 Fixrunde 2 (Review #397 m-9, @ET-042): Der Hinweis „Torschützen evtl. unvollständig“ im vorläufigen Endstand – scheitert das Laden
 * der Spielsteuerung, steht er im Panel; gelingt es, nicht. Spielsteuerung (Laden der Ereignisse) gemockt, alles Übrige läuft echt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
import { render, screen, waitFor } from '@testing-library/react';
import { NK } from '../../../core/standings/__tests__/groupCompletionKit';
import { nikolausFertig } from '../../../core/services/__tests__/finishKit';
import { MatchEngineContext, type MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';
await initRealDeI18n();

const load = vi.hoisted(() => vi.fn());
vi.mock('../../match-engine/loadEngineEventsForExport', () => ({ loadEngineEventsForExport: load }));
const { FinalStandingsPanel } = await import('../components/FinalStandingsPanel');

const context = {} as MatchEngineContextValue;
const goal = { id: 'e1', type: 'GOAL', timestampSeconds: 10, payload: { teamId: NK.kammer, playerNumber: 9 } };

beforeEach(() => { load.mockReset(); });

describe('@ET-042 vorläufiger Endstand: Hinweis zu den Torschützen', () => {
  it('das Laden der Spielsteuerung scheitert → „Torschützen evtl. unvollständig (ohne Netz)“ ist sichtbar', async () => {
    load.mockRejectedValue(new Error('offline'));
    const fertig = await nikolausFertig();
    render(<MatchEngineContext.Provider value={context}><FinalStandingsPanel tournament={fertig} /></MatchEngineContext.Provider>);
    expect(await screen.findByTestId('final-scorers-incomplete')).toHaveTextContent('Torschützen evtl. unvollständig (ohne Netz)');
  });

  it('Gegenbeispiel: das Laden gelingt → kein Hinweis', async () => {
    const fertig = await nikolausFertig();
    load.mockResolvedValue(new Map([[fertig.matches[0].id, [goal]]]));
    render(<MatchEngineContext.Provider value={context}><FinalStandingsPanel tournament={fertig} /></MatchEngineContext.Provider>);
    await waitFor(() => expect(load).toHaveBeenCalled());
    await screen.findByTestId('final-scorers');
    expect(screen.queryByTestId('final-scorers-incomplete')).toBeNull();
  });
});
