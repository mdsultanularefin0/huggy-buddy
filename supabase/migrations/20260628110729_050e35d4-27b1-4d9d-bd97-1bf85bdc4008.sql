ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS banner_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signature_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS art_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whispers_enabled boolean NOT NULL DEFAULT true;