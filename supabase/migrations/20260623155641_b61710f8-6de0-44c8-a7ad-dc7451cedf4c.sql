
CREATE POLICY "public read storefront images" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('product-images','combo-images','hero-images'));
CREATE POLICY "admins upload storefront images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('product-images','combo-images','hero-images') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update storefront images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('product-images','combo-images','hero-images') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete storefront images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('product-images','combo-images','hero-images') AND public.has_role(auth.uid(),'admin'));
