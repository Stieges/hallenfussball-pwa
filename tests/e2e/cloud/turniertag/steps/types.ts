/**
 * Gemeinsame Typen der Durchstich-Schritte (A-23, Plan § 8). Jeder Schritt D1-D15 liegt als
 * eigenes Modul `dNN-*.ts` mit genau einer Besitzer-Aufgabe (keine Hotspot-Datei).
 */
import type { Browser, Page } from '@playwright/test';
import type { LoggedInRole } from '../../fixtures';

export interface StepContext {
  /** Neue, angemeldete Seite (eigener Browser-Context) für die Rolle. */
  asRole: (role: LoggedInRole) => Promise<Page>;
  browser: Browser;
  /** Unangemeldete Seite (Zuschauer, Bildschirm ohne Konto). */
  anonPage: Page;
}

export interface TurniertagStep {
  /** Schritt aus Plan § 8, z. B. `D1`, `D7b`; Unterfälle mit Suffix. */
  id: string;
  title: string;
  /** Kennungen aus den Anforderungen (im Testnamen: je MVP-Kennung ein Test). */
  scenarios: readonly string[];
  /** Besitzer-Aufgabe(n) laut Plan § 8; bei `expectedFail` die Aufgabe, die den Schritt grün macht. */
  owner: string;
  /** `true` = `test.fail`: der Besitzer ist noch nicht gebaut, der Schritt scheitert erwartungsgemäß. */
  expectedFail: boolean;
  run: (ctx: StepContext) => Promise<void>;
}
