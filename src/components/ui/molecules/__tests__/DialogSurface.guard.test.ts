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

/**
 * Stand nach B-43b3 (vorher 42 / 29, nach b1 31 / 21, nach b2 16 / 6): keine eigenen Dialoge
 * und keine eigenen Abdunkelungen mehr. Was übrig bleibt, steht begründet in AUSNAHMEN.
 * Die Obergrenzen dürfen nur sinken – neue Dialoge gehören auf DialogSurface.
 */
const OBERGRENZE_MARKER = 0;
const OBERGRENZE_SCRIMS = 0;

type Zaehler = 'marker' | 'scrims';

/**
 * Begründete Ausnahmen: Dateien, die kein Modal sind. Die Ausnahme gilt NUR für den genannten
 * Zähler und nur bis `erlaubt` Treffer (B-43b3): jeder weitere Marker bzw. jede weitere
 * Abdunkelung in der Datei wird gezählt. Jede Ausnahme braucht einen Grund; die Datei muss existieren.
 */
const AUSNAHMEN: Record<string, { zaehler: Zaehler; erlaubt: number; grund: string }> = {
  'features/auth/components/SetPasswordScreen.tsx': {
    zaehler: 'scrims',
    erlaubt: 1,
    grund: 'Seite (kein Dialog, role=main): die fixe Fläche mit backdrop-Farbe ist der Seitenhintergrund der Passwort-Karte über eine eigene Route.',
  },
  'features/collaboration/components/SyncFailedList.tsx': {
    zaehler: 'marker',
    erlaubt: 1,
    grund: 'Nicht-modales Popover unter der Sync-Leiste (absolut positioniert, deckende Fläche, ohne Abdunkelung); die Rückfrage darin nutzt ConfirmDialog.',
  },
  'components/ui/ColorPicker.tsx': {
    zaehler: 'marker',
    erlaubt: 1,
    grund: 'Auswahl-Popover am Feld (kein Modal, keine Abdunkelung, kein Fokusfang).',
  },
  // Merge main → Spur B (I1): Die beiden Service-Worker-Dateien aus Spur A rendern keinen Dialog, sie
  // ERKENNEN einen offenen modalen Dialog (Update erst, wenn keiner offen ist).
  'lib/swIdle.ts': {
    zaehler: 'marker',
    erlaubt: 4,
    grund: 'Kein Dialog: Leerlauf-Prüfung des Service-Worker-Updates sucht per Selektor nach einem offenen modalen Dialog (role + aria-modal) in Kommentar und Abfrage.',
  },
  'lib/swRegistration.ts': {
    zaehler: 'marker',
    erlaubt: 1,
    grund: 'Kein Dialog: der MutationObserver beobachtet die Attribute role/aria-modal, um nach dem Schließen eines Dialogs das Update nachzuholen.',
  },
};

/** Treffer einer Datei, die nach Abzug der erlaubten Ausnahme übrig bleiben. */
function abzugAusnahme(file: string, zaehler: Zaehler, n: number): number {
  const a = Object.entries(AUSNAHMEN).find(([rel, x]) => x.zaehler === zaehler && file.endsWith(rel))?.[1];
  return a ? Math.max(0, n - a.erlaubt) : n;
}

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

function zaehle(zaehler: Zaehler, fn: (source: string) => number): { summe: number; treffer: string[] } {
  let summe = 0;
  const treffer: string[] = [];
  for (const file of produktivDateien(SRC)) {
    if (file.endsWith('DialogSurface.tsx')) {continue;}
    const n = abzugAusnahme(file, zaehler, fn(readFileSync(file, 'utf8')));
    if (n > 0) {
      summe += n;
      treffer.push(`${file} (${n})`);
    }
  }
  return { summe, treffer };
}

describe('@OB-055 Architektur-Wächter DialogSurface', () => {
  it('Dialog-Marker (role, aria-modal ohne role, createPortal) außerhalb von DialogSurface nicht mehr als Obergrenze', () => {
    const { summe, treffer } = zaehle('marker', countDialogMarkers);
    expect(summe, treffer.join('\n')).toBeLessThanOrEqual(OBERGRENZE_MARKER);
  }, 60_000); // Dateibaum-Lauf unter Hook-Last (parallele Worker)

  it('Abdunkelungen über position: fixed mit Overlay-Farbe außerhalb von DialogSurface nicht mehr als Obergrenze', () => {
    const { summe, treffer } = zaehle('scrims', countScrims);
    expect(summe, treffer.join('\n')).toBeLessThanOrEqual(OBERGRENZE_SCRIMS);
  }, 60_000);
});

