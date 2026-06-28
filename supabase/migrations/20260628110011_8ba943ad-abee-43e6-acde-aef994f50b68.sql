ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS reels_title text NOT NULL DEFAULT 'From Our Community',
  ADD COLUMN IF NOT EXISTS reels_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reels_json jsonb NOT NULL DEFAULT '[]'::jsonb;