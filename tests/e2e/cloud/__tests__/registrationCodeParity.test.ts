import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { E2E_REGISTRATION_CODE } from '../testData';

/**
 * `E2E_REGISTRATION_CODE` (tests/e2e/cloud/testData.ts) und `scripts/lib/e2e-registration-code.sh`
 * (gesourced von `npm run test:env:up`/`test:env:reset`, injiziert als `E2E_REGISTRATION_CODE`
 * in `supabase/config.toml` → `[edge_runtime.secrets] REGISTRATION_CODE`) müssen exakt denselben
 * Wert tragen — sonst validiert die lokale Edge Function einen anderen Code als den, den Tests
 * und Seed erwarten. Zwei Quellen (Shell + TS) sind technisch nötig, dieser Test hält sie
 * synchron.
 */
describe('E2E_REGISTRATION_CODE Gleichlauf', () => {
  it('stimmt mit scripts/lib/e2e-registration-code.sh überein', () => {
    const shPath = join(__dirname, '../../../../scripts/lib/e2e-registration-code.sh');
    const shContent = readFileSync(shPath, 'utf8');
    const match = /export E2E_REGISTRATION_CODE="([^"]+)"/.exec(shContent);
    expect(match, 'scripts/lib/e2e-registration-code.sh muss E2E_REGISTRATION_CODE exportieren').not.toBeNull();
    expect(match?.[1]).toBe(E2E_REGISTRATION_CODE);
  });
});
