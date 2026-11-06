-- scripts/lib/hallenton-storage-stub.sql — NUR fuer Wegwerf-Container der Pruefskripte (scripts/hallenton-check.sh,
-- scripts/rls-matrix.d/spur-hallenton.sh). Das Image supabase/postgres bringt das Schema storage leer mit; die Tabellen
-- legt erst der Storage-Dienst an. Damit Bucket und Policies aus 20261121_001_hallenton.sql gegen echtes RLS laufen,
-- bildet diese Datei den Teil von storage.buckets/storage.objects nach, den die Migration und die Pruefungen brauchen
-- (Spaltennamen wie im Storage-Dienst, RLS an, Rechte fuer anon/authenticated wie dort). Nie in eine echte Datenbank.
-- Einspielen als supabase_admin (im Image gehoert das Schema storage supabase_admin). Eigentuemer der Tabellen wird wie
-- im Storage-Dienst supabase_storage_admin; postgres wird Mitglied dieser Rolle -- Annahme wie auf der gehosteten
-- Plattform, wo postgres Policies auf storage.objects anlegen darf. Vor dem Einspielen live pruefen (Kopf der Migration).
CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text NOT NULL UNIQUE,
  owner              uuid,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  public             boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  owner_id           text
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id        text REFERENCES storage.buckets(id),
  name             text,
  owner            uuid,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata         jsonb,
  path_tokens      text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  version          text,
  owner_id         text,
  user_metadata    jsonb,
  CONSTRAINT bucketid_objname UNIQUE (bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON TABLE storage.objects, storage.buckets TO anon, authenticated, service_role;
ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
ALTER TABLE storage.objects OWNER TO supabase_storage_admin;
GRANT supabase_storage_admin TO postgres;
