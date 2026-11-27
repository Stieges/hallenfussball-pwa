# Drittanbieter-Hinweise

Der vollständige Hinweistext steht in `public/THIRD_PARTY_NOTICES.txt` und wird mit der App ausgeliefert (`/THIRD_PARTY_NOTICES.txt`); die Lizenztexte liegen unter `public/lizenzen/` und werden ebenfalls ausgeliefert (`/lizenzen/…`). Hier steht nur der Überblick:

## Noto Emoji – Ball (`emoji_u26bd.svg`)

- Verwendet in: `src/components/monitor/TorBallGrafik.tsx` (Tor-Einblendung am Monitor).
- Copyright 2013 Google, Inc. All Rights Reserved.
- Quelle: https://github.com/googlefonts/noto-emoji, Datei `2D/svg/emoji_u26bd.svg`. Maßgeblich ist `2D/svg/LICENSE` (Apache-2.0-Kopf mit dem Copyright-Satz oben); die Wurzel-LICENSE des Projekts ist OFL 1.1 und gilt für die Schrift. Das Projekt hat keine NOTICE-Datei.
- Lizenz: Apache License, Version 2.0, Volltext in `public/lizenzen/Apache-2.0.txt`.
- Änderungen: unverändert bis auf das Entfernen der `id` am Wurzelelement, des XML-Kopfs und des Generator-Kommentars sowie das Schreiben von `style="fill:…"` als `fill`-Attribut.

## TanStack Table und Store (Sortier-Baustein)

- Verwendet in: `src/hooks/useTableSort.ts` (Sortierung der Tabellen).
- Pakete (npm, über `package-lock.json` festgelegt): `@tanstack/react-table` 9.3.1, `@tanstack/table-core` 9.3.1, `@tanstack/react-store` 0.11.4, `@tanstack/store` 0.11.3.
- Copyright (c) 2016 Tanner Linsley (`react-table`, `table-core`); Copyright (c) 2021 Tanner Linsley (`react-store`, `store`).
- Quelle: https://github.com/TanStack/table und https://github.com/TanStack/store.
- Lizenz: MIT, Volltext in `public/lizenzen/MIT-TanStack.txt`.
- Änderungen: keine, die Pakete werden unverändert eingebunden.
