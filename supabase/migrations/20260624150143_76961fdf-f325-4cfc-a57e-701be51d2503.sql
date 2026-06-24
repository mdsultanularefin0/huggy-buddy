ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_bg_image text,
  ADD COLUMN IF NOT EXISTS hero_fg_image text;