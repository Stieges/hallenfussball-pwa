/**
 * @OB-055 — Architektur-Wächter DialogSurface (geschärft in B-43b1).
 *
 * Zwei Zähler, beide mit Obergrenze (dürfen nur sinken; b2/b3 senken sie weiter):
 *  1. Dialog-Marker außerhalb von DialogSurface: `role` in allen Schreibweisen
 *     (dialog/alertdialog, doppelte/einfache Anführungszeichen, {'…'}, {`…`}),
 *     `aria-modal` ohne `role` in der Nähe und `createPortal(`.
 *  2. Abdunkelungen: `position: 'fixed'` mit Overlay-Farbe (overlay*-Token oder
 *     rgba(0, 0, 0 …) in der Nähe) – eigene Scrims neben DialogSurface.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { countDialogMarkers, countScrims } from '../../../../test/dialogGuard';

/** Stand nach B-43b1 (vorher 42 / 29). */
const OBERGRENZE_MARKER = 31;
const OBERGRENZE_SCRIMS = 21;

const SRC = resolve(process.cwd(), 'src');

function produktivDateien(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'test' || name === 'node_modules') {continue;}
      out.push(...produktivDateien(full));
    } else if (/\.(tsx?)$/.test(name) && !/\.test\.|\.spec\./.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function zaehle(fn: (source: string) => number): { summe: number; treffer: string[] } {
  let summe = 0;
  const treffer: string[] = [];
  for (const file of produktivDateien(SRC)) {
    if (file.endsWith('DialogSurface.tsx')) {continue;}
    const n = fn(readFileSync(file, 'utf8'));
    if (n > 0) {
      summe += n;
      treffer.push(`${file} (${n})`);
    }
  }
  return { summe, treffer };
}

describe('@OB-055 Architektur-Wächter DialogSurface', () => {
  it('Dialog-Marker (role, aria-modal ohne role, createPortal) außerhalb von DialogSurface nicht mehr als Obergrenze', () => {
    const { summe, treffer } = zaehle(countDialogMarkers);
    expect(summe, treffer.join('\n')).toBeLessThanOrEqual(OBERGRENZE_MARKER);
  }, 60_000); // Dateibaum-Lauf unter Hook-Last (parallele Worker)

  it('Abdunkelungen über position: fixed mit Overlay-Farbe außerhalb von DialogSurface nicht mehr als Obergrenze', () => {
    const { summe, treffer } = zaehle(countScrims);
    expect(summe, treffer.join('\n')).toBeLessThanOrEqual(OBERGRENZE_SCRIMS);
  }, 60_000);
});

describe('@OB-055 Wächter – Gegenbeispiele (jede Schreibweise wird erkannt)', () => {
  it.each([
    ['doppelte Anführungszeichen', '<div role="dialog" />'],
    ['einfache Anführungszeichen', "<div role='dialog' />"],
    ['Ausdruck mit einfachen Anführungszeichen', "<div role={'dialog'} />"],
    ['Ausdruck mit doppelten Anführungszeichen', '<div role={"dialog"} />'],
    ['Ausdruck mit Backticks', '<div role={`dialog`} />'],
    ['alertdialog', '<div role="alertdialog" />'],
    ['alertdialog einfach', "<div role='alertdialog' />"],
    ['Ausdruck mit Leerraum', "<div role = { 'dialog' } />"],
    ['aria-modal ohne role', '<div\n  aria-modal="true"\n/>'],
    ['createPortal', 'return createPortal(x, document.body);'],
  ])('Marker erkannt: %s', (_name, source) => {
    expect(countDialogMarkers(source)).toBe(1);
  });

  it('Marker: role und aria-modal nebeneinander zählen einmal (kein Doppeltreffer)', () => {
    expect(countDialogMarkers('<div\n  role="dialog"\n  aria-modal="true"\n/>')).toBe(1);
  });

  it('Marker: ein normales Element ohne Dialog-Rolle zählt nicht', () => {
    expect(countDialogMarkers('<div role="presentation" aria-label="x" />')).toBe(0);
    expect(countDialogMarkers("<div role='button' />")).toBe(0);
  });

  it.each([
    ['overlay-Token', "const s = {\n  position: 'fixed',\n  background: cssVars.colors.overlay,\n};"],
    ['overlayStrong-Token', "const s = {\n  position: 'fixed',\n  backgroundColor: cssVars.colors.overlayStrong,\n};"],
    ['rgba(0, 0, 0, …)', "const s = {\n  position: 'fixed',\n  background: 'rgba(0, 0, 0, 0.6)',\n};"],
    ['rgba(0,0,0,…) ohne Leerzeichen', 'const s = {\n  position: "fixed",\n  background: "rgba(0,0,0,.5)",\n};'],
    ['Overlay-Farbe vor position', "const s = {\n  background: 'rgba(0, 0, 0, 0.6)',\n  position: 'fixed',\n};"],
  ])('Abdunkelung erkannt: %s', (_name, source) => {
    expect(countScrims(source)).toBe(1);
  });

  it('Abdunkelung: fixe Leiste ohne Overlay-Farbe zählt nicht', () => {
    expect(countScrims("const s = {\n  position: 'fixed',\n  bottom: 0,\n  background: cssVars.colors.surface,\n};")).toBe(0);
  });

  it('Abdunkelung: Overlay-Farbe ohne position fixed zählt nicht', () => {
    expect(countScrims("const s = {\n  position: 'absolute',\n  background: 'rgba(0, 0, 0, 0.3)',\n};")).toBe(0);
  });
});

describe('T1 Dialogbreiten kommen nur aus dialogWidths', () => {
  const DATEIEN = [
    'components/ui/molecules/DialogSurface.tsx',
    'components/dialogs/Dialog.tsx',
    'components/dialogs/ConsentDialog.tsx',
    'components/ui/ConfirmDialog.tsx',
    'features/auth/components/InviteDialog.tsx',
    'features/auth/components/InviteLinkDialog.tsx',
    'features/auth/components/RoleChangeDialog.tsx',
    'features/auth/components/TransferOwnershipDialog.tsx',
    'components/ui/LogoUploadDialog.tsx',
    'components/match-cockpit/PostMatchModal.tsx',
    'features/tournament-management/MonitorEditor.tsx',
    'features/tournament-management/TeamsTab.tsx',
  ];
  it.each(DATEIEN)('%s: kein maxWidth-Literal in px', (datei) => {
    const source = readFileSync(join(SRC, datei), 'utf8');
    expect(source).not.toMatch(/maxWidth\s*=\s*\{?\s*['"]?\d+(px)?['"]?/);
  });
});
