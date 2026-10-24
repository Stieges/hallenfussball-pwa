/**
 * Eine Regel dafuer, ob ein Turnier ueber das Konto in die Cloud geht oder nur auf dem Geraet bleibt.
 * RepositoryContext (Repository-Wahl) und die Festlegen-Vorschau (@W1-037) nutzen sie gemeinsam,
 * damit der angekuendigte Satz und das tatsaechliche Speichern nicht auseinanderlaufen.
 *
 * Cloud: Supabase eingerichtet UND Nutzer vorhanden UND kein lokaler Gast (globalRole 'guest').
 * Anonyme Supabase-Nutzer zaehlen mit (sie synchronisieren in die Cloud).
 */
export function usesCloudRepository(
  user: { globalRole?: string } | null | undefined,
  isSupabaseConfigured: boolean
): boolean {
  return Boolean(user) && isSupabaseConfigured && user?.globalRole !== 'guest';
}
