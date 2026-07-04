# Order Invoice System

Generate branded invoices for every order, viewable + printable + downloadable as PDF, available to both customer (their own orders) and admin (any order).

## Scope
- Invoice number = `INV-{order_number}` (deterministic, no new table needed).
- Rendered from existing `orders` data (customer_json, items_json, totals, payment info).
- Branding pulled from `site_settings` (logo, site name, address, phone, email, VAT/registration line).
- No new DB tables. Optional: add `invoice_issued_at` timestamp on `orders` if we want to lock the issue date; otherwise use `orders.created_at`.

## Deliverables

### 1. Shared invoice component
`src/components/invoice-document.tsx`
- Pure presentational component, print-optimized (A4, `@media print` styles, hides nav/footer).
- Header: logo + shop info (left), "INVOICE" + number + date + status (right).
- Bill-to block from `customer_json` (name, phone, email, address, area, district).
- Line items table: image thumb, name, size, qty, unit price, line total.
- Totals block: subtotal, shipping, discount (with coupon/referral label), grand total.
- Footer: payment method, tracking code (if any), thank-you note, terms link.
- All money via `formatBDT`.

### 2. Invoice route
`src/routes/invoice.$id.tsx` (public route, but access-checked)
- Loader/component fetches order via a new server fn `getInvoiceOrder({ id })`:
  - If order has `user_id` → require signed-in user matches, OR admin role.
  - If guest order → require `?token=` matching a signed HMAC of the order id (link emailed to customer) OR admin.
- Renders `<InvoiceDocument>` + a top toolbar (hidden on print) with:
  - "Print / Save as PDF" → `window.print()`
  - "Download PDF" → client-side `html2pdf.js` (or `jspdf` + `html2canvas`) of the invoice node.
  - "Back to order".
- `head()` sets `<title>Invoice INV-{order_number}</title>`, `robots: noindex`.

### 3. Server function
`src/lib/invoice.functions.ts`
- `getInvoiceOrder` — validates access as above, returns order + site_settings branding fields in one payload.
- `signInvoiceToken(orderId)` helper (server-only) using `INTEGRATION_ENCRYPTION_KEY` (already present) or a new `INVOICE_SIGNING_SECRET` to HMAC-sign guest tokens.

### 4. Wire-up entry points
- Customer: on `_authenticated/account/orders/$id` and public `order/$id` (thank-you page) → add "View invoice" button linking to `/invoice/$id` (with token for guests).
- Admin: on `admin/orders/$id` → "View invoice" + "Open in new tab" buttons.
- Email: append invoice link to order-confirmation email in `email.functions.ts` (uses signed token for guest orders).

### 5. PDF generation approach
Client-side only (keeps worker runtime clean, avoids Node-only PDF libs):
- Add `html2pdf.js` (bundles html2canvas + jspdf). Import lazily inside the download handler.
- Print stylesheet handles physical printing without any library.

## Technical notes
- No Supabase schema change required for v1. If invoice numbering must differ from order number later, add `invoice_number` + sequence.
- Access rules enforced server-side in `getInvoiceOrder`; the route itself is public so guest links work.
- Reuse `STATUS_TONE` / formatting helpers already in admin order detail.

## Out of scope (v1)
- Credit notes / partial refunds on invoice.
- Multi-currency.
- Server-rendered PDF (can add later via a dedicated PDF worker if email attachments are needed).

Shall I build it?
