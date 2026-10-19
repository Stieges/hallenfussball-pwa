/**
 * D0a-D0e und D16: die Vorbereitung VOR dem Turniertag (Plan "Turnier durchspielbar" (b), Paket DV). Alle Schritte sind
 * `expectedFail`: jeder prüft einen Soll-Marker, den der genannte Besitzer erst baut (Regel T3: der Schritt wird grün in dem
 * Paket, das ihn liefert). Die Marker (`data-testid`) präzisiert der Besitzer beim Bauen.
 * ACHTUNG: Nur D0a, D0c und D0b/D16 in Teilen prüfen schon heute eine fachliche Wirkung; bei D0d, D0e und D16 ist es nur der Marker.
 * Der Besitzer MUSS beim Bauen die Wirkung ergänzen (Regel T3), sonst macht ein fremdes Element den Schritt grün.
 */
import { expect } from '@playwright/test';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

/** D0a: Wizard (5 Schritte) legt ein Turnier mit eigener Halbfinal-Regel an; die Halbfinals tragen ihre Phase aus dem Generator. */
async function wizardAnlegen({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await ownerPage.goto('/#/tournament/new');
  await ownerPage.waitForLoadState('networkidle');
  await expectPageAnchor(ownerPage.locator('[aria-current="step"]').first(), 'Wizard-Schrittleiste');
  await expectSollMarker(ownerPage, 'wizard-playoff-decision-rule');
  // Wirkung (Cloud): Halbfinals sind als Halbfinale gespeichert, nicht als "final" (C-FINALPHASE-AUS-ID).
  const { finals } = await fetchTurniertagBracket();
  const halbfinals = finals.filter((m) => (m.label ?? '').includes('Halbfinale'));
  expect(halbfinals).toHaveLength(2);
  expect(halbfinals.map((m) => m.phase)).not.toContain('final');
}

/** D0b: Kopie fürs Proben startet leer. Das Szenario fehlt (Anforderung offen, Controller nimmt es in den Wizard-Record auf). */
async function kopieFuersProben({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await ownerPage.goto('/#/');
  await expectPageAnchor(ownerPage.locator(`[data-testid="tournament-card-${TURNIERTAG_ID}"]`), 'Turnierkarte im Dashboard');
  await expectSollMarker(ownerPage, 'tournament-copy-button');
}

/** D0c: Anmelden am Turniertag: kein Registrieren, ehrliche Hinweise, bei langsamem Netz keine stille Abmeldung. */
async function anmeldenTurniertag({ anonPage }: StepContext): Promise<void> {
  await anonPage.goto('/#/login');
  await expectPageAnchor(anonPage.locator('input[type="email"]').first(), 'Anmeldeseite');
  // @AN-005 / @AN-015: die Anmeldeseite bietet kein Registrieren und nur Wege an, die es gibt.
  await expect(anonPage.getByRole('link', { name: /registrieren/i }), 'kein Registrieren-Link').toHaveCount(0, { timeout: SOLL_TIMEOUT_MS });
  await expect(anonPage.getByRole('button', { name: /passwort vergessen/i }), 'kein "Passwort vergessen" ohne Mailversand (@AN-010)').toHaveCount(0, { timeout: SOLL_TIMEOUT_MS });
  // C-SITZUNG-STILL: langsames Netz beim Start meldet "Sitzung abgelaufen" ehrlich statt still abzumelden.
  await expectSollMarker(anonPage, 'session-expired-notice');
}

/** D0d: Turnier teilen: Aushang (A5-Format) mit QR drucken. */
async function turnierTeilen({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/visibility');
  await expectPageAnchor(ownerPage.getByRole('heading', { name: 'Sichtbarkeit' }).first(), 'Admin-Kategorie Sichtbarkeit');
  await expectSollMarker(ownerPage, 'share-poster-print');
}

/** D16: Spielplan auf Anfang setzen / ein Spiel zurücksetzen (@SA-001, @SA-015; Stufe 3). @SA-001 ist der Testabend VOR dem Turnier: der Schritt steht deshalb
 * in der Vorbereitung und gehört auf die Kopie aus D0b (der Besitzer richtet ihn beim Bauen darauf aus); er läuft auf dem noch unbespielten Cup. */
async function aufAnfang({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/danger');
  await expectSollMarker(ownerPage, 'schedule-reset-button');
}

/** D0e: Monitor einrichten: Monitor aus der Ferne neu laden, Dauerbetrieb der Live-Folie. */
async function monitorEinrichten({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/monitors');
  await expectPageAnchor(ownerPage.getByRole('heading', { level: 2, name: 'Monitore konfigurieren' }), 'Reiter Monitore');
  await expectSollMarker(ownerPage, 'monitor-remote-reload');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D0a', title: 'Turnier im Wizard anlegen (1 und 2 Gruppen, Halbfinal-Regel, Wertung)', scenarios: ['@TM-004', '@W2A-025'], befunde: ['C-FINALPHASE-AUS-ID'], owner: 'A-12a/b (GA4-Oberfläche)', expectedFail: true, run: wizardAnlegen },
  { id: 'D0b', title: 'Kopie fürs Proben startet leer, eigener Freigabe-Code', scenarios: [], befunde: ['C-COPY-DASH', 'C-KOPIE-ERGEBNISSE', 'C-COPY-AC-FELDER', 'C-COPY-AC-ID'], owner: 'Anforderung offen (Paket KP)', expectedFail: true, run: kopieFuersProben },
  { id: 'D16', title: 'Spielplan auf Anfang setzen, Spiel zurücksetzen (auf der Kopie fürs Proben)', scenarios: ['@SA-001', '@SA-015'], owner: 'A-33/B-36 (Stufe 3)', expectedFail: true, run: aufAnfang },
  { id: 'D0c', title: 'Anmelden am Turniertag: kein Registrieren, ehrliche Hinweise, Sitzung im langsamen Netz', scenarios: ['@AN-005', '@AN-006', '@AN-010', '@AN-015'], befunde: ['C-REG', 'C-SMTP', 'C-SITZUNG-STILL'], owner: 'A-27 / B-30 / B-31', expectedFail: true, run: anmeldenTurniertag },
  { id: 'D0d', title: 'Turnier teilen: Aushang mit QR drucken', scenarios: ['@BM-001'], owner: 'A-36d / C9-C11', expectedFail: true, run: turnierTeilen },
  { id: 'D0e', title: 'Monitor einrichten: aus der Ferne neu laden', scenarios: ['@ME-028'], owner: 'MS3 / B-18 / B-48b/c', expectedFail: true, run: monitorEinrichten },
];
