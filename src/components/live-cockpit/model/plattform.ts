/**
 * istApple – gehört die Plattform zu Apple (Mac, iPhone, iPad)? Bestimmt den Tasten-Hinweis „Cmd+Z“ statt „Strg+Z“ (Plan 3.6).
 * Rein: Der Aufrufer reicht `navigator.userAgentData?.platform ?? navigator.platform` hinein.
 */
export function istApple(plattform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(plattform);
}
