-- ============================================================
-- Migration: Shared pickup counter pentru soferi cu mai multe origini
-- Caz concret: repartizare_olanda ridica si din NL si din BE.
-- Numerotare ramane continua (B-1, OL-2, OL-3, B-4...), doar
-- prefixul difera in functie de origine.
-- ============================================================

-- 1. Flag pe profile: cand e true, counterul ignora origin/destination
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shared_pickup_counter boolean NOT NULL DEFAULT false;

-- 2. Activeaza pentru repartizare_olanda
UPDATE public.profiles
SET shared_pickup_counter = true
WHERE username ILIKE '%repartizare%olanda%';

-- 3. Adauga ruta BE -> MD cu acelasi range ca NL -> MD pentru repartizare_olanda
--    (idempotent: ON CONFLICT pe (driver_id, origin, destination))
INSERT INTO public.driver_route_ranges (driver_id, origin, destination, range_start, range_end)
SELECT p.id, 'BE', 'MD', r.range_start, r.range_end
FROM public.profiles p
JOIN public.driver_route_ranges r
  ON r.driver_id = p.id AND r.origin = 'NL' AND r.destination = 'MD'
WHERE p.username ILIKE '%repartizare%olanda%'
ON CONFLICT (driver_id, origin, destination) DO UPDATE
  SET range_start = EXCLUDED.range_start,
      range_end   = EXCLUDED.range_end;

-- 4. RPC actualizat: cand shared_pickup_counter e true, MAX se calculeaza
--    peste TOATE coletele soferului in range (ignora origin/destination)
CREATE OR REPLACE FUNCTION public.get_next_numeric_id(
  p_driver_id            uuid,
  p_week_id              text,
  p_origin_code          text,
  p_delivery_destination text
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_range_start int;
  v_range_end   int;
  v_max_used    int;
  v_shared      boolean := false;
BEGIN
  SELECT range_start, range_end INTO v_range_start, v_range_end
  FROM public.driver_route_ranges
  WHERE driver_id   = p_driver_id
    AND origin      = p_origin_code
    AND destination = p_delivery_destination;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Range negasit pentru soferul % pe ruta %->%',
      p_driver_id, p_origin_code, p_delivery_destination;
  END IF;

  SELECT COALESCE(shared_pickup_counter, false) INTO v_shared
  FROM public.profiles
  WHERE id = p_driver_id;

  IF v_shared THEN
    -- Counter partajat peste toate rutele soferului
    SELECT COALESCE(MAX(numeric_id), v_range_start - 1) INTO v_max_used
    FROM public.parcels
    WHERE driver_id = p_driver_id
      AND week_id   = p_week_id
      AND numeric_id >= v_range_start
      AND numeric_id <  v_range_end;
  ELSE
    -- Counter independent per ruta (comportamentul existent)
    SELECT COALESCE(MAX(numeric_id), v_range_start - 1) INTO v_max_used
    FROM public.parcels
    WHERE driver_id            = p_driver_id
      AND week_id              = p_week_id
      AND origin_code          = p_origin_code
      AND delivery_destination = p_delivery_destination
      AND numeric_id >= v_range_start
      AND numeric_id <  v_range_end;
  END IF;

  RETURN v_max_used + 1;
END;
$$;
