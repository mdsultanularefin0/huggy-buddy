
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'form';

CREATE UNIQUE INDEX IF NOT EXISTS contact_messages_message_id_key
  ON public.contact_messages (message_id)
  WHERE message_id IS NOT NULL;
