/**
 * B-03 (V3) — @OB-003-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { VERBOTENE_ANKUENDIGUNG, findeAnkuendigungen, renderInRouter, renderSettingsScreen } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// @OB-003 — Kein Text kündigt eine Funktion für später an (4 Beispielzeilen)
// ---------------------------------------------------------------------------

type AnkuendigungsFall = {
  kennung: string;
  zeile: string;
  person: string;
  sprache: 'de' | 'en';
  seiten: () => Promise<void>;
};
const OB003: AnkuendigungsFall[] = [
  {
    kennung: '@OB-003',
    zeile: 'Olli/Deutsch',
    person: 'Olli',
    sprache: 'de',
    seiten: async () => {
      await renderSettingsScreen();
    },
  },
  {
    kennung: '@OB-003',
    zeile: 'Olli/Englisch',
    person: 'Olli',
    sprache: 'en',
    seiten: async () => {
      await renderSettingsScreen();
    },
  },
  {
    kennung: '@OB-003',
    zeile: 'Tom/Deutsch',
    person: 'Tom',
    sprache: 'de',
    seiten: async () => {
      const { GameControls } = await import('../components/live-cockpit/components/GameControls');
      render(
        <GameControls
          status="RUNNING"
          onStart={vi.fn()}
          onPauseResume={vi.fn()}
          onEditTime={vi.fn()}
          onSwitchSides={vi.fn()}
          onFinish={vi.fn()}
        />
      );
    },
  },
  {
    kennung: '@OB-003',
    zeile: 'MamaPetra/Deutsch',
    person: 'Mama Petra',
    sprache: 'de',
    seiten: async () => {
      const { Footer } = await import('../components/layout/Footer');
      renderInRouter(<Footer />);
    },
  },
];
describe('@OB-003 Kein Text kündigt eine Funktion für später an', () => {
  it.each(OB003)('$kennung $zeile: $person ($sprache) sieht keine Ankündigung', async ({ sprache, seiten }) => {
    const treffer = findeAnkuendigungen(sprache);
    expect(treffer, `Ankündigungen im Textkorpus (${sprache})`).toEqual([]);
    await seiten();
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(VERBOTENE_ANKUENDIGUNG);
  }, 30_000);
});
