-- ============================================================
-- COLETE APP — FULL DATABASE SETUP
-- Rulează tot acest fișier în Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text NOT NULL UNIQUE,
  pin_code    text NOT NULL,
  range_start int NOT NULL DEFAULT 0,
  range_end   int NOT NULL DEFAULT 100,
  role        text NOT NULL DEFAULT 'driver'
              CHECK (role IN ('admin', 'driver')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: verifica daca userul curent e admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- RLS policies for profiles
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 2. PARCELS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parcels (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  human_id              text NOT NULL,
  numeric_id            int NOT NULL,
  driver_id             uuid NOT NULL REFERENCES public.profiles(id),
  week_id               text NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'delivered')),
  is_archived           boolean NOT NULL DEFAULT false,
  origin_code           text NOT NULL
                        CHECK (origin_code IN ('UK', 'BE', 'NL', 'MD')),
  delivery_destination  text NOT NULL
                        CHECK (delivery_destination IN ('UK', 'BE', 'NL', 'MD')),
  sender_details        jsonb NOT NULL DEFAULT '{}'::jsonb,
  receiver_details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_description   text,
  appearance            text CHECK (appearance IN ('box', 'bag', 'envelope', 'other')),
  weight                real NOT NULL DEFAULT 0,
  price                 real NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'GBP'
                        CHECK (currency IN ('GBP', 'EUR')),
  photo_url             text,
  route_order           int NOT NULL DEFAULT 0,
  labels                text[] DEFAULT '{}',
  client_satisfied      boolean,
  delivery_note         text,
  delivered_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parcels_driver_week ON public.parcels(driver_id, week_id);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON public.parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_archived ON public.parcels(is_archived);
CREATE INDEX IF NOT EXISTS idx_parcels_delivery ON public.parcels(delivery_destination);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parcels_unique_number
  ON public.parcels(driver_id, week_id, numeric_id)
  WHERE is_archived = false;

ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "parcels_driver_select" ON public.parcels;
  DROP POLICY IF EXISTS "parcels_driver_insert" ON public.parcels;
  DROP POLICY IF EXISTS "parcels_driver_update" ON public.parcels;
  DROP POLICY IF EXISTS "parcels_admin_delete" ON public.parcels;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "parcels_driver_select" ON public.parcels
  FOR SELECT USING (auth.uid() = driver_id OR public.is_admin());

CREATE POLICY "parcels_driver_insert" ON public.parcels
  FOR INSERT WITH CHECK (auth.uid() = driver_id OR public.is_admin());

CREATE POLICY "parcels_driver_update" ON public.parcels
  FOR UPDATE USING (auth.uid() = driver_id OR public.is_admin());

CREATE POLICY "parcels_admin_delete" ON public.parcels
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 3. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_current_week_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT to_char(now(), 'IYYY') || '-W' || to_char(now(), 'IW');
$$;

CREATE OR REPLACE FUNCTION public.get_next_numeric_id(
  p_driver_id uuid,
  p_week_id text
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_range_start int;
  v_max_used int;
BEGIN
  SELECT range_start INTO v_range_start
  FROM public.profiles
  WHERE id = p_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sofer negasit: %', p_driver_id;
  END IF;

  SELECT COALESCE(MAX(numeric_id), v_range_start) INTO v_max_used
  FROM public.parcels
  WHERE driver_id = p_driver_id
    AND week_id = p_week_id;

  RETURN v_max_used + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_human_id(
  p_delivery_destination text,
  p_numeric_id int
)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_delivery_destination
    WHEN 'BE' THEN 'B' || p_numeric_id::text
    WHEN 'NL' THEN 'OL' || p_numeric_id::text
    ELSE p_numeric_id::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parcels_updated_at ON public.parcels;
CREATE TRIGGER parcels_updated_at
  BEFORE UPDATE ON public.parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. SUNDAY ARCHIVE (duminica 23:59 arhiveaza coletele livrate)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sunday_archive_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.parcels
  SET is_archived = true
  WHERE status = 'delivered'
    AND is_archived = false;
END;
$$;

-- ============================================================
-- 5. FIX WEEK IDS (corectează week_id pe baza created_at)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fix_week_ids()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.parcels
  SET week_id = to_char(created_at, 'IYYY') || '-W' || to_char(created_at, 'IW');
END;
$$;

-- ============================================================
-- 6. CRON: arhivare automata duminica la 23:59
-- Necesita extensia pg_cron activata!
-- Dashboard → Database → Extensions → pg_cron → Enable
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
-- SELECT cron.schedule(
--   'sunday-archive-reset',
--   '59 23 * * 0',
--   $$SELECT public.sunday_archive_reset()$$
-- );

-- ============================================================
-- 7. STORAGE: bucket "parcels" pentru poze
-- Creează manual în Dashboard → Storage → New Bucket:
--   Name: parcels
--   Public: false
--   File size limit: 10MB
--   MIME types: image/jpeg, image/png, image/webp
-- ============================================================

-- ============================================================
-- 8. SEED USERS
-- NOTA: Userii trebuie creati prin Supabase Auth API (seed-users.ts)
-- Nu se pot crea direct din SQL fiindca auth.users e managed de Supabase
-- Rulează: npx tsx scripts/seed-users.ts
--
-- Useri default:
--   admin       → PIN: 0000 (admin)
--   ion_centru  → PIN: 1234 (driver, range 0-100)
--   vasile_nord → PIN: 5678 (driver, range 100-200)
--   mihai_sud   → PIN: 9012 (driver, range 200-300)
-- ============================================================
