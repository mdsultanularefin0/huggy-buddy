ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS product_notes_title text DEFAULT 'Notes & Ingredients',
  ADD COLUMN IF NOT EXISTS product_notes_content text DEFAULT 'Crafted with premium imported oils. Top, heart, and base notes designed to evolve gracefully on skin.',
  ADD COLUMN IF NOT EXISTS product_shipping_title text DEFAULT 'Shipping Info',
  ADD COLUMN IF NOT EXISTS product_shipping_content text DEFAULT 'Nationwide delivery across Bangladesh in 2–4 business days. Free shipping on orders over ৳999.',
  ADD COLUMN IF NOT EXISTS product_usage_title text DEFAULT 'How to Use',
  ADD COLUMN IF NOT EXISTS product_usage_content text DEFAULT 'Spray onto pulse points — wrists, neck, and behind the ears — from 15–20 cm away for best projection.';