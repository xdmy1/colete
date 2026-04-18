-- ============================================================
-- Fix: reorder parcels via SECURITY DEFINER function
-- Bypasses RLS so any admin can reorder any driver's parcels
-- ============================================================

CREATE OR REPLACE FUNCTION public.reorder_parcels(
  p_ids text[],
  p_orders int[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  i int;
BEGIN
  -- Only admins can reorder other drivers' parcels
  IF NOT public.is_admin() THEN
    -- Non-admins can only reorder their own parcels
    IF EXISTS (
      SELECT 1 FROM public.parcels
      WHERE id = ANY(p_ids) AND driver_id != auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE public.parcels
    SET route_order = p_orders[i]
    WHERE id = p_ids[i]::uuid;
  END LOOP;
END;
$$;
