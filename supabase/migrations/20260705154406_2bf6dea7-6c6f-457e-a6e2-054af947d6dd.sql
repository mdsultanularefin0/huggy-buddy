
CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_id uuid, p_qty integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN false;
  END IF;
  UPDATE public.products
     SET stock_quantity = stock_quantity - p_qty,
         in_stock = (stock_quantity - p_qty) > 0
   WHERE id = p_id
     AND is_active = true
     AND stock_quantity >= p_qty;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  UPDATE public.coupons
     SET used_count = used_count + 1
   WHERE code = p_code
     AND is_active = true
     AND (usage_limit IS NULL OR used_count < usage_limit)
     AND (expires_at IS NULL OR expires_at > now());
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_coupon_usage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(text) TO service_role;
