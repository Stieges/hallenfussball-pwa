# Rauchtest nach dem Deploy (Produktion)

Prüft nach jedem Produktions-Deploy in rund 15 Sekunden: Die Seite wird in der erwarteten Version ausgeliefert, Anmelden mit dem Testkonto geht, ein Turnier lässt sich anlegen und festlegen, im Cockpit gehen Anpfiff, Tor und Abpfiff, und der Zuschauer-Link (ohne Anmeldung) zeigt Turnier und Stand.

**Befristet:** E2E gegen die Produktion ist bis einschließlich 15.11.2026 erlaubt. Danach `.github/workflows/prod-smoke.yml` abschalten.

## Was der Test anfasst

Nur das Testkonto und ein eigenes Turnier `ZZ-Rauchtest-<Zeit>`. Er liest und ändert kein anderes Turnier.

## Lokal starten

```bash
npm run test:prod-smoke                 # Konto coadmin-test2@example.org
bash scripts/prod-smoke.sh <E-Mail>     # anderes Testkonto
```

Das Passwort liest das Skript aus dem macOS-Schlüsselbund („Hallenfussball Testkonto Produktion“, Konto = E-Mail). Es wird nie ausgegeben oder gespeichert. Mit `PROD_SMOKE_EXPECTED_SHA=<8 Zeichen>` wird zusätzlich die ausgelieferte Version verglichen, mit `PROD_SMOKE_BASE_URL` eine andere Adresse geprüft.

## Im CI

`.github/workflows/prod-smoke.yml` startet nach einem erfolgreichen Vercel-Deploy der Produktion (`deployment_status`) oder von Hand (Actions, „Prod Smoke“, „Run workflow“).

Benötigte Repository-Secrets (Einstellungen, Secrets and variables, Actions):

| Secret | Inhalt |
|---|---|
| `PROD_SMOKE_EMAIL` | E-Mail des Testkontos |
| `PROD_SMOKE_PASSWORD` | Passwort dieses Testkontos |

Fehlen sie, überspringt der Workflow den Test mit einer Meldung (Job bleibt grün).

## Aufräumen

Ein angepfiffenes Turnier kann die App nicht mehr löschen (@LZ-003, Schutz in der Datenbank). Jeder Lauf hinterlässt deshalb ein Wegwerf-Turnier. Der Test nennt es am Ende (`RESTBESTAND: …`, im CI in der Zusammenfassung). Entfernen: `scripts/prod-smoke-cleanup.sql` (erst Vorschau, dann Löschen) im SQL-Editor des Dashboards.
