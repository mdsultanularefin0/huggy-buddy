ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS footer_logo_size integer NOT NULL DEFAULT 36,
  ADD COLUMN IF NOT EXISTS footer_logo_align text NOT NULL DEFAULT 'left' CHECK (footer_logo_align IN ('left','center','right'));