describe('@OB-055 Wächter – Ausnahmeliste', () => {
  it.each(Object.entries(AUSNAHMEN))('%s: Datei existiert und der Grund ist begründet', (rel, a) => {
    expect(statSync(join(SRC, rel)).isFile()).toBe(true);
    expect(a.grund.length).toBeGreaterThan(30);
  });

  it('Gegenbeispiel: eine Ausnahme gilt nur für ihren Zähler und nur bis zur erlaubten Zahl', () => {
    const popover = join(SRC, 'features/collaboration/components/SyncFailedList.tsx');
    expect(abzugAusnahme(popover, 'marker', 1)).toBe(0);
    expect(abzugAusnahme(popover, 'marker', 2)).toBe(1);
    expect(abzugAusnahme(popover, 'scrims', 1)).toBe(1);
  });

  it('Die erlaubten Marker der Ausnahmedateien stimmen mit dem Stand überein (nicht mehr, nicht weniger)', () => {
    for (const [rel, a] of Object.entries(AUSNAHMEN)) {
      const n = (a.zaehler === 'marker' ? countDialogMarkers : countScrims)(readFileSync(join(SRC, rel), 'utf8'));
      expect(n, rel).toBe(a.erlaubt);
    }
  });
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

  it('Marker: role als Prop im öffnenden Tag von DialogSurface zählt nicht, daneben ein eigenes Element schon', () => {
    const prop = '<DialogSurface\n  isOpen\n  role="alertdialog"\n  maxWidth={w}\n>\n  <p>x</p>\n</DialogSurface>';
    expect(countDialogMarkers(prop)).toBe(0);
    expect(countDialogMarkers(`${prop}\n<div role="alertdialog" />`)).toBe(1);
    expect(countDialogMarkers('<DialogSurface isOpen>\n  <p>x</p>\n</DialogSurface>\n<div\n  role="dialog"\n/>')).toBe(1);
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
    ['backdrop-Token', "const s = {\n  position: 'fixed',\n  background: cssVars.colors.backdrop,\n};"],
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
    'features/auth/components/RoleChangeDialog.tsx',
    'features/auth/components/TransferOwnershipDialog.tsx',
    'components/ui/LogoUploadDialog.tsx',
    'features/tournament-management/MonitorEditor.tsx',
    'features/tournament-management/TeamsTab.tsx',
    // B-43b2: Cockpit- und Match-Cockpit-Dialoge
    'components/live-cockpit/components/Dialogs/CardDialog.tsx',
    'components/live-cockpit/components/Dialogs/EventEditDialog.tsx',
    'components/live-cockpit/components/Dialogs/GoalScorerDialog.tsx',
    'components/live-cockpit/components/Dialogs/SettingsDialog.tsx',
    'components/live-cockpit/components/Dialogs/SubstitutionDialog.tsx',
    'components/live-cockpit/components/Dialogs/TimeAdjustDialog.tsx',
    'components/live-cockpit/components/Dialogs/TimePenaltyDialog.tsx',
    'components/live-cockpit/components/Tiebreaker/PenaltyShootoutDialog.tsx',
    'components/live-cockpit/components/Tiebreaker/TiebreakerBanner.tsx',
    // B-43b3: Anmeldung, Spielbericht, Zuschauer, Schedule-Editor
    'features/auth/components/LoginDialogs.tsx',
    'features/auth/components/LoginScreen.tsx',
    'features/auth/components/RegisterDialogs.tsx',
    'features/auth/components/RegisterScreen.tsx',
    'features/auth/components/MergeAccountDialog.tsx',
    'components/schedule/MatchSummary/index.tsx',
    'components/dialogs/CorrectionDialog.tsx',
    'features/public-view/components/TeamSelectorDialog.tsx',
    'features/schedule-editor/components/ConflictDialog.tsx',
  ];
  /** JSX-Prop `maxWidth="480px"` und Stilwert `maxWidth: '400px'`; Dialogbreiten liegen bei 350 px und mehr (Eingabefelder mit 100–140 px und Vorschaubilder mit 300 px sind keine). */
  const BREITEN_LITERAL = /maxWidth\s*[=:]\s*\{?\s*['"]?(?:3[5-9]|[4-9]\d)\d(px)?['"]?/;
  it.each(DATEIEN)('%s: kein maxWidth-Literal in px', (datei) => {
    const source = readFileSync(join(SRC, datei), 'utf8');
    expect(source).not.toMatch(BREITEN_LITERAL);
  });

  it('Gegenbeispiel: Stilwert und Prop mit Literal werden erkannt', () => {
    expect("maxWidth: '400px'").toMatch(BREITEN_LITERAL);
    expect('maxWidth="480px"').toMatch(BREITEN_LITERAL);
    expect('maxWidth={dialogWidths.md}').not.toMatch(BREITEN_LITERAL);
    expect("maxWidth: '120px'").not.toMatch(BREITEN_LITERAL);
  });
});
