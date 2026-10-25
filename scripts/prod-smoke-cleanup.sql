-- Räumt Wegwerf-Turniere des Produktions-Rauchtests ("ZZ-Rauchtest-...") samt Spielen, Mannschaften und Ereignissen auf.
-- Nach dem ersten Anpfiff kann die App ein Turnier nicht mehr löschen (@LZ-003), deshalb bleibt es sonst als Zeile stehen.
-- Läuft als Datenbank-Eigentümer (SQL-Editor im Dashboard bzw. MCP execute_sql), NICHT mit dem Testkonto.
-- Erst die Vorschau (1) ansehen, dann (2) ausführen.

-- (1) Vorschau
select id, title, owner_id, created_at
from public.tournaments
where title like 'ZZ-Rauchtest-%'
order by created_at;

-- (2) Löschen (Kaskade über Fremdschlüssel; die Schutzauslöser greifen nur für die Rollen authenticated/anon)
-- delete from public.tournaments where title like 'ZZ-Rauchtest-%';
