
CREATE TABLE public.site_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  meta_description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site pages"
  ON public.site_pages FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert site pages"
  ON public.site_pages FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site pages"
  ON public.site_pages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete site pages"
  ON public.site_pages FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_site_pages_updated_at
  BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_pages (slug, title, meta_description, content) VALUES
('terms', 'Terms & Conditions', 'Read the Terms & Conditions for shopping with Veloura Essence.',
'## 1. Acceptance of Terms
By accessing or shopping at Veloura Essence, you agree to be bound by these Terms & Conditions and our Privacy Policy.

## 2. Orders & Payment
All orders are subject to product availability and confirmation of payment. We accept Cash on Delivery and supported digital payment methods at checkout.

- Prices are listed in Bangladeshi Taka (৳).
- We reserve the right to refuse or cancel any order.
- Promotional codes cannot be combined unless specified.

## 3. Shipping & Delivery
We deliver nationwide across Bangladesh. Estimated delivery is 2–4 business days. Free shipping on orders above ৳999.

## 4. Returns & Exchanges
Unopened products can be returned or exchanged within 7 days of delivery. Opened fragrances are not eligible for return for hygiene reasons.

## 5. Intellectual Property
All content on this site — including product names, imagery, and branding — is the property of Veloura Essence and may not be reproduced without permission.

## 6. Contact
For questions about these terms, reach us via the contact details on our footer.'),
('privacy', 'Privacy Policy', 'Learn how Veloura Essence collects, uses, and protects your information.',
'## 1. Information We Collect
We collect information you provide when placing an order or contacting support, including name, phone number, delivery address, email (optional), and order history.

## 2. How We Use Your Information
Your information is used to process orders, coordinate delivery, provide customer support, and improve our products and services.

## 3. Sharing & Disclosure
We never sell your personal information. Limited information is shared with delivery partners and payment processors strictly to fulfill your order.

## 4. Data Security
We use industry-standard safeguards to protect your information.

## 5. Your Rights
You may request access to, correction of, or deletion of your personal data at any time by contacting us.

## 6. Contact
For privacy-related questions, reach us via the contact details in our footer.'),
('faq', 'Frequently Asked Questions', 'Answers to common questions about Veloura Essence fragrances, shipping, and returns.',
'## How long do your fragrances last?
Our fragrances are crafted to last 6–10 hours depending on skin type and weather.

## Do you deliver across Bangladesh?
Yes, we deliver nationwide within 2–4 business days.

## What payment methods do you accept?
Cash on Delivery, bKash, Nagad, and major card payments at checkout.

## Can I return a product?
Unopened products can be returned within 7 days. Opened fragrances are not eligible for return for hygiene reasons.

## How do I track my order?
You will receive a tracking link via SMS once your order is dispatched.'),
('about', 'About Us', 'Discover the story behind Veloura Essence — luxury fragrance, crafted in Bangladesh.',
'## Our Story
Veloura Essence was born from a passion for refined, long-lasting fragrance — designed for the modern Bangladeshi.

## Our Promise
Every bottle is crafted with premium ingredients, honest pricing, and an experience worthy of every occasion.

## Our Mission
To redefine luxury fragrance in Bangladesh, one signature scent at a time.'),
('shipping', 'Shipping & Returns', 'Shipping timelines, charges, and our return policy at Veloura Essence.',
'## Shipping
- Nationwide delivery across Bangladesh
- Estimated delivery: 2–4 business days
- Free shipping on orders above ৳999
- Standard delivery charge: ৳60 inside Dhaka, ৳120 outside Dhaka

## Returns
- Unopened products: 7-day return/exchange window
- Opened fragrances: not eligible for return (hygiene reasons)
- Refunds are processed within 5–7 business days after the returned item is received

## Damaged or Wrong Items
If you receive a damaged or wrong item, contact us within 48 hours of delivery with photos.');
