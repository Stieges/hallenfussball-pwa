/**
 * useOutboxReport (R3-2a, Plan F3; Befund C-GERAET-STILL-OHNE-MELDUNG; @LZ-018, @FU-068): meldet dem Server die Zahl wartender
 * Einträge dieses Geräts je Turnier (`report_device_outbox`) – Grundlage der Warnungen vor dem Abschluss „Feld 2: 3 Einträge
 * noch nicht übertragen“ und „Gerät still“ (`finish_warnings`, 20261113_003). Läuft auf jedem angemeldeten Gerät, auch dem der
 * Turnierleitung; nie für Gäste. Was gemeldet wird, entscheidet `dueOutboxReports` (Zahl > 0 oder steuerndes Gerät: jedes Mal;
 * sonst nur bei Änderung; beim Start einmal je Turnier mit Kopien). Eine gescheiterte Meldung zählt nicht als gesendet. Sperrt nie.
 *
 * Wann (R3-2b, Review #392 M1 – sonst behält der Server eine veraltete Zahl):
 * - Takt alle 30 s als Herzschlag, nur bei sichtbarer Seite und mit Netz;
 * - bei jeder Änderung der wartenden Einträge sofort (kurz entprellt), mit Netz auch bei verdeckter Seite – sonst bliebe
 *   „1 Eintrag noch nicht übertragen“ stehen, wenn der Helfer das Handy direkt nach dem Senden sperrt;
 * - beim Start (neu geladen, Kontowechsel) einmal je Turnier mit Kopien, auch 0 (Abgleich).
 * Abmelden oder Kontowechsel leert den Feld-Stand des vorigen Kontos (Review #392 m1).
 */
import { useEffect } from 'react';
import { getDeviceId } from '../../core/device/deviceId';
import { dueOutboxReports, type OutboxReport } from '../../core/fieldControl/outboxReport';
import { clearOwnFields, ownFieldsByTournament } from '../../core/fieldControl/ownFields';
import { reportDeviceOutbox } from '../../core/repositories/deviceOutboxReportRpc';
import type { OutboxStatus } from '../../core/match/client/outboxTypes';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export const OUTBOX_REPORT_INTERVAL_MS = 30000;
/** Entprellung der Meldung bei Änderung: mehrere Einträge eines Sende-Laufs ergeben eine Meldung. */
export const OUTBOX_REPORT_DEBOUNCE_MS = 1000;

export interface OutboxReportInput {
  /** Status des Ausgangs (wartende Einträge je Turnier); `null` = noch kein Sender. */
  sender: { getStatus(): OutboxStatus; subscribe(listener: (status: OutboxStatus) => void): () => void } | null;
  accountId: string;
}

const online = (): boolean => typeof navigator === 'undefined' || navigator.onLine;
const visible = (): boolean => document.visibilityState !== 'hidden';
const pendingKey = (status: OutboxStatus): string =>
  JSON.stringify(Object.entries(status.pendingByTournament).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

export function useOutboxReport({ sender, accountId }: OutboxReportInput): void {
  const active = isSupabaseConfigured && supabase !== null && sender !== null && accountId !== 'guest';

  // m1: der Feld-Stand gehört zum Konto – beim Wechsel (auch Abmelden → Gast) und beim Verlassen leeren
  useEffect(() => () => { clearOwnFields(); }, [accountId]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const deviceId = getDeviceId();
    // Je Konto neu: was ein anderes Konto gemeldet hat, gilt hier nicht als gesendet.
    let lastSent: Record<string, OutboxReport> = {};
    const reconciled = new Set<string>();
    let running = false;
    let again = false;
    let stopped = false;
    const tick = async (requireVisible: boolean): Promise<void> => {
      if (!online() || (requireVisible && !visible())) {
        return;
      }
      if (running) {
        again = true; // eine Änderung während des Laufs nicht verlieren
        return;
      }
      running = true;
      try {
        const reports = dueOutboxReports({
          pendingByTournament: sender.getStatus().pendingByTournament,
          ownFieldsByTournament: ownFieldsByTournament(),
          lastSent,
          reconciled,
        });
        for (const report of reports) {
          reconciled.add(report.tournamentId); // Abgleich einmal versucht – ohne Recht nicht alle 30 s erneut
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
      if (again && !stopped) {
        again = false;
        await tick(false);
      }
    };
    void tick(true);
    const timer = setInterval(() => { void tick(true); }, OUTBOX_REPORT_INTERVAL_MS);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let seen = pendingKey(sender.getStatus());
    const unsubscribe = sender.subscribe((status) => {
      const key = pendingKey(status);
      if (key === seen) {
        return;
      }
      seen = key;
      clearTimeout(debounce);
      debounce = setTimeout(() => { void tick(false); }, OUTBOX_REPORT_DEBOUNCE_MS);
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(debounce);
      unsubscribe();
    };
  }, [active, sender, accountId]);
}
