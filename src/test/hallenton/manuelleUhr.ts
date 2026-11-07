/**
 * Test-Hilfe Hallenton (H3b-1): von Hand vorgerückte Zeit mit getrennten Gruppen (z. B. „worker“ und „haupt“).
 * Eine stumme Gruppe feuert nicht (Worker setzt aus); wird sie wieder laut, feuert ein überfälliger Takt einmal und
 * läuft ab dann im alten Abstand weiter – wie ein Browser, der aufgelaufene Takte zusammenfasst.
 */
import type { Zeitgeber } from '../../features/hallenton/runtime/zeitgeber';

interface Timer {
  id: number;
  at: number;
  every: number | null;
  fn: () => void;
  gruppe: string;
}

export class ManuelleUhr {
  private jetztMs: number;
  private naechsteId = 1;
  private timers: Timer[] = [];
  private readonly stumm = new Set<string>();

  constructor(startMs = 0) {
    this.jetztMs = startMs;
  }

  jetzt(): number {
    return this.jetztMs;
  }

  gruppe(name: string): Zeitgeber {
    return {
      jetzt: () => this.jetztMs,
      wiederholen: (fn, ms) => this.planen(name, fn, ms, ms),
      spaeter: (fn, ms) => this.planen(name, fn, ms, null),
    };
  }

  stummschalten(gruppe: string): void {
    this.stumm.add(gruppe);
  }

  lautschalten(gruppe: string): void {
    this.stumm.delete(gruppe);
    for (const timer of this.timers) {
      if (timer.gruppe === gruppe && timer.at < this.jetztMs) {
        timer.at = this.jetztMs;
      }
    }
    this.vorruecken(0);
  }

  /** Zeit um `ms` vorrücken und dabei alle fälligen Timer der lauten Gruppen in Zeitfolge auslösen. */
  vorruecken(ms: number): void {
    const ziel = this.jetztMs + ms;
    for (;;) {
      const faellig = this.timers
        .filter((t) => !this.stumm.has(t.gruppe) && t.at <= ziel)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!faellig) {
        break;
      }
      this.jetztMs = Math.max(this.jetztMs, faellig.at);
      if (faellig.every === null) {
        this.timers = this.timers.filter((t) => t !== faellig);
      } else {
        faellig.at += faellig.every;
      }
      faellig.fn();
    }
    this.jetztMs = ziel;
  }

  private planen(gruppe: string, fn: () => void, ms: number, every: number | null): () => void {
    const timer: Timer = { id: this.naechsteId++, at: this.jetztMs + Math.max(0, ms), every, fn, gruppe };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((t) => t !== timer);
    };
  }
}
