/**
 * useOutboxReport (R3-2a, Plan F3; Befund C-GERAET-STILL-OHNE-MELDUNG; @LZ-018, @FU-068): meldet dem Server alle 30 s die Zahl
 * wartender Einträge dieses Geräts je Turnier (`report_device_outbox`) – Grundlage der Warnungen vor dem Abschluss
 * „Feld 2: 3 Einträge noch nicht übertragen“ und „Gerät still“ (`finish_warnings`, 20261113_003). Läuft auf jedem angemeldeten
 * Gerät, auch dem der Turnierleitung; nur bei sichtbarer Seite und mit Netz, nie für Gäste. Was wann gemeldet wird, entscheidet
 * `dueOutboxReports` (Zahl > 0 oder steuerndes Gerät: jeden Takt; sonst nur bei Änderung). Eine gescheiterte Meldung zählt nicht
 * als gesendet; der nächste Takt versucht es erneut. Sperrt nie etwas.
 */
import { useEffect } from 'react';
import { getDeviceId } from '../../core/device/deviceId';
import { dueOutboxReports, type OutboxReport } from '../../core/fieldControl/outboxReport';
import { ownFieldsByTournament } from '../../core/fieldControl/ownFields';
import { reportDeviceOutbox } from '../../core/repositories/deviceOutboxReportRpc';
import type { OutboxStatus } from '../../core/match/client/outboxTypes';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export const OUTBOX_REPORT_INTERVAL_MS = 30000;

export interface OutboxReportInput {
  /** Status des Ausgangs (wartende Einträge je Turnier); `null` = noch kein Sender. */
  sender: { getStatus(): OutboxStatus } | null;
  accountId: string;
}

function due(): boolean {
  return document.visibilityState !== 'hidden' && (typeof navigator === 'undefined' || navigator.onLine);
}

export function useOutboxReport({ sender, accountId }: OutboxReportInput): void {
  const active = isSupabaseConfigured && supabase !== null && sender !== null && accountId !== 'guest';

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const deviceId = getDeviceId();
    // Je Konto neu: was ein anderes Konto gemeldet hat, gilt hier nicht als gesendet.
    let lastSent: Record<string, OutboxReport> = {};
    let running = false;
    let stopped = false;
    const tick = async (): Promise<void> => {
      if (running || !due()) {
        return;
      }
      running = true;
      try {
        const reports = dueOutboxReports({
          pendingByTournament: sender.getStatus().pendingByTournament,
          ownFieldsByTournament: ownFieldsByTournament(),
          lastSent,
        });
        for (const report of reports) {
          if (stopped || !(await reportDeviceOutbox(supabase, deviceId, report))) {
            continue;
          }
          const { [report.tournamentId]: _previous, ...rest } = lastSent;
          // 0 ohne Feld ist der Ruhezustand: danach gibt es nichts mehr zu melden, bis wieder etwas wartet
          lastSent = report.pending === 0 && report.field === null ? rest : { ...rest, [report.tournamentId]: report };
        }
      } finally {
        running = false;
      }
    };
    void tick();
    const timer = setInterval(() => { void tick(); }, OUTBOX_REPORT_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, sender, accountId]);
}
