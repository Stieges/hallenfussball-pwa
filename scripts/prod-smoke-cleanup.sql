-- Räumt Wegwerf-Turniere des Produktions-Rauchtests ("ZZ-Rauchtest-...") samt Spielen, Mannschaften und Ereignissen auf.
-- Nach dem ersten Anpfiff kann die App ein Turnier nicht mehr löschen (@LZ-003), deshalb bleibt es sonst als Zeile stehen.
-- Läuft als Datenbank-Eigentümer (SQL-Editor im Dashboard bzw. MCP execute_sql), NICHT mit dem Testkonto.
--
-- Konto: coadmin-test2@example.org (Eigentümer-Kennung 9d5ea221-a030-4ef5-93a4-ecb6d9e295fc, per lesendem SELECT geprüft).
-- Gelöscht wird NUR, was diesem Konto gehört UND mit "ZZ-Rauchtest-" beginnt. Das dauerhafte Turnier "ZZ-Rauchtest-Dauer"
-- bleibt stehen. Erst die Vorschau (1) ansehen, dann (2) ausführen.

-- (1) Vorschau
select t.id, t.title, t.owner_id, t.created_at
from public.tournaments t
where t.title like 'ZZ-Rauchtest-%'
  and t.title <> 'ZZ-Rauchtest-Dauer'
  and t.owner_id = '9d5ea221-a030-4ef5-93a4-ecb6d9e295fc'::uuid
order by t.created_at;

-- (2) Löschen (Kaskade über Fremdschlüssel; die Schutzauslöser greifen nur für die Rollen authenticated/anon)
-- delete from public.tournaments t
-- where t.title like 'ZZ-Rauchtest-%'
--   and t.title <> 'ZZ-Rauchtest-Dauer'
--   and t.owner_id = '9d5ea221-a030-4ef5-93a4-ecb6d9e295fc'::uuid;
