DROP POLICY IF EXISTS "users read own orders" ON public.orders;

CREATE POLICY "users read own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR lower(customer_json ->> 'email') = lower(COALESCE(auth.jwt() ->> 'email', ''))
  OR (customer_json ->> 'phone') IN (
    SELECT profiles.phone
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.phone IS NOT NULL
  )
);