ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_bg_scale numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hero_fg_scale numeric NOT NULL DEFAULT 1;