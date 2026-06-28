-- Plasă de siguranță pentru pozele adăugate ulterior (la editare).
-- Pozele adăugate de ADMIN se încarcă în folderul șoferului (`<driver_id>/...`),
-- deci politica de INSERT pe storage trebuie să permită adminului.
-- Adminul deja VEDE pozele tuturor (deci SELECT include is_admin), dar rulează
-- asta dacă upload-ul de poze ca admin eșuează cu eroare de permisiune.
--
-- Rulează în: Supabase Dashboard → SQL Editor

CREATE POLICY "parcels_storage_admin_all"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'parcels' AND public.is_admin())
  WITH CHECK (bucket_id = 'parcels' AND public.is_admin());
