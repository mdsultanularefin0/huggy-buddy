ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_by_email text;
CREATE INDEX IF NOT EXISTS email_log_created_at_idx ON public.email_log (created_at DESC);