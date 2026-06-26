-- Add slug to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slugs from name where missing
UPDATE public.products
SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) || '-' || substr(id::text, 1, 6)
WHERE slug IS NULL OR slug = '';

-- Enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON public.products (slug);
ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;