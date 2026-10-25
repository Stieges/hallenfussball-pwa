-- Räumt Wegwerf-Turniere des Produktions-Rauchtests ("ZZ-Rauchtest-...") samt Spielen, Mannschaften und Ereignissen auf.
-- Nach dem ersten Anpfiff kann die App ein Turnier nicht mehr löschen (@LZ-003), deshalb bleibt es sonst als Zeile stehen.
-- Läuft als Datenbank-Eigentümer (SQL-Editor im Dashboard bzw. MCP execute_sql), NICHT mit dem Testkonto.
--
-- PLATZHALTER (nur im Editor ersetzen, nie hier im Repo): <testkonto-mail> = E-Mail des Rauchtest-Kontos.
-- Gelöscht wird NUR, was diesem Konto gehört UND mit "ZZ-Rauchtest-" beginnt. Das dauerhafte Turnier "ZZ-Rauchtest-Dauer"
-- bleibt stehen. Erst die Vorschau (1) ansehen, dann (2) ausführen.

-- (1) Vorschau
select t.id, t.title, t.owner_id, t.created_at
from public.tournaments t
where t.title like 'ZZ-Rauchtest-%'
  and t.title <> 'ZZ-Rauchtest-Dauer'
  and t.owner_id = (select id from auth.users where lower(email) = lower('<testkonto-mail>'))
order by t.created_at;

-- (2) Löschen (Kaskade über Fremdschlüssel; die Schutzauslöser greifen nur für die Rollen authenticated/anon)
-- delete from public.tournaments t
-- where t.title like 'ZZ-Rauchtest-%'
--   and t.title <> 'ZZ-Rauchtest-Dauer'
--   and t.owner_id = (select id from auth.users where lower(email) = lower('<testkonto-mail>'));
