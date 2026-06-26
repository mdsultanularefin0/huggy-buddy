ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS homepage_category_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flash_timer_title text NOT NULL DEFAULT 'Flash Sale! Up to 200Tk Off!',
  ADD COLUMN IF NOT EXISTS flash_timer_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS flash_timer_auto_reset boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flash_timer_duration_days integer NOT NULL DEFAULT 7;