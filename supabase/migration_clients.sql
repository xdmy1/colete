-- ============================================================
-- Migration: Baza de clienti
-- Rulează O SINGURĂ DATA în Supabase SQL Editor.
-- Sigura sa fie rulata cand DB are deja parcels: nu modifica nimic
-- in tabelele existente decat sa adauge o coloana nullable la parcels.
-- ============================================================

-- Helper: scoate tot ce nu e cifra
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(regexp_replace(p, '\D', '', 'g'), '');
$$;

-- ============================================================
-- 1. CLIENTS — un rand per persoana care trimite colete
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.clients_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_number   int NOT NULL UNIQUE DEFAULT nextval('public.clients_number_seq'),
  name            text NOT NULL DEFAULT '',
  phone           text NOT NULL,                       -- format afisat (cu +373 etc.)
  phone_digits    text NOT NULL,                       -- doar cifre, unique
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_digits)
);

CREATE INDEX IF NOT EXISTS idx_clients_phone_digits ON public.clients(phone_digits);
CREATE INDEX IF NOT EXISTS idx_clients_client_number ON public.clients(client_number);
CREATE INDEX IF NOT EXISTS idx_clients_name_lower ON public.clients(lower(name));

-- Trigger: tine phone_digits sincronizat
CREATE OR REPLACE FUNCTION public.clients_set_phone_digits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone_digits := public.normalize_phone(NEW.phone);
  IF NEW.phone_digits = '' THEN
    RAISE EXCEPTION 'Telefonul clientului nu poate fi gol';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_phone_digits_trigger ON public.clients;
