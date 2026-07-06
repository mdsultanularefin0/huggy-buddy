INSERT INTO public.combo_categories (combo_id, category_id)
SELECT c.id, cat.id
FROM public.combos c
JOIN public.categories cat
  ON (c.combo_type = 'prebuilt' AND cat.slug = 'combo-packs')
  OR (c.combo_type = 'byob' AND cat.slug = 'custom-combo')
ON CONFLICT DO NOTHING;