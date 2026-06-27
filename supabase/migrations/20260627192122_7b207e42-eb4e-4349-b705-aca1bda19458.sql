ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS banner_image TEXT,
  ADD COLUMN IF NOT EXISTS signature_image TEXT;