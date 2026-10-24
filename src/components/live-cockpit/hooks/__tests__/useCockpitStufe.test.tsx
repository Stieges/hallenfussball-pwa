/** @SL-187: die Maße richten sich nach der Fensterhöhe – knapp unter 720, normal 720 bis 799, gross ab 800 (F5). */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { stufeFuerHoehe, useCockpitStufe } from '../useCockpitStufe';

describe('stufeFuerHoehe (@SL-187)', () => {
  it.each([
    [600, 'knapp'], [619, 'knapp'], [620, 'knapp'], [719, 'knapp'],
    [720, 'normal'], [799, 'normal'],
    [800, 'gross'], [1080, 'gross'],
  ] as const)('%i px → %s', (hoehe, stufe) => {
    expect(stufeFuerHoehe(hoehe)).toBe(stufe);
  });
});

describe('useCockpitStufe', () => {
  it('folgt der Fensterhöhe beim Skalieren', () => {
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true, writable: true });
    const { result } = renderHook(() => useCockpitStufe());
    expect(result.current).toBe('normal');
    act(() => { (window as { innerHeight: number }).innerHeight = 700; window.dispatchEvent(new Event('resize')); });
    expect(result.current).toBe('knapp');
    act(() => { (window as { innerHeight: number }).innerHeight = 900; window.dispatchEvent(new Event('resize')); });
    expect(result.current).toBe('gross');
  });
});
