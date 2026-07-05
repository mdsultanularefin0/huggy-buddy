
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_coupon_usage(text) FROM anon, authenticated, PUBLIC;
