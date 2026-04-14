-- ============================================================
-- Migration: Catalin → admin regional (BE / NL / DE)
-- Rulează o singură dată în Supabase SQL Editor
-- ============================================================

UPDATE public.profiles
SET
  role                  = 'admin',
  excluded_destinations = ARRAY['UK']
WHERE LOWER(username) = 'catalin';
