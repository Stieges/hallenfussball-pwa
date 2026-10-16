/**
 * B-03 (V3) — @OB-012-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// @OB-012 — Ein Dialog schließt mit Esc, Zurück-Taste und Schließen-Knopf (4 Beispielzeilen)
// ---------------------------------------------------------------------------

type DialogFall = {
  kennung: string;
  zeile: string;
  person: string;
  dialog: string;
  weg: 'esc' | 'zurueck' | 'schliessen';
  oeffnen: (onClose: () => void, onConfirm: () => void) => Promise<void>;
};
const OB012: DialogFall[] = [
  {
    kennung: '@OB-012',
    zeile: 'Olli/Teilen/Esc',
    person: 'Olli',
    dialog: 'am Laptop den Dialog „Teilen“',
    weg: 'esc',
    oeffnen: async (onClose, onConfirm) => {
      const { ShareDialog } = await import('../components/dialogs/ShareDialog');
      render(
        <ShareDialog
          isOpen
          onClose={onClose}
          tournamentId="t1"
          tournamentTitle="Hallencup Ost"
          shareCode="ABC123"
          isPublic
        />
      );
      fireEvent.click(screen.getByLabelText(/share|teilen|copy|kopieren/i));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onConfirm).not.toHaveBeenCalled();
    },
  },
  {
    kennung: '@OB-012',
    zeile: 'Tom/Karte/Zurueck',
    person: 'Tom',
    dialog: 'im Cockpit von Spiel 9 den Dialog für eine Karte',
    weg: 'zurueck',
    oeffnen: async (onClose, onConfirm) => {
      const { CardDialog } = await import('../components/live-cockpit/components/Dialogs');
      render(
        <CardDialog
          isOpen
          onClose={onClose}
          onConfirm={() => onConfirm()}
          homeTeam={{ id: 'fc', name: 'FC Nord' }}
          awayTeam={{ id: 'sv', name: 'SV Süd' }}
        />
      );
      fireEvent.popState(window);
      expect(onConfirm).not.toHaveBeenCalled();
    },
  },
  {
    kennung: '@OB-012',
    zeile: 'Tom/Tor/Schliessen',
    person: 'Tom',
    dialog: 'im Cockpit von Spiel 9 den Dialog für ein Tor',
    weg: 'schliessen',
    oeffnen: async (onClose, onConfirm) => {
      const { GoalScorerDialog } = await import('../components/live-cockpit/components/Dialogs');
      render(
        <GoalScorerDialog
          isOpen
          onClose={onClose}
          onConfirm={() => onConfirm()}
          teamName="FC Nord"
        />
      );
      const closeButton = screen.getByRole('button', { name: /schließen|close/i });
      fireEvent.click(closeButton);
      expect(onConfirm).not.toHaveBeenCalled();
    },
  },
  {
    kennung: '@OB-012',
    zeile: 'Olli/Ergebnis-korrigieren/Zurueck',
    person: 'Olli',
    dialog: 'auf dem Tablet den Dialog „Ergebnis korrigieren“ von Spiel 7',
    weg: 'zurueck',
    oeffnen: async (onClose, onConfirm) => {
      const { CorrectionDialog } = await import('../components/dialogs/CorrectionDialog');
      const { ToastProvider } = await import('../components/ui/Toast');
      render(
        <ToastProvider>
          <CorrectionDialog
            isOpen
            onClose={onClose}
            onConfirm={() => onConfirm()}
            matchLabel="Spiel 7"
            teamA="FC Nord"
            teamB="SV Süd"
            originalScoreA={2}
            originalScoreB={1}
          />
        </ToastProvider>
      );
      fireEvent.popState(window);
      expect(onConfirm).not.toHaveBeenCalled();
    },
  },
];
describe('@OB-012 Ein Dialog schließt mit Esc, Zurück-Taste und Schließen-Knopf, ohne etwas zu ändern', () => {
  it.each(OB012)('$kennung $zeile: $dialog schließt per $weg ohne Speichern', async ({ oeffnen }) => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    await oeffnen(onClose, onConfirm);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(onConfirm).not.toHaveBeenCalled();
  }, 30_000);
});
