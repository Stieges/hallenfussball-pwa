/**
 * Visual Regression: Zuschauersicht `/live/:shareCode` (Task T5, Ruling AE aus der Fixrunde-1-
 * Vorgabe des Controllers nach `task-T5-review.md`, Issue #1).
 *
 * ABSICHTLICH `test.fixme`, keine echte Vorlage: `LiveViewScreen` (src/screens/LiveViewScreen.tsx,
 * gerendert unter `screen === 'live'`, src/App.tsx:713-716) löst den Share-Code über einen echten
 * Supabase-Stack auf (Cloud-Share, kein IndexedDB-Äquivalent wie bei
 * `public-tournament-page.visual.spec.ts`). Der Visual-Job (`.github/workflows/visual.yml`) hat
 * bewusst keinen lokalen Supabase-Stack (Ruling Y, Punkt 2 im Task-Brief: "kein Supabase im
 * Container nötig") -- diesen Screen hier trotzdem zu bauen würde entweder den Cloud-Stack in den
 * Visual-Job holen (von Ruling Y ausdrücklich verboten) oder das Supabase-Repository mocken (im
 * T5-Review als "Fixture-technisch aufwendiger" benannt, hier bewusst nicht in Fixrunde 1
 * umgesetzt).
 *
 * `PublicTournamentViewScreen` (`/public/:tournamentId`) ist NICHT derselbe Screen -- siehe
 * `public-tournament-page.visual.spec.ts` für die Abgrenzung. Diese Lücke ist deshalb offen
 * benannt (auch in `docs/TESTUMGEBUNG.md`, Abschnitt "Visual Regression"), statt sie stillschweigend
 * durch `/public/:tournamentId` zu ersetzen.
 */

import { test } from '../helpers/test-fixtures';

test.fixme(
  'Zuschauersicht (/live/:shareCode): noch nicht per Bildvergleich abgedeckt -- braucht Supabase',
  async () => {
    // Wird nie ausgeführt (test.fixme) -- Platzhalter-Body, damit die Lücke als benannter,
    // sichtbarer Testfall im Report erscheint statt nur als Kommentar irgendwo im Repo.
  }
);
