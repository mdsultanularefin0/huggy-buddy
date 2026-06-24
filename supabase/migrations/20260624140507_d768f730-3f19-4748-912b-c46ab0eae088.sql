ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS site_logo_url text,
  ADD COLUMN IF NOT EXISTS site_icon_url text;

UPDATE public.site_settings
  SET site_logo_url = COALESCE(site_logo_url, '/__l5e/assets-v1/88b6388c-596a-4d5c-8fd1-17dbc9212ab9/site-logo.png'),
      site_icon_url = COALESCE(site_icon_url, '/__l5e/assets-v1/d81a0f77-1972-4cbb-8e56-da8c0c8aaa89/site-icon.png');