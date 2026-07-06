ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS homepage_new_arrival_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products DROP COLUMN IF EXISTS is_new_arrival;