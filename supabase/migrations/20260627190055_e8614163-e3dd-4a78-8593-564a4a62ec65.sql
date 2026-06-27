
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS signature_title text DEFAULT 'Our Signature Collection',
  ADD COLUMN IF NOT EXISTS signature_subtitle text DEFAULT 'Discover the fragrances that define Veloura — each crafted to leave an unforgettable impression.',
  ADD COLUMN IF NOT EXISTS art_eyebrow text DEFAULT 'Luxury in Every Drop',
  ADD COLUMN IF NOT EXISTS art_title text DEFAULT 'The Art of Veloura',
  ADD COLUMN IF NOT EXISTS art_body text DEFAULT 'Crafted with high-concentration fragrance oils, each Veloura scent unfolds in deliberate layers — opening bright, settling into warmth, and lingering long after the day ends.',
  ADD COLUMN IF NOT EXISTS art_button_label text DEFAULT 'Discover Our Story',
  ADD COLUMN IF NOT EXISTS art_button_link text DEFAULT '/about',
  ADD COLUMN IF NOT EXISTS art_image text,
  ADD COLUMN IF NOT EXISTS notes_title text DEFAULT 'Discover Your Signature Note',
  ADD COLUMN IF NOT EXISTS notes_subtitle text DEFAULT 'Find the fragrance family that speaks to you — from sunlit florals to deep, lingering woods.',
  ADD COLUMN IF NOT EXISTS notes_json jsonb DEFAULT '[{"title":"Fresh & Floral","gradient":"from-pink-300 to-purple-300","link":"/products"},{"title":"Deep & Woody","gradient":"from-amber-700 to-stone-800","link":"/products"},{"title":"Sweet & Oriental","gradient":"from-orange-400 to-[#52277a]","link":"/products"}]'::jsonb,
  ADD COLUMN IF NOT EXISTS whispers_title text DEFAULT 'Customer Whispers',
  ADD COLUMN IF NOT EXISTS whispers_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs_title text DEFAULT 'Frequently Asked Questions',
  ADD COLUMN IF NOT EXISTS faqs_json jsonb DEFAULT '[]'::jsonb;
