# Rauchtest nach dem Deploy (Produktion)

Anforderung: `docs/anforderungen/plattform/2026-10-25_rauchtest-nach-deploy.md` (@RT-001 bis @RT-008, lokal).

Zwei Läufe:

| Lauf | Wann | Was | Schreibt? |
|---|---|---|---|
| **Kurz** (`PROD_SMOKE_MODE=kurz`) | nach jedem erfolgreichen Produktions-Deploy | Version prüfen, anmelden, das dauerhafte Turnier `ZZ-Rauchtest-Dauer` im Cockpit öffnen (ohne Anpfiff), Zuschauer-Link ohne Anmeldung | nein |
| **Voll** (`PROD_SMOKE_MODE=voll`) | einmal täglich (04:35 UTC) und von Hand | Wegwerf-Turnier `ZZ-Rauchtest-<Zeit>` anlegen, festlegen, anpfeifen, Tor, abpfeifen, Zuschauer-Link zeigt genau `1:0` | ja, eine Turnier-Zeile je Lauf |

**Befristet:** E2E gegen die Produktion ist bis einschließlich 15.11.2026 erlaubt. Ab dem 16.11. wird jeder Lauf rot mit „Rauchtest gegen Produktion abgelaufen (Freigabe bis 15.11.)“. Dann `.github/workflows/prod-smoke.yml` abschalten.

## Einmal vorab: das Dauer-Turnier

Im Testkonto ein Turnier **`ZZ-Rauchtest-Dauer`** anlegen und festlegen (Assistent, vier Teams reichen). Nicht anpfeifen und nicht löschen. Fehlt es, scheitert der Kurzlauf mit einem Satz, der genau das sagt.

## Lokal starten

```bash
bash scripts/prod-smoke.sh kurz                       # nur lesen
bash scripts/prod-smoke.sh voll                       # Wegwerf-Turnier (hinterlässt eine Zeile)
bash scripts/prod-smoke.sh kurz <E-Mail des Kontos>   # anderes Testkonto (Vorgabe coadmin-test2@example.org)
```

Das Passwort liest das Skript aus dem macOS-Schlüsselbund („Hallenfussball Testkonto Produktion“, Konto = E-Mail). Es wird nie ausgegeben oder gespeichert. Mit `PROD_SMOKE_EXPECTED_SHA=<8 Zeichen>` wird die ausgelieferte Version verglichen. `PROD_SMOKE_BASE_URL` akzeptiert nur `https://hallenfussball-pwa*.vercel.app`, alles andere bricht ab, bevor sich jemand anmeldet.

## Im CI

`.github/workflows/prod-smoke.yml`: Deploy (`deployment_status`, nur Production, success) startet den Kurzlauf, der Zeitplan und „Run workflow“ den Volllauf (bei Hand-Start wählbar).

Benötigte Repository-Secrets (Einstellungen, Secrets and variables, Actions):

| Secret | Inhalt |
|---|---|
| `PROD_SMOKE_EMAIL` | E-Mail des Testkontos |
| `PROD_SMOKE_PASSWORD` | Passwort dieses Testkontos |

Fehlen sie, überspringt der Workflow den Test mit einer Meldung (Job bleibt grün).

**Keine Zugangsdaten in Ablagen:** Das Repository ist öffentlich, Ablagen sind dort herunterladbar. Deshalb gibt es weder Spur (Trace) noch Video; nach einem Fehlschlag werden nur Bilder und `error-context.md` hochgeladen, vorher werden Dateien mit dem Passwort entfernt.

## Aufräumen

Ein angepfiffenes Turnier kann die App nicht mehr löschen (@LZ-003, Schutz in der Datenbank). Jeder Volllauf hinterlässt deshalb ein Wegwerf-Turnier; der Test nennt es am Ende (`RESTBESTAND: …`, im CI in der Zusammenfassung). Wöchentlich und am 15.11. abschließend: `scripts/prod-smoke-cleanup.sql` im SQL-Editor (Platzhalter `<testkonto-mail>` einsetzen, erst Vorschau, dann Löschen). Es trifft nur Turniere dieses Kontos und lässt `ZZ-Rauchtest-Dauer` stehen.

## Bekannte Grenzen

- **Zwei Deploys kurz nacheinander (K3):** Wartet ein Lauf auf eine Version, die schon vom nächsten Deploy überholt wurde, wird er nach 2 Minuten rot, obwohl nichts kaputt ist. Der Lauf des neueren Deploys ist dann maßgeblich.
- **Zeitüberschreitung (K4):** Bricht der Test nach 240 Sekunden ab, läuft das Aufräumen im Test nicht verlässlich. Die Kennung steht trotzdem in der Ausgabe und das Aufräum-SQL findet das Turnier über Konto und Titel.
