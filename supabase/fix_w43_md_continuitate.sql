-- ============================================================
-- Fix W43: coletele din MD inregistrate in 2026-W43 cu sufix /1 (1/1, 2/1, B3/1...)
-- primesc numere in CONTINUAREA saptamanii 2026-W42.
-- Ex: oficiu a ramas la 58 in W42 → coletele din W43 devin 59, 60, 61... (in ordinea inregistrarii)
--
-- Ruleaza O SINGURA DATA in Supabase → SQL Editor. Atomic (totul sau nimic).
-- Per sofer + ruta (sau per sofer, daca are counter partajat), doar in range-ul soferului.
-- Aplicatia (dupa deploy) numeroteaza deja coletele noi in continuare, deci scriptul
-- poate fi rulat si dupa ce s-au mai adaugat colete: le reasaza pe toate in ordine.
-- ============================================================

DO $$
BEGIN
  CREATE TEMP TABLE renum ON COMMIT DROP AS
  WITH keyed AS (
    SELECT p.id, p.week_id, p.numeric_id, p.created_at, p.delivery_destination,
           r.range_start,
           CASE WHEN COALESCE(pf.shared_pickup_counter, false) THEN p.driver_id::text
                ELSE p.driver_id::text || '|' || p.origin_code || '>' || p.delivery_destination
           END AS k
    FROM public.parcels p
    JOIN public.driver_route_ranges r
      ON r.driver_id = p.driver_id AND r.origin = p.origin_code AND r.destination = p.delivery_destination
    JOIN public.profiles pf ON pf.id = p.driver_id
    WHERE p.origin_code = 'MD'
      AND p.record_type = 'parcel'
      AND p.week_id IN ('2026-W42', '2026-W43')
      AND p.numeric_id >= r.range_start AND p.numeric_id < r.range_end
  ),
  prev AS (
    SELECT k, MAX(numeric_id) AS m FROM keyed WHERE week_id = '2026-W42' GROUP BY k
  ),
  cur AS (
    SELECT id, k, range_start, delivery_destination, numeric_id AS old_id,
           ROW_NUMBER() OVER (PARTITION BY k ORDER BY created_at, numeric_id) AS rn
    FROM keyed WHERE week_id = '2026-W43'
  )
  SELECT cur.id, cur.old_id,
         COALESCE(prev.m, cur.range_start - 1) + cur.rn AS new_id,
         CASE cur.delivery_destination WHEN 'BE' THEN 'B' WHEN 'NL' THEN 'OL' WHEN 'DE' THEN 'D' ELSE '' END
           || (COALESCE(prev.m, cur.range_start - 1) + cur.rn)::text AS new_human_id
  FROM cur LEFT JOIN prev ON prev.k = cur.k;

  -- In 2 pasi, ca indexul unic (driver, week, ruta, numeric_id) sa nu se planga
  -- in timpul mutarii (ex: 1 → 59 cand 59 exista deja si urmeaza sa devina 62)
  UPDATE public.parcels p SET numeric_id = -n.new_id FROM renum n WHERE p.id = n.id;
  UPDATE public.parcels p SET numeric_id = n.new_id, human_id = n.new_human_id FROM renum n WHERE p.id = n.id;

  RAISE NOTICE 'Renumerotate % colete din MD in 2026-W43', (SELECT COUNT(*) FROM renum);
END $$;

-- Verificare: cum arata acum coletele din MD din W43
SELECT pf.username, p.human_id, p.numeric_id, p.delivery_destination, p.created_at
FROM public.parcels p
JOIN public.profiles pf ON pf.id = p.driver_id
WHERE p.week_id = '2026-W43' AND p.origin_code = 'MD' AND p.record_type = 'parcel'
ORDER BY pf.username, p.delivery_destination, p.numeric_id;

-- Daca ramane ceva cu /1 (ex: colet transferat la alt sofer, in afara range-ului lui), apare aici:
SELECT pf.username, p.human_id, p.numeric_id, p.origin_code, p.delivery_destination
FROM public.parcels p
JOIN public.profiles pf ON pf.id = p.driver_id
WHERE p.human_id LIKE '%/1';
