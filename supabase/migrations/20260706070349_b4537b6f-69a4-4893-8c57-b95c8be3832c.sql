
-- Product ↔ Category (many-to-many)
CREATE TABLE public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);
GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view product_categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage product_categories" ON public.product_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Product ↔ Note
CREATE TABLE public.product_notes (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, note_id)
);
GRANT SELECT ON public.product_notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_notes TO authenticated;
GRANT ALL ON public.product_notes TO service_role;
ALTER TABLE public.product_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view product_notes" ON public.product_notes FOR SELECT USING (true);
CREATE POLICY "Admins manage product_notes" ON public.product_notes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Combo ↔ Category
CREATE TABLE public.combo_categories (
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (combo_id, category_id)
);
GRANT SELECT ON public.combo_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combo_categories TO authenticated;
GRANT ALL ON public.combo_categories TO service_role;
ALTER TABLE public.combo_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view combo_categories" ON public.combo_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage combo_categories" ON public.combo_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Combo ↔ Note
CREATE TABLE public.combo_notes (
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (combo_id, note_id)
);
GRANT SELECT ON public.combo_notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combo_notes TO authenticated;
GRANT ALL ON public.combo_notes TO service_role;
ALTER TABLE public.combo_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view combo_notes" ON public.combo_notes FOR SELECT USING (true);
CREATE POLICY "Admins manage combo_notes" ON public.combo_notes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_product_categories_category ON public.product_categories(category_id);
CREATE INDEX idx_product_notes_note ON public.product_notes(note_id);
CREATE INDEX idx_combo_categories_category ON public.combo_categories(category_id);
CREATE INDEX idx_combo_notes_note ON public.combo_notes(note_id);

-- Backfill product_categories from products.category_id
INSERT INTO public.product_categories (product_id, category_id)
SELECT id, category_id FROM public.products WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill product_notes from products.scent_profile matching notes.scent_profile
INSERT INTO public.product_notes (product_id, note_id)
SELECT p.id, n.id
FROM public.products p
JOIN public.notes n ON n.scent_profile = p.scent_profile
WHERE p.scent_profile IS NOT NULL
ON CONFLICT DO NOTHING;
