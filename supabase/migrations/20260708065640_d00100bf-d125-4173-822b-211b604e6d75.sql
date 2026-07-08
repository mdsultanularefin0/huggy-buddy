ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS instructions text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_details jsonb;