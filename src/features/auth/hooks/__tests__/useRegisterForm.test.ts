import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRegisterForm } from '../useRegisterForm';

describe('useRegisterForm – registration code', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not validate the code client-side even when VITE_REGISTRATION_CODE is set (server validates)', () => {
    vi.stubEnv('VITE_REGISTRATION_CODE', 'geheimer-code');
    const { result } = renderHook(() => useRegisterForm());

    act(() => {
      result.current.setField('name', 'Max Mustermann');
      result.current.setField('email', 'max@example.com');
      result.current.setField('password', 'passwort123');
      result.current.setField('confirmPassword', 'passwort123');
      result.current.setField('registrationCode', 'falscher-code');
    });

    let valid = false;
    act(() => {
      valid = result.current.validateForm();
    });

    expect(valid).toBe(true);
    expect(result.current.errors.registrationCode).toBeUndefined();
  });
});
