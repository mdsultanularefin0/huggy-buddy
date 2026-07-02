ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS images_json jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill images_json from image_url for existing rows
UPDATE public.products
SET images_json = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL
  AND (images_json IS NULL OR images_json = '[]'::jsonb);