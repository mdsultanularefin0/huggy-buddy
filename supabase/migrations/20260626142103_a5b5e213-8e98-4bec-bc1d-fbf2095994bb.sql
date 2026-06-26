
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS shop_name text DEFAULT 'Veloura Essence',
  ADD COLUMN IF NOT EXISTS shop_tagline text,
  ADD COLUMN IF NOT EXISTS shop_email text,
  ADD COLUMN IF NOT EXISTS shop_phone text,
  ADD COLUMN IF NOT EXISTS shop_address text,
  ADD COLUMN IF NOT EXISTS shop_hours text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_twitter text,
  ADD COLUMN IF NOT EXISTS social_youtube text,
  ADD COLUMN IF NOT EXISTS social_tiktok text,
  ADD COLUMN IF NOT EXISTS social_whatsapp text;
