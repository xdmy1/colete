-- ============================================================
-- Migration: global_client_id pe clients (unificare cu pasageri)
-- Rulează O SINGURĂ DATĂ în Supabase SQL Editor (proiect colete).
-- Aditiv: adaugă o coloană nullable + o funcție. Nu strică nimic existent.
--
-- ID global = telefonul CANONIC (fără prefix +373 / 0 / 00). Aceeași persoană
-- primește exact același global_client_id și în DB-ul pasageri (Prisma), deci
-- clientul din colete se leagă de clientul din pasageri pe această coloană.
-- Funcția e IDENTICĂ cu canonicalPhone() din scriptul de sync pasageri.
-- ============================================================

CREATE OR REPLACE FUNCTION public.canonical_phone(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN length(s) >= 6 THEN s ELSE '' END
  FROM (
    SELECT regexp_replace(               -- 4. scoate zerourile din față
             regexp_replace(             -- 3. scoate prefixul de țară 373
               regexp_replace(           -- 2. scoate 00 internațional
                 regexp_replace(coalesce(p, ''), '\D', '', 'g'), -- 1. doar cifre
               '^00', ''),
             '^373', ''),
           '^0+', '') AS s
  ) t;
$$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS global_client_id text;

-- Backfill din phone_digits (deja doar cifre)
UPDATE public.clients
  SET global_client_id = NULLIF(public.canonical_phone(phone_digits), '')
  WHERE global_client_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_global_client_id
  ON public.clients(global_client_id);

-- Menține-l sincronizat la insert/update (opțional dar recomandat)
CREATE OR REPLACE FUNCTION public.clients_set_global_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.global_client_id := NULLIF(public.canonical_phone(NEW.phone_digits), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_global_id_trigger ON public.clients;
CREATE TRIGGER clients_global_id_trigger
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_set_global_id();

-- ============================================================
-- GO-BACK (dacă vrei să anulezi):
--   DROP TRIGGER IF EXISTS clients_global_id_trigger ON public.clients;
--   DROP FUNCTION IF EXISTS public.clients_set_global_id();
--   DROP INDEX IF EXISTS public.idx_clients_global_client_id;
--   ALTER TABLE public.clients DROP COLUMN IF EXISTS global_client_id;
--   DROP FUNCTION IF EXISTS public.canonical_phone(text);
-- ============================================================
