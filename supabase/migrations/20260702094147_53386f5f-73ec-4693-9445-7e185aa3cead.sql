
-- Allow guest reviews and add approval workflow
ALTER TABLE public.product_reviews ALTER COLUMN user_id DROP NOT NULL;

CREATE TYPE public.review_status AS ENUM ('pending','approved','rejected');

ALTER TABLE public.product_reviews
  ADD COLUMN status public.review_status NOT NULL DEFAULT 'pending',
  ADD COLUMN guest_email text;

-- Existing reviews were live; keep them visible
UPDATE public.product_reviews SET status = 'approved' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS product_reviews_status_idx ON public.product_reviews(status);

-- Rewrite policies
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.product_reviews;

-- Public sees only approved reviews
CREATE POLICY "Public can read approved reviews"
  ON public.product_reviews FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' OR public.has_role(auth.uid(), 'admin'));

-- Anyone (guest or signed-in) can submit a pending review
CREATE POLICY "Anyone can submit a pending review"
  ON public.product_reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (auth.uid() IS NULL AND user_id IS NULL)
    )
  );

-- Admins can manage every review (approve/reject/edit/delete)
CREATE POLICY "Admins manage reviews"
  ON public.product_reviews FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can delete their own review
CREATE POLICY "Users delete own review"
  ON public.product_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
