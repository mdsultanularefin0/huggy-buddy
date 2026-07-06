ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(v_id uuid, v_qty integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
  v_in_stock boolean;
BEGIN
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RETURN false;
  END IF;

  SELECT in_stock INTO v_in_stock FROM public.product_variants WHERE id = v_id;
  IF v_in_stock IS NULL THEN
    RETURN false;
  END IF;

  -- Unlimited stock mode: always available, no decrement.
  IF v_in_stock = true THEN
    RETURN true;
  END IF;

  UPDATE public.product_variants
     SET stock_quantity = stock_quantity - v_qty
   WHERE id = v_id
     AND stock_quantity >= v_qty;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated = 1;
END;
$$;