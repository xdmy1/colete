-- ============================================================
-- LOGISTICS PLATFORM — Supabase SQL Schema
-- Routes: MD ↔ UK / BE / NL
-- ============================================================
-- LOGICA DESTINATII:
-- Soferul selecteaza ORIGINEA coletului:
--   UK/BE/NL = coletul vine din strainatate → se livreaza in MD
--   MD = coletul e din Moldova → apare sub-selector: UK, BE, NL
--
-- NUMEROTARE:
-- Fiecare sofer are un range (ex: 0-100, 100-200)
-- Numerele cresc SECVENTIAL indiferent de destinatie
-- Ion (0-100): colet #1 (UK), B-2 (BE), OL-3 (NL), #4 (UK)...
-- Prefixul depinde de delivery_destination:
--   UK = N (doar numarul), BE = BN, NL = OLN
-- ============================================================

-- 1. PROFILES TABLE
CREATE TABLE public.profiles (
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

-- Helper: verifica daca userul curent e admin (SECURITY DEFINER evita recursie RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 2. PARCELS TABLE
-- ============================================================
CREATE TABLE public.parcels (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificare
  human_id              text NOT NULL,       -- "#7", "B-15", "OL-4"
  numeric_id            int NOT NULL,        -- nr secvential in range-ul soferului

  -- Atribuire
  driver_id             uuid NOT NULL REFERENCES public.profiles(id),
  week_id               text NOT NULL,       -- "2026-W07"

  -- Status
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'delivered')),
  is_archived           boolean NOT NULL DEFAULT false,

  -- Ruta: de unde vine si unde se livreaza
  origin_code           text NOT NULL
                        CHECK (origin_code IN ('UK', 'BE', 'NL', 'MD')),
  delivery_destination  text NOT NULL
                        CHECK (delivery_destination IN ('UK', 'BE', 'NL', 'MD')),
  -- Exemplu: origin=MD, delivery=UK = colet din Moldova livrat in Anglia
  -- Exemplu: origin=UK, delivery=MD = colet din Anglia livrat in Moldova

  -- Detalii expeditor/destinatar
  sender_details        jsonb NOT NULL DEFAULT '{}'::jsonb,
  receiver_details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_description   text,
  appearance            text CHECK (appearance IN ('box', 'bag', 'envelope', 'other')),

  -- Pret: greutate * 1.5, moneda depinde de delivery_destination
  weight                real NOT NULL DEFAULT 0,
  price                 real NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'GBP'
                        CHECK (currency IN ('GBP', 'EUR')),

  -- Dovada foto (obligatorie la adaugare)
  photo_url             text,

  -- Ordine traseu (admin drag & drop)
  route_order           int NOT NULL DEFAULT 0,

  -- Label-uri: "L" = Livrare (transferat de admin la sofer)
  labels                text[] DEFAULT '{}',

  -- Feedback la livrare
  client_satisfied      boolean,
  delivery_note         text,
  delivered_at          timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexuri
CREATE INDEX idx_parcels_driver_week ON public.parcels(driver_id, week_id);
CREATE INDEX idx_parcels_status ON public.parcels(status);
CREATE INDEX idx_parcels_archived ON public.parcels(is_archived);
CREATE INDEX idx_parcels_delivery ON public.parcels(delivery_destination);

-- Unicitate: un singur numeric_id per sofer per saptamana (INDIFERENT de destinatie!)
CREATE UNIQUE INDEX idx_parcels_unique_number
  ON public.parcels(driver_id, week_id, numeric_id)
  WHERE is_archived = false;

ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

-- Soferii vad doar coletele lor, adminul vede tot
-- Folosim public.is_admin() pentru a evita recursie RLS
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

-- Saptamana curenta in format ISO: "2026-W07"
CREATE OR REPLACE FUNCTION public.get_current_week_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT to_char(now(), 'IYYY-"W"IW');
$$;

-- Urmatorul numeric_id disponibil pentru un sofer intr-o saptamana
-- IMPORTANT: numarul creste SECVENTIAL pe tot range-ul, NU per destinatie!
-- Ion (0-100): #1, B-2, OL-3, #4... toate folosesc acelasi contor
CREATE OR REPLACE FUNCTION public.get_next_numeric_id(
  p_driver_id uuid,
  p_week_id text
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_range_start int;
  v_range_end int;
  v_max_used int;
BEGIN
  SELECT range_start, range_end INTO v_range_start, v_range_end
  FROM public.profiles
  WHERE id = p_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sofer negasit: %', p_driver_id;
  END IF;

  -- Gaseste cel mai mare numeric_id folosit de sofer in saptamana asta
  -- Cauta in TOATE coletele (inclusiv arhivate) ca sa nu reseteze contorul
  -- Filtreaza doar coletele din range-ul soferului (ignora transferurile din alte range-uri)
  SELECT COALESCE(MAX(numeric_id), v_range_start) INTO v_max_used
  FROM public.parcels
  WHERE driver_id = p_driver_id
    AND week_id = p_week_id
    AND numeric_id >= v_range_start
    AND numeric_id < v_range_end;

  RETURN v_max_used + 1;
END;
$$;

-- Construieste human_id din destinatie + numar
-- UK → N (doar numarul), BE → BN, NL → OLN, MD → N
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

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER parcels_updated_at
  BEFORE UPDATE ON public.parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. SUNDAY RESET — Arhiveaza doar coletele livrate (verde)
-- Cele pending (galben) raman pentru saptamana urmatoare
-- Se apeleaza via Supabase Edge Function + Cron (duminica 23:59)
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
  -- Coletele PENDING NU se ating — raman in dashboard
END;
$$;

-- ============================================================
-- 5. STORAGE BUCKET
-- Creaza manual in Supabase Dashboard bucket-ul "parcels":
--   Public: false
--   File size limit: 10MB
--   MIME types: image/jpeg, image/png, image/webp
-- Apoi aplica aceste politici:
-- ============================================================

-- INSERT: userii autentificati pot uploada in folderul lor
-- CREATE POLICY "parcel_photos_insert" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     bucket_id = 'parcels'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- SELECT: userii vad pozele lor, adminul vede tot
-- CREATE POLICY "parcel_photos_select" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (
--     bucket_id = 'parcels'
--     AND (
--       (storage.foldername(name))[1] = auth.uid()::text
--       OR EXISTS (
--         SELECT 1 FROM public.profiles
--         WHERE id = auth.uid() AND role = 'admin'
--       )
--     )
--   );