CREATE TRIGGER clients_phone_digits_trigger
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_set_phone_digits();

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "clients_select" ON public.clients;
  DROP POLICY IF EXISTS "clients_admin_all" ON public.clients;
  DROP POLICY IF EXISTS "clients_driver_insert" ON public.clients;
  DROP POLICY IF EXISTS "clients_driver_update" ON public.clients;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Toti utilizatorii autentificati pot citi (drivers au nevoie la autocomplete)
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Drivers pot insera (apare client nou cand adauga colet)
CREATE POLICY "clients_driver_insert" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Drivers pot face update (cand schimba nume/telefon ramane consistent)
CREATE POLICY "clients_driver_update" ON public.clients
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Numai admin sterge
CREATE POLICY "clients_admin_all" ON public.clients
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 2. CLIENT_ADDRESSES — destinatari salvati per client (card pe destinatar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_addresses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recipient_name        text NOT NULL DEFAULT '',
  recipient_phone       text NOT NULL DEFAULT '',
  recipient_phone_digits text NOT NULL DEFAULT '',
  recipient_address     text NOT NULL DEFAULT '',
  destination_country   text NOT NULL
                        CHECK (destination_country IN ('UK', 'BE', 'NL', 'MD', 'DE')),
  label                 text,                            -- alias optional ("acasa", "frate")
  usage_count           int NOT NULL DEFAULT 1,
  last_used_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Unicitate: un client nu are doua adrese identice (acelasi telefon receiver + tara)
-- Daca telefon receiver e gol, deduplam pe (nume + adresa)
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_addresses_unique_phone
  ON public.client_addresses(client_id, destination_country, recipient_phone_digits)
  WHERE recipient_phone_digits <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_addresses_unique_nameaddr
  ON public.client_addresses(client_id, destination_country, lower(recipient_name), lower(recipient_address))
  WHERE recipient_phone_digits = '';

CREATE INDEX IF NOT EXISTS idx_client_addresses_client ON public.client_addresses(client_id);

CREATE OR REPLACE FUNCTION public.client_addresses_set_phone_digits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.recipient_phone_digits := public.normalize_phone(NEW.recipient_phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_addresses_phone_digits_trigger ON public.client_addresses;
CREATE TRIGGER client_addresses_phone_digits_trigger
  BEFORE INSERT OR UPDATE ON public.client_addresses
  FOR EACH ROW EXECUTE FUNCTION public.client_addresses_set_phone_digits();

ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "client_addresses_select" ON public.client_addresses;
  DROP POLICY IF EXISTS "client_addresses_insert" ON public.client_addresses;
  DROP POLICY IF EXISTS "client_addresses_update" ON public.client_addresses;
  DROP POLICY IF EXISTS "client_addresses_delete" ON public.client_addresses;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "client_addresses_select" ON public.client_addresses
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "client_addresses_insert" ON public.client_addresses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_addresses_update" ON public.client_addresses
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "client_addresses_delete" ON public.client_addresses
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 3. PARCELS: leaga colet de client si adresa (nullable, nu strica nimic)
-- ============================================================
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_address_id uuid REFERENCES public.client_addresses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parcels_client_id ON public.parcels(client_id);

-- ============================================================
-- 4. RPC: upsert client + adresa intr-o singura tranzactie
--    Folosit cand se salveaza un colet nou — drivers/admin il cheama
--    si primesc ID-urile inapoi pentru a le stampila pe parcel.
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_client_with_address(
  p_sender_name      text,
  p_sender_phone     text,
  p_recipient_name   text,
  p_recipient_phone  text,
  p_recipient_address text,
  p_destination_country text
)
RETURNS TABLE (client_id uuid, client_address_id uuid, client_number int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_digits text := public.normalize_phone(p_sender_phone);
  v_recv_digits   text := public.normalize_phone(p_recipient_phone);
  v_client_id     uuid;
  v_client_number int;
  v_address_id    uuid;
BEGIN
  IF v_sender_digits = '' THEN
    RAISE EXCEPTION 'Telefonul expeditorului lipseste';
  END IF;

  -- 1. UPSERT client pe phone_digits
  INSERT INTO public.clients (name, phone, phone_digits)
  VALUES (COALESCE(NULLIF(trim(p_sender_name), ''), ''), p_sender_phone, v_sender_digits)
  ON CONFLICT (phone_digits) DO UPDATE
    SET name = CASE
                  WHEN public.clients.name = '' OR public.clients.name IS NULL
                  THEN EXCLUDED.name
                  ELSE public.clients.name
                END,
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.clients.phone),
        updated_at = now()
  RETURNING id, client_number INTO v_client_id, v_client_number;

  -- 2. UPSERT adresa receiver pentru client (doar daca avem date utile)
  IF length(coalesce(p_recipient_name,'')) > 0
     OR length(coalesce(p_recipient_address,'')) > 0
     OR v_recv_digits <> '' THEN

    IF v_recv_digits <> '' THEN
      INSERT INTO public.client_addresses (
        client_id, recipient_name, recipient_phone, recipient_phone_digits,
        recipient_address, destination_country, usage_count, last_used_at
      ) VALUES (
        v_client_id,
        COALESCE(p_recipient_name, ''),
        COALESCE(p_recipient_phone, ''),
        v_recv_digits,
        COALESCE(p_recipient_address, ''),
        p_destination_country,
        1, now()
      )
      ON CONFLICT (client_id, destination_country, recipient_phone_digits)
        WHERE recipient_phone_digits <> ''
      DO UPDATE
        SET recipient_name = CASE
                                WHEN public.client_addresses.recipient_name = '' OR public.client_addresses.recipient_name IS NULL
                                THEN EXCLUDED.recipient_name
                                ELSE public.client_addresses.recipient_name
                              END,
            recipient_address = CASE
                                  WHEN public.client_addresses.recipient_address = '' OR public.client_addresses.recipient_address IS NULL
                                  THEN EXCLUDED.recipient_address
                                  ELSE public.client_addresses.recipient_address
                                END,
            usage_count = public.client_addresses.usage_count + 1,
            last_used_at = now()
      RETURNING id INTO v_address_id;
    ELSE
      INSERT INTO public.client_addresses (
        client_id, recipient_name, recipient_phone, recipient_phone_digits,
        recipient_address, destination_country, usage_count, last_used_at
      ) VALUES (
        v_client_id,
        COALESCE(p_recipient_name, ''),
        '', '',
        COALESCE(p_recipient_address, ''),
        p_destination_country,
        1, now()
      )
      ON CONFLICT (client_id, destination_country, lower(recipient_name), lower(recipient_address))
        WHERE recipient_phone_digits = ''
      DO UPDATE
        SET usage_count = public.client_addresses.usage_count + 1,
            last_used_at = now()
      RETURNING id INTO v_address_id;
    END IF;
  END IF;

  RETURN QUERY SELECT v_client_id, v_address_id, v_client_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_client_with_address(text, text, text, text, text, text) TO authenticated;

-- ============================================================
-- 5. BACKFILL — populeaza clients + client_addresses din parcels existente
--    Sigura sa fie rulata de mai multe ori (idempotenta).
-- ============================================================
DO $$
DECLARE
  r RECORD;
  v_client_id uuid;
  v_dest text;
BEGIN
  -- Pas 1: pentru fiecare telefon unic de sender (parcels nearhivate sau arhivate)
  --        cu cifre valide, creeaza/actualizeaza client.
  FOR r IN
    SELECT
      public.normalize_phone(sender_details->>'phone') AS phone_digits,
      MAX(sender_details->>'phone')                    AS phone_display,
      (ARRAY_AGG(NULLIF(trim(sender_details->>'name'), '') ORDER BY created_at DESC)
        FILTER (WHERE NULLIF(trim(sender_details->>'name'), '') IS NOT NULL))[1] AS name
    FROM public.parcels
    WHERE record_type = 'parcel'
      AND sender_details->>'phone' IS NOT NULL
      AND public.normalize_phone(sender_details->>'phone') <> ''
    GROUP BY public.normalize_phone(sender_details->>'phone')
  LOOP
    INSERT INTO public.clients (name, phone, phone_digits)
    VALUES (COALESCE(r.name, ''), COALESCE(r.phone_display, ''), r.phone_digits)
    ON CONFLICT (phone_digits) DO UPDATE
      SET name = CASE
                    WHEN public.clients.name = '' OR public.clients.name IS NULL
                    THEN EXCLUDED.name
                    ELSE public.clients.name
                  END
    RETURNING id INTO v_client_id;

    -- Pas 2: stampileaza client_id pe parcels existente
    UPDATE public.parcels
      SET client_id = v_client_id
      WHERE client_id IS NULL
        AND record_type = 'parcel'
        AND public.normalize_phone(sender_details->>'phone') = r.phone_digits;
  END LOOP;

  -- Pas 3: pentru fiecare (sender phone, receiver phone, destinatie) unic,
  --        creeaza o adresa salvata. Numara usage si seteaza last_used_at.
  FOR r IN
    SELECT
      p.client_id,
      p.delivery_destination AS destination,
      MAX(p.receiver_details->>'name')    AS rname,
      MAX(p.receiver_details->>'phone')   AS rphone,
      public.normalize_phone(p.receiver_details->>'phone') AS rphone_digits,
      MAX(p.receiver_details->>'address') AS raddress,
      COUNT(*) AS usage_count,
      MAX(p.created_at) AS last_used
    FROM public.parcels p
    WHERE p.record_type = 'parcel'
      AND p.client_id IS NOT NULL
      AND p.client_address_id IS NULL
      AND p.delivery_destination IN ('UK','BE','NL','MD','DE')
      AND (
        public.normalize_phone(p.receiver_details->>'phone') <> ''
        OR NULLIF(trim(p.receiver_details->>'name'), '') IS NOT NULL
        OR NULLIF(trim(p.receiver_details->>'address'), '') IS NOT NULL
      )
    GROUP BY p.client_id, p.delivery_destination,
             public.normalize_phone(p.receiver_details->>'phone')
  LOOP
    v_dest := r.destination;

    IF r.rphone_digits <> '' THEN
      INSERT INTO public.client_addresses (
        client_id, recipient_name, recipient_phone, recipient_phone_digits,
        recipient_address, destination_country, usage_count, last_used_at
      ) VALUES (
        r.client_id, COALESCE(r.rname,''), COALESCE(r.rphone,''), r.rphone_digits,
        COALESCE(r.raddress,''), v_dest, r.usage_count, r.last_used
      )
      ON CONFLICT (client_id, destination_country, recipient_phone_digits)
        WHERE recipient_phone_digits <> ''
      DO UPDATE
        SET usage_count = GREATEST(public.client_addresses.usage_count, EXCLUDED.usage_count),
            last_used_at = GREATEST(public.client_addresses.last_used_at, EXCLUDED.last_used_at);
    ELSE
      INSERT INTO public.client_addresses (
        client_id, recipient_name, recipient_phone, recipient_phone_digits,
        recipient_address, destination_country, usage_count, last_used_at
      ) VALUES (
        r.client_id, COALESCE(r.rname,''), '', '',
        COALESCE(r.raddress,''), v_dest, r.usage_count, r.last_used
      )
      ON CONFLICT (client_id, destination_country, lower(recipient_name), lower(recipient_address))
        WHERE recipient_phone_digits = ''
      DO UPDATE
        SET usage_count = GREATEST(public.client_addresses.usage_count, EXCLUDED.usage_count),
            last_used_at = GREATEST(public.client_addresses.last_used_at, EXCLUDED.last_used_at);
    END IF;
  END LOOP;

  -- Pas 4: leaga parcels istorice la client_addresses pe baza telefonului receiver
  UPDATE public.parcels p
  SET client_address_id = a.id
  FROM public.client_addresses a
  WHERE p.client_address_id IS NULL
    AND p.record_type = 'parcel'
    AND p.client_id = a.client_id
    AND p.delivery_destination = a.destination_country
    AND public.normalize_phone(p.receiver_details->>'phone') = a.recipient_phone_digits
    AND a.recipient_phone_digits <> '';

  -- Pas 5: pentru parcels fara telefon receiver, leaga pe nume+adresa
  UPDATE public.parcels p
  SET client_address_id = a.id
  FROM public.client_addresses a
  WHERE p.client_address_id IS NULL
    AND p.record_type = 'parcel'
    AND p.client_id = a.client_id
    AND p.delivery_destination = a.destination_country
    AND a.recipient_phone_digits = ''
    AND public.normalize_phone(p.receiver_details->>'phone') = ''
    AND lower(COALESCE(p.receiver_details->>'name','')) = lower(a.recipient_name)
    AND lower(COALESCE(p.receiver_details->>'address','')) = lower(a.recipient_address);
END $$;

-- Aliniaza secventa la maximul curent (in caz ca a fost rulat partial)
DO $$
DECLARE
  v_max int;
BEGIN
  SELECT COALESCE(MAX(client_number), 0) INTO v_max FROM public.clients;
  IF v_max > 0 THEN
    PERFORM setval('public.clients_number_seq', v_max, true);
  END IF;
END $$;
