ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS consignment_id BIGINT,
  ADD COLUMN IF NOT EXISTS courier_status TEXT;