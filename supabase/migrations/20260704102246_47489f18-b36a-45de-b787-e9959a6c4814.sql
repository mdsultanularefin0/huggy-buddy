ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS shopcat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shopcat_title text NOT NULL DEFAULT 'Shop by Category',
  ADD COLUMN IF NOT EXISTS shopcat_subtitle text NOT NULL DEFAULT '';