
-- 1. Create product_variants table
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size_label text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  sale_price integer CHECK (sale_price IS NULL OR sale_price >= 0),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, size_label)
);

CREATE INDEX product_variants_product_id_idx ON public.product_variants(product_id);

-- 2. Grants (public read for storefront; admins mutate via service role edge paths / policies)
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

-- 3. RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 4. Policies: public can read; only admins can write
CREATE POLICY "Anyone can read product variants"
  ON public.product_variants FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert product variants"
  ON public.product_variants FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update product variants"
  ON public.product_variants FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete product variants"
  ON public.product_variants FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Atomic variant stock decrement (mirrors decrement_product_stock)
CREATE OR REPLACE FUNCTION public.decrement_variant_stock(v_id uuid, v_qty integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RETURN false;
  END IF;
  UPDATE public.product_variants
     SET stock_quantity = stock_quantity - v_qty
   WHERE id = v_id
     AND stock_quantity >= v_qty;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated = 1;
END;
$$;
