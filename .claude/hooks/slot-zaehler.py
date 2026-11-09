#!/usr/bin/env python3
"""Zähllogik der Slot-Grenze für Agenten (V3). Aufruf: slot-zaehler.py start|claim|stop|reset

Liest das Hook-Ereignis (JSON) von stdin, schreibt ggf. eine Hook-Antwort (JSON) nach stdout.
Wird nur von den Wrappern agent-start-pruefen.sh / agent-start-erfasst.sh / agent-ende.sh /
slot-zuruecksetzen.sh aufgerufen; die Wrapper fangen jeden Absturz ab (Wächter darf nie blockieren).

Dateien (per Umgebungsvariable überschreibbar, für Tests):
  SLOT_AGENTEN_DATEI  Vorgabe .claude/state/agenten.json   (Zähldatei, gitignored)
  SLOT_GRENZE_DATEI   Vorgabe .claude/state/slot-grenze.json (Grenze, gitignored)
"""
import fcntl
import json
import os
import re
import sys
from datetime import datetime, timezone

VORGABE = {"slots": 2, "opus": 1}
ZWECK = re.compile(r"\b(review|ursache)", re.IGNORECASE)  # Wortanfang; „Ursachensuche“ enthält „ursache“
VERWAIST_SEK = 6 * 3600       # Eintrag älter als 6 h gilt als verwaist (Absturz o. Ä.)
UNBEANSPRUCHT_SEK = 10 * 60   # zugelassen, aber nie gestartet (anderer Hook/Rechte lehnten ab)


def projektverzeichnis():
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
    )


def pfade():
    basis = os.path.join(projektverzeichnis(), ".claude", "state")
    return (
        os.environ.get("SLOT_AGENTEN_DATEI") or os.path.join(basis, "agenten.json"),
        os.environ.get("SLOT_GRENZE_DATEI") or os.path.join(basis, "slot-grenze.json"),
    )


def jetzt():
    return datetime.now(timezone.utc)


def zeitparse(text):
    t = datetime.fromisoformat(str(text).strip().replace("Z", "+00:00"))
    if t.tzinfo is None:
        t = t.astimezone()  # naiv = Ortszeit
    return t


def grenze_lesen(datei):
    """Gibt (slots, opus, hinweis) zurück; nach Ablauf von `bis` oder bei Fehlern die Vorgabe."""
    try:
        with open(datei, encoding="utf-8") as f:
            d = json.load(f)
        if not isinstance(d, dict):
            raise ValueError("kein Objekt")
    except FileNotFoundError:
        return VORGABE["slots"], VORGABE["opus"], None
    except Exception as e:  # kaputte Grenzdatei -> Vorgabe, aber melden
        return VORGABE["slots"], VORGABE["opus"], f"slot-grenze.json unlesbar ({e}); Vorgabe gilt"
    bis = d.get("bis")
    if bis:
        try:
            if jetzt() >= zeitparse(bis):
                return VORGABE["slots"], VORGABE["opus"], None
        except Exception:
            return VORGABE["slots"], VORGABE["opus"], "slot-grenze.json: `bis` unlesbar; Vorgabe gilt"
    try:
        slots = int(d.get("slots", VORGABE["slots"]))
        opus = int(d.get("opus", VORGABE["opus"]))
    except Exception:
        return VORGABE["slots"], VORGABE["opus"], "slot-grenze.json: Zahlen unlesbar; Vorgabe gilt"
    return max(slots, 0), max(opus, 0), None


class Zaehlung:
    """Zähldatei unter exklusivem Dateisperr-Schloss (parallele Hooks)."""

    def __init__(self, datei):
        self.datei = datei
        self.hinweis = None

    def __enter__(self):
        os.makedirs(os.path.dirname(self.datei) or ".", exist_ok=True)
        self.sperre = open(self.datei + ".lock", "w")
        fcntl.flock(self.sperre, fcntl.LOCK_EX)
        self.eintraege = self._lesen()
        return self

    def _lesen(self):
        try:
            with open(self.datei, encoding="utf-8") as f:
                d = json.load(f)
            e = d["agenten"]
            if not isinstance(e, list):
                raise ValueError("agenten ist keine Liste")
            e = [x for x in e if isinstance(x, dict)]
        except FileNotFoundError:
            return []
        except Exception as ex:
            self.hinweis = f"Zähldatei kaputt ({ex}); neu angelegt"
            return []
        jetzt_ = jetzt()
        frisch = []
        for x in e:
            try:
                alter = (jetzt_ - zeitparse(x.get("ts"))).total_seconds()
            except Exception:
                continue  # Eintrag ohne lesbaren Zeitstempel ist wertlos
            if alter > VERWAIST_SEK:
                continue
            if not x.get("agent_id") and alter > UNBEANSPRUCHT_SEK:
                continue
            frisch.append(x)
        return frisch

    def speichern(self):
        tmp = self.datei + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"agenten": self.eintraege}, f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.datei)

    def __exit__(self, *a):
        self.sperre.close()


def ausgabe(**kw):
    sys.stdout.write(json.dumps(kw, ensure_ascii=False))


def beschreibe(eintraege):
    if not eintraege:
        return "keine"
    return "; ".join(
        f"[{e.get('modell') or 'Vorgabe-Modell'}] {e.get('beschreibung') or '(ohne Beschreibung)'} seit {e.get('ts')}"
        for e in eintraege
    )


def abweisen(grund):
    ausgabe(hookSpecificOutput={
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": grund,
    })


def start(ereignis):
    agenten_datei, grenze_datei = pfade()
    ti = ereignis.get("tool_input") or {}
    modell = str(ti.get("model") or "")
    beschr = str(ti.get("description") or "")
    art = str(ti.get("subagent_type") or "")
    # Opus ist, wer es sein kann: ausdrücklich opus, ohne model (erbt das Sitzungsmodell),
    # „inherit“, oder ein Fork (läuft auf dem Modell des Elternteils, `model` wird ignoriert).
    ist_opus = (not modell.strip()) or "opus" in modell.lower() or modell.strip().lower() == "inherit" \
        or art.lower() == "fork"
    slots, opus, hinweis = grenze_lesen(grenze_datei)
    with Zaehlung(agenten_datei) as z:
        laufend = z.eintraege
        grenzinfo = f"Grenze: {slots} Agenten gleichzeitig, davon höchstens {opus} Opus (siehe .claude/state/slot-grenze.json; die Grenze ändert nur Daniel)."
        if len(laufend) >= slots:
            return abweisen(
                f"Slot-Grenze erreicht: {len(laufend)} von {slots} Agenten laufen. {grenzinfo} "
                f"Laufend: {beschreibe(laufend)}. Erst warten, bis einer fertig ist."
            )
        if ist_opus:
            if not ZWECK.search(beschr):
                return abweisen(
                    "Opus (auch ohne model oder als Fork) ist nur für Reviews und Ursachensuche zulässig: "
                    f"Die description nennt weder „review“ noch „ursache“. {grenzinfo} "
                    "Gib `model: sonnet` oder `haiku` an, wenn es kein Review oder keine Ursachensuche ist."
                )
            opus_laufend = [e for e in laufend if e.get("opus")]
            if len(opus_laufend) >= opus:
                return abweisen(
                    f"Opus-Grenze erreicht: {len(opus_laufend)} von {opus} Opus-Agenten laufen. {grenzinfo} "
                    f"Laufend: {beschreibe(laufend)}."
                )
        z.eintraege.append({
            "id": ereignis.get("tool_use_id"),
            "ts": jetzt().isoformat(timespec="seconds"),
            "modell": modell,
            "opus": ist_opus,
            "beschreibung": beschr,
            "agent_id": None,
        })
        z.speichern()
        meldungen = [m for m in (hinweis, z.hinweis) if m]
        if meldungen:
            ausgabe(systemMessage="Slot-Hook: " + " | ".join(meldungen))


def beanspruchen(ereignis):
    """SubagentStart: ältesten unbeanspruchten Eintrag der agent_id zuordnen."""
    aid = ereignis.get("agent_id")
    if not aid:
        return
    agenten_datei, _ = pfade()
    with Zaehlung(agenten_datei) as z:
        if any(e.get("agent_id") == aid for e in z.eintraege):
            return
        for e in sorted(z.eintraege, key=lambda e: e.get("ts", "")):
            if not e.get("agent_id"):
                e["agent_id"] = aid
                z.speichern()
                return
        # Kein offener Eintrag: interner Agent oder Fortsetzung – nicht zählen.


def beenden(ereignis):
    """SubagentStop: Eintrag mit passender agent_id, sonst ältester unbeanspruchter."""
    aid = ereignis.get("agent_id")
    agenten_datei, _ = pfade()
    with Zaehlung(agenten_datei) as z:
        ziel = None
        if aid:
            ziel = next((e for e in z.eintraege if e.get("agent_id") == aid), None)
        if ziel is None:
            offene = sorted((e for e in z.eintraege if not e.get("agent_id")), key=lambda e: e.get("ts", ""))
            ziel = offene[0] if offene else None
        if ziel is not None:
            z.eintraege.remove(ziel)
        z.speichern()


def zuruecksetzen(_):
    agenten_datei, _g = pfade()
    with Zaehlung(agenten_datei) as z:
        z.eintraege = []
        z.speichern()


def main():
    befehl = sys.argv[1] if len(sys.argv) > 1 else ""
    roh = sys.stdin.read()
    ereignis = json.loads(roh) if roh.strip() else {}
    if not isinstance(ereignis, dict):
        raise ValueError("Hook-Eingabe ist kein JSON-Objekt")
    {"start": start, "claim": beanspruchen, "stop": beenden, "reset": zuruecksetzen}[befehl](ereignis)


if __name__ == "__main__":
    main()
