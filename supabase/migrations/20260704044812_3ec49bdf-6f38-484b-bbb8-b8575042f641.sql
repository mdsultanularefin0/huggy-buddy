-- 1) Backfill: where products.note_type currently holds a note *title*,
--    replace it with that note's scent_profile so the rename below preserves data.
UPDATE public.products p
SET note_type = n.scent_profile
FROM public.notes n
WHERE p.note_type IS NOT NULL
  AND n.title = p.note_type
  AND n.scent_profile IS NOT NULL
  AND (p.note_type IS DISTINCT FROM n.scent_profile);

-- 2) Rename column note_type -> scent_profile
ALTER TABLE public.products RENAME COLUMN note_type TO scent_profile;
