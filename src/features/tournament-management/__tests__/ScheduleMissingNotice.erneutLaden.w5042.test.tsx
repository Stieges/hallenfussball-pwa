/**
 * @W5-042: „Erneut laden“ im Hinweis eines festgelegten Turniers ohne Spiele meldet sich zurück: während des Lesens ist die Taste
 * gesperrt und zeigt „Wird geladen …“ (im Test der i18n-Schlüssel); liefert der Server danach weiter keine Spiele, steht eine Zusatzzeile da und die Taste ist frei.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../../auth/hooks/useCan', () => ({ useCan: () => true }));

import { ScheduleMissingNotice } from '../ScheduleMissingNotice';

function held() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => { resolve = res; });
  return { promise, resolve };
}

function mount(onReload: () => Promise<void>) {
  return render(<ScheduleMissingNotice tournamentId="t1" isDraft={false} onOpenWizard={vi.fn()} onReload={onReload} />);
}

describe('@W5-042 Erneut laden mit Rückmeldung', () => {
  it('Klick: Taste gesperrt, „Wird geladen …“ bis das Lesen fertig ist', async () => {
    const run = held();
    mount(() => run.promise);
    const button = screen.getByTestId('schedule-missing-reload');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveTextContent('scheduleMissing.reloading');
    await act(async () => { run.resolve(); await run.promise; });
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(button).not.toHaveTextContent('scheduleMissing.reloading');
  });

  it('danach ohne Spiele: Zusatzzeile sichtbar, Taste wieder frei', async () => {
    const run = held();
    mount(() => run.promise);
    fireEvent.click(screen.getByTestId('schedule-missing-reload'));
    expect(screen.queryByTestId('schedule-missing-still-empty')).toBeNull(); // noch am Laden
    await act(async () => { run.resolve(); await run.promise; });
    expect(screen.getByTestId('schedule-missing-still-empty')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-missing-still-empty')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('schedule-missing-reload')).toHaveAttribute('aria-disabled', 'false');
  });

  it('Gegenbeispiel: vor dem ersten Klick keine Zusatzzeile', () => {
    mount(() => Promise.resolve());
    expect(screen.queryByTestId('schedule-missing-still-empty')).toBeNull();
  });

  it('zweiter Klick während des Ladens löst kein zweites Lesen aus', async () => {
    const run = held();
    const onReload = vi.fn(() => run.promise);
    mount(onReload);
    const button = screen.getByTestId('schedule-missing-reload');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onReload).toHaveBeenCalledTimes(1);
    await act(async () => { run.resolve(); await run.promise; });
  });

  it('Unmount während des Lesens: kein Fehler beim Auflösen', async () => {
    const run = held();
    const view = mount(() => run.promise);
    fireEvent.click(screen.getByTestId('schedule-missing-reload'));
    view.unmount();
    await act(async () => { run.resolve(); await run.promise; });
  });
});
