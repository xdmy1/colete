-- Migration: adaugă coloana paid_mdl_amount pentru achitări în lei moldovenești
-- Rulează în Supabase SQL Editor

ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS paid_mdl_amount real;

-- Fix numerotare: funcția ignora coletele arhivate și reseta la range_start
-- Soluție: caută maximul pe săptămâna curentă INCLUSIV arhivate (nu mai filtra is_archived)
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
BEGIN
  SELECT range_start, range_end INTO v_range_start, v_range_end
  FROM public.driver_route_ranges
  WHERE driver_id   = p_driver_id
    AND origin      = p_origin_code
    AND destination = p_delivery_destination;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Range negasit pentru soferul % pe ruta %→%',
      p_driver_id, p_origin_code, p_delivery_destination;
  END IF;

  -- Cauta maximul in TOATE coletele saptamanii (inclusiv arhivate/livrate)
  -- Astfel numerotarea continua corect chiar daca coletele anterioare au fost livrate
  SELECT COALESCE(MAX(numeric_id), v_range_start - 1) INTO v_max_used
  FROM public.parcels
  WHERE driver_id             = p_driver_id
    AND week_id               = p_week_id
    AND origin_code           = p_origin_code
    AND delivery_destination  = p_delivery_destination
    AND numeric_id >= v_range_start
    AND numeric_id <  v_range_end;
    -- FARA filtru is_archived: coletele livrate/arhivate isi pastreaza numarul

  RETURN v_max_used + 1;
END;
$$;
