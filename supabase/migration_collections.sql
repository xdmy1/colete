-- ============================================================
-- Migration: Adauga record_type pentru colectari
-- Rulează o singură dată în Supabase SQL Editor
-- ============================================================

-- 1. Adauga coloana record_type (default 'parcel' pentru toate randurile existente)
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'parcel'
  CHECK (record_type IN ('parcel', 'collection'));

-- 2. Index pe record_type
CREATE INDEX IF NOT EXISTS idx_parcels_record_type ON public.parcels(record_type);

-- 3. Recreez unique index ca sa excluda colectarile din verificarea de unicitate
DROP INDEX IF EXISTS idx_parcels_unique_number;
CREATE UNIQUE INDEX idx_parcels_unique_number
  ON public.parcels(driver_id, week_id, origin_code, delivery_destination, numeric_id)
  WHERE is_archived = false AND record_type = 'parcel';
