-- Add allowed_collection_countries column to profiles
-- NULL = no access to collections, array = allowed country codes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_collection_countries text[] DEFAULT NULL;

-- Set per-user collection country access
-- Alexandru Popa: all countries
UPDATE profiles SET allowed_collection_countries = '{MD,UK,BE,NL,DE}' WHERE username ILIKE '%alexandru popa%';

-- Depozit: all countries
UPDATE profiles SET allowed_collection_countries = '{MD,UK,BE,NL,DE}' WHERE username ILIKE '%depozit%';

-- Eugen: only Moldova
UPDATE profiles SET allowed_collection_countries = '{MD}' WHERE username ILIKE '%eugen%';

-- Ghenadie: only Moldova
UPDATE profiles SET allowed_collection_countries = '{MD}' WHERE username ILIKE '%ghenadie%';

-- Gheorghe: Moldova, Belgium, Netherlands, Germany
UPDATE profiles SET allowed_collection_countries = '{MD,BE,NL,DE}' WHERE username ILIKE '%gheorghe%';

-- Ilie: only Moldova
UPDATE profiles SET allowed_collection_countries = '{MD}' WHERE username ILIKE '%ilie%';

-- Ion Universal: all countries
UPDATE profiles SET allowed_collection_countries = '{MD,UK,BE,NL,DE}' WHERE username ILIKE '%ion universal%';

-- Iurie Caraman: only UK
UPDATE profiles SET allowed_collection_countries = '{UK}' WHERE username ILIKE '%iurie%caraman%';

-- Mihai Calmic: only UK
UPDATE profiles SET allowed_collection_countries = '{UK}' WHERE username ILIKE '%mihai%calmic%';

-- Oficiu: NULL (no collection access) - already default

-- Repartizare Germania: Belgium, Germany, Netherlands
UPDATE profiles SET allowed_collection_countries = '{BE,DE,NL}' WHERE username ILIKE '%repartizare%germania%';

-- Repartizare Olanda: Belgium, Germany, Netherlands
UPDATE profiles SET allowed_collection_countries = '{BE,DE,NL}' WHERE username ILIKE '%repartizare%olanda%';

-- Rosca Alex: only UK
UPDATE profiles SET allowed_collection_countries = '{UK}' WHERE username ILIKE '%rosca%alex%';

-- Stelian: only Moldova
UPDATE profiles SET allowed_collection_countries = '{MD}' WHERE username ILIKE '%stelian%';

-- Catalin: all except UK
UPDATE profiles SET allowed_collection_countries = '{MD,BE,NL,DE}' WHERE username ILIKE '%catalin%';
