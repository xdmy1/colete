-- ============================================================
-- PASUL 1: Adaugă coloana excluded_destinations în profiles
-- (rulează o singură dată — ignoră dacă există deja)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS excluded_destinations text[] DEFAULT '{}';
