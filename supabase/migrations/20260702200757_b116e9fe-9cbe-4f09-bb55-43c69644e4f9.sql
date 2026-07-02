
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

CREATE POLICY "Public can view review images"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-images');

CREATE POLICY "Anyone can upload review images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "Admins can manage review images"
ON storage.objects FOR ALL
USING (bucket_id = 'review-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'review-images' AND public.has_role(auth.uid(), 'admin'));
