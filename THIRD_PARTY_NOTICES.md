# Drittanbieter-Hinweise

Der vollständige Hinweistext steht in `public/THIRD_PARTY_NOTICES.txt` und wird mit der App ausgeliefert (`/THIRD_PARTY_NOTICES.txt`); die Lizenztexte liegen unter `public/lizenzen/` und werden ebenfalls ausgeliefert (`/lizenzen/…`). Hier steht nur der Überblick:

## Noto Emoji – Ball (`emoji_u26bd.svg`)

- Verwendet in: `src/components/monitor/TorBallGrafik.tsx` (Tor-Einblendung am Monitor).
- Copyright 2013 Google, Inc. All Rights Reserved.
- Quelle: https://github.com/googlefonts/noto-emoji, Datei `2D/svg/emoji_u26bd.svg`. Maßgeblich ist `2D/svg/LICENSE` (Apache-2.0-Kopf mit dem Copyright-Satz oben); die Wurzel-LICENSE des Projekts ist OFL 1.1 und gilt für die Schrift. Das Projekt hat keine NOTICE-Datei.
- Lizenz: Apache License, Version 2.0, Volltext in `public/lizenzen/Apache-2.0.txt`.
- Änderungen: unverändert bis auf das Entfernen der `id` am Wurzelelement, des XML-Kopfs und des Generator-Kommentars sowie das Schreiben von `style="fill:…"` als `fill`-Attribut.
