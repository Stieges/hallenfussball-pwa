/**
 * A-07e M-1 (@AN-024, @FU-006, Record Ü1.1): Die automatische Gast-Migration beim Anmelden ist
 * entfernt. `useInitialSync` (der letzte Upload-Weg beim Anmelden) ist gelöscht und darf nicht
 * über App.tsx oder den Hooks-Ordner zurückkommen. Mutation: alten Hook-Body + Mount zurück → rot.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../../', import.meta.url));

describe('A-07e M-1: keine automatische Gast-Migration beim Anmelden', () => {
  it('useInitialSync-Datei existiert nicht', () => {
    expect(existsSync(`${src}hooks/useInitialSync.ts`)).toBe(false);
  });

  it('App.tsx mountet keinen Initial-Sync', () => {
    const app = readFileSync(`${src}App.tsx`, 'utf-8');
    expect(app).not.toContain('useInitialSync');
    expect(app).not.toContain('InitialSyncManager');
  });
});
