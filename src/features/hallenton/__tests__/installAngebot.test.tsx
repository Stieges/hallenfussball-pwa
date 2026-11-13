/**
 * H4-9 @HT-043: Schritt „App installieren“ – das Angebot des Browsers (`beforeinstallprompt`) wird beim Start festgehalten; die Taste öffnet es
 * einmal. Ohne Angebot keine Taste, der Schritt erklärt den Menüweg; ist die App schon installiert, ist der Schritt erledigt.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncExternalStore } from 'react';
import { __setzeInstallAngebotFuerTests, abonniereInstallAngebot, installAngebotVorhanden, installiereApp, starteInstallAngebot } from '../runtime/installAngebot';
import { EinrichtungSchritte } from '../ui/EinrichtungSchritte';

vi.mock('react-i18next', async () => {
  const de = (await import('../../../i18n/locales/de/hallenton.json')).default;
  return {
    useTranslation: () => ({
      i18n: { language: 'de' },
      t: (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], de) as string,
    }),
  };
});

const ereignis = () => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
  prompt: vi.fn(() => Promise.resolve()), userChoice: Promise.resolve({ outcome: 'accepted' as const }),
});

beforeEach(() => __setzeInstallAngebotFuerTests());

describe('Angebot „App installieren“ festhalten', () => {
  it('das Ereignis wird festgehalten (und der Browser öffnet sein Angebot nicht von selbst); die Taste öffnet es genau einmal', async () => {
    starteInstallAngebot();
    const { result } = renderHook(() => useSyncExternalStore(abonniereInstallAngebot, installAngebotVorhanden, () => false));
    expect(result.current).toBe(false);
    const e = ereignis();
    act(() => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
    expect(result.current).toBe(true);
    await act(async () => { await installiereApp(); });
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);
    await act(async () => { await installiereApp(); });
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });
  it('„appinstalled“ nimmt das Angebot weg', () => {
    starteInstallAngebot();
    act(() => { window.dispatchEvent(ereignis()); });
    expect(installAngebotVorhanden()).toBe(true);
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(installAngebotVorhanden()).toBe(false);
  });
});

describe('Schritt 1 in der Einrichtung', () => {
  const schritte = (teil: Partial<Parameters<typeof EinrichtungSchritte>[0]> = {}) => render(
    <EinrichtungSchritte installiert={false} installAngebot={false} onInstallieren={vi.fn()} schalterErledigt={false} tonErledigt={false} schalter={<span />} {...teil} />,
  );
  it('mit Angebot → Taste „App installieren“, die das Angebot öffnet', () => {
    const onInstallieren = vi.fn();
    schritte({ installAngebot: true, onInstallieren });
    fireEvent.click(screen.getByTestId('einrichtung-installieren'));
    expect(onInstallieren).toHaveBeenCalledTimes(1);
  });
  it('Gegenbeispiel: ohne Angebot keine Taste, dafür der Weg über das Browser-Menü', () => {
    schritte();
    expect(screen.queryByTestId('einrichtung-installieren')).toBeNull();
    expect(screen.getByTestId('einrichtung-schritt-1')).toHaveTextContent('Im Browser-Menü „App installieren“');
  });
  it('schon installiert → Schritt als erledigt markiert, Schritt 2 ist der aktuelle', () => {
    schritte({ installiert: true });
    expect(screen.getByTestId('einrichtung-schritt-1')).toHaveAttribute('data-done', 'true');
    expect(screen.getByTestId('einrichtung-schritt-1')).toHaveTextContent('erledigt');
    expect(screen.getByTestId('einrichtung-schritt-2')).toHaveAttribute('data-now', 'true');
    expect(screen.queryByTestId('einrichtung-installieren')).toBeNull();
  });
});
