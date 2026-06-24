## Goal
Make every visible element on the homepage editable from a single Admin → Homepage Editor page, and replace the four hero combo placeholder cards with real **Categories** that have photos, names, and link to a category listing page.

## What I'll build

### 1. Database (one migration)
- `categories` table: `name`, `slug` (unique), `image_url`, `sort_order`, `is_active`. GRANT select to `anon`/`authenticated`, full CRUD to `authenticated` + `service_role`. RLS: anyone can read active rows; only admins can write (via `has_role(auth.uid(),'admin')`).
- `products.category_id` → `categories.id` (nullable, ON DELETE SET NULL).
- Extend `site_settings` with homepage content fields: `hero_title`, `hero_subtitle`, `hero_cta_label`, `cta_band_text`, `cta_band_button_label`, `cta_band_button_link`.

### 2. Admin → Homepage Editor (`/admin/homepage`)
A single page with sections:
- **Hero** — title, subtitle, CTA label, hero background image (existing), left/right marquee overlays (existing).
- **Marquee** — text + countdown reset (moved from settings).
- **Category cards** — list of categories with drag-to-reorder, inline edit (name, image upload, active toggle), add/delete. These render as the four hero cards on the homepage.
- **CTA band** — text + button label + link.
- **Header position** — kept (sticky/static/floating).
- Live device preview reused from current settings page.

Old `/admin/settings` keeps only secrets/system fields (or redirects to Homepage Editor if nothing else remains).

### 3. Storefront
- `src/routes/index.tsx` — hero cards read from `categories` (active, sorted), each linking to `/category/$slug`. All copy reads from `site_settings`.
- `src/routes/category.$slug.tsx` — new page listing products where `category_id` matches the slug. Uses existing product card UI.
- `src/routes/admin.products.tsx` — add category dropdown to product form.

### 4. Cleanup
- Remove combo-card-as-category code paths from homepage; combos remain for the combo feature itself.
- Add nav link "Homepage" in admin sidebar.

## Technical notes
- All writes use authenticated supabase client + RLS (`has_role` admin check) — no service role needed.
- Image uploads reuse `uploadImage("hero-images", file)` helper and the existing `hero-images` bucket.
- Reorder = update `sort_order` integers in a single batch upsert.
- Category page loader uses a public read-only server fn (publishable key client) so SSR/OG works.
- Types regenerate after the migration approves; storefront edits land after that.

## Files
- New: `supabase/migrations/<ts>_categories_and_homepage.sql`, `src/routes/admin.homepage.tsx`, `src/routes/category.$slug.tsx`, `src/lib/categories.functions.ts`.
- Edited: `src/routes/index.tsx`, `src/routes/admin.tsx` (nav), `src/routes/admin.settings.tsx` (slim down), `src/routes/admin.products.tsx` (category select).
