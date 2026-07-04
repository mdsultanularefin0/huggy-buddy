ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'Partially Paid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0